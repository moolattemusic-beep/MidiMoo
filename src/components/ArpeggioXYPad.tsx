import React, { useRef, useState, useEffect } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { OrchidParams } from '../types';
import { CustomSlider } from './CustomSlider';

// Note length runs 20ms to 5s on an exponential curve, so the short staccato
// values that need fine control get most of the travel instead of being
// crammed into the first few pixels.
const NOTE_LEN_MIN = 20;
const NOTE_LEN_MAX = 5000;
const NOTE_LEN_TICKS = 1000;

const noteLenToSlider = (ms: number) =>
  Math.round(Math.log(Math.max(NOTE_LEN_MIN, ms) / NOTE_LEN_MIN) / Math.log(NOTE_LEN_MAX / NOTE_LEN_MIN) * NOTE_LEN_TICKS);

const sliderToNoteLen = (pos: number) => {
  const ms = NOTE_LEN_MIN * Math.pow(NOTE_LEN_MAX / NOTE_LEN_MIN, pos / NOTE_LEN_TICKS);
  // Round to something readable at each end of the range.
  const grain = ms < 100 ? 5 : ms < 500 ? 10 : ms < 2000 ? 25 : 50;
  return Math.min(NOTE_LEN_MAX, Math.max(NOTE_LEN_MIN, Math.round(ms / grain) * grain));
};

const formatNoteLen = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}S` : `${ms}MS`);

// Order must match arpeggioPattern in OrchidEngine.getArpeggioSequence
const ARP_PATTERNS = ['UP', 'DOWN', '2UP1DN', 'ALT', '3RDS', 'PEND', 'OUT-IN', 'RND'];

interface ArpeggioXYPadProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  incomingCC?: {cc: number, val: number, ch: number, t: number} | null;
  /** The remote wants the playing surface on its own, without the settings above it. */
  padOnly?: boolean;
}

export function ArpeggioXYPad({ engine, params, setParams, incomingCC, padOnly }: ArpeggioXYPadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activePitch, setActivePitch] = useState<number | null>(null);
  
  // To avoid re-triggering the same note while dragging horizontally
  const activePitchRef = useRef<number | null>(null);
  
  // Track CC state internally for external MIDI
  // Which string was last struck, and a counter so striking the same one again
  // restarts its animation rather than doing nothing.
  const [plucks, setPlucks] = useState<Record<number, number>>({});
  const pluckCount = useRef(0);
  const pluckTimers = useRef<Map<number, any>>(new Map());
  const pluck = (index: number) => {
    pluckCount.current += 1;
    setPlucks(previous => ({ ...previous, [index]: pluckCount.current }));
    clearTimeout(pluckTimers.current.get(index));
    pluckTimers.current.set(index, setTimeout(() => {
      pluckTimers.current.delete(index);
      setPlucks(({ [index]: _gone, ...rest }) => rest);
    }, 520));
  };
  useEffect(() => () => {
    for (const timer of pluckTimers.current.values()) clearTimeout(timer);
  }, []);

  const strings: number[] = engine?.getArpeggioSequence?.() ?? [];
  const stringsKey = strings.join(',');
  // A new chord is a new set of strings, so nothing carries over from the old one.
  useEffect(() => {
    for (const timer of pluckTimers.current.values()) clearTimeout(timer);
    pluckTimers.current.clear();
    setPlucks({});
  }, [stringsKey]);

  const [nx, setNx] = useState(0.5);
  const [ny, setNy] = useState(0.5);
  const lastMidiTimeRef = useRef<number>(0);
  const jumpOriginYRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  
  useEffect(() => {
    if (incomingCC && incomingCC.ch === 8) {
      if (incomingCC.cc === 124) {
        const val = incomingCC.val / 127;
        setNx(val);
      } else if (incomingCC.cc === 125) {
        const val = 1 - (incomingCC.val / 127);
        setNy(val);
        
        const now = Date.now();
        if (now - lastMidiTimeRef.current > 200) {
           // It's been more than 200ms since the last Y movement, consider this a "jump" to a new location.
           // User explicitly requested NOT to play a sound just by changing location, only when swiping.
           handlePointerInternal(nx, val, 'midi_jump');
        } else {
           // Continuous rapid CC messages count as a swipe
           handlePointerInternal(nx, val, 'midi_move');
        }
        lastMidiTimeRef.current = now;
      } else if (incomingCC.cc === 123) {
        // Optional Z-axis mapped to CC 123 for discrete touch down/up
        if (incomingCC.val > 0) {
           handlePointerInternal(nx, ny, 'midi_jump'); // Register touch but don't play
        } else {
           handlePointerInternal(nx, ny, 'up'); // Release
        }
      }
    }
  }, [incomingCC]);

  const handlePointerInternal = (lx: number, ly: number, type: 'down' | 'move' | 'up' | 'midi_jump' | 'midi_move') => {
    if (!engine) return;
    
    if (type === 'up') {
      setIsDragging(false);
      // The note keeps ringing for its set length — lifting off only clears the
      // cursor. Its own timer releases it.
      activePitchRef.current = null;
      setActivePitch(null);
      return;
    }
    
    const yVal = ly;
    const xVal = lx;
    
    engine.emitControlChange(124, Math.round(xVal * 127), 8);
    engine.emitControlChange(125, Math.round((1 - yVal) * 127), 8);
    
    const pitches = engine.getArpeggioSequence();
    if (pitches.length === 0) return;
    
    const index = Math.floor(yVal * pitches.length);
    const safeIndex = Math.min(pitches.length - 1, Math.max(0, index));
    const targetPitch = pitches[safeIndex];
    
    if (type === 'down') {
       const maxVel = params.arpeggioMaxVelocity ?? 127;
       const velocity = Math.max(1, Math.min(maxVel, Math.round(xVal * maxVel)));
       engine.handleArpeggioNoteOn(targetPitch, velocity);
       pluck(safeIndex);
       activePitchRef.current = targetPitch;
       setActivePitch(targetPitch);
       (containerRef as any).lastIndex = safeIndex;
    } else if (type === 'midi_jump') {
       // Landing on the pad normally just moves the cursor — notes come from
       // swiping. With TAP TO PLAY on, the landing sounds too, so you can
       // sprinkle single notes over a chord without swiping.
       if (params.arpeggioTapToPlay) {
          const maxVel = params.arpeggioMaxVelocity ?? 127;
          const velocity = Math.max(1, Math.min(maxVel, Math.round(xVal * maxVel)));
          engine.handleArpeggioNoteOn(targetPitch, velocity);
          pluck(safeIndex);
       }
       // Any sounding note is left to its own timer.
       activePitchRef.current = targetPitch;
       setActivePitch(targetPitch);
       (containerRef as any).lastIndex = safeIndex;

       jumpOriginYRef.current = ly;
       isSwipingRef.current = false;
    } else if ((type === 'move' || type === 'midi_move') && targetPitch !== activePitchRef.current) {
       if (type === 'midi_move' && !isSwipingRef.current) {
          if (Math.abs(ly - jumpOriginYRef.current) > 0.03) {
             isSwipingRef.current = true;
          } else {
             // Still just jittering around the jump origin, update cursor but stay silent
             activePitchRef.current = targetPitch;
             setActivePitch(targetPitch);
             (containerRef as any).lastIndex = safeIndex;
             return;
          }
       }

       const maxVel = params.arpeggioMaxVelocity ?? 127;
       const velocity = Math.max(1, Math.min(maxVel, Math.round(xVal * maxVel)));
       
       // If no note was previously active, treat this first movement as a down trigger
       if (activePitchRef.current === null) {
           engine.handleArpeggioNoteOn(targetPitch, velocity);
           pluck(safeIndex);
           activePitchRef.current = targetPitch;
           setActivePitch(targetPitch);
           (containerRef as any).lastIndex = safeIndex;
       } else {
           const lastIndex = (containerRef as any).lastIndex ?? safeIndex;
           const minIdx = Math.min(lastIndex, safeIndex);
           const maxIdx = Math.max(lastIndex, safeIndex);
           
           // Notes swept over are left to ring for their set length rather than
           // being cut off the moment the finger moves on.
           for (let i = minIdx; i <= maxIdx; i++) {
             if (i !== lastIndex) {
                engine.handleArpeggioNoteOn(pitches[i], velocity);
                pluck(i);
             }
           }
           
           activePitchRef.current = targetPitch;
           setActivePitch(targetPitch);
           (containerRef as any).lastIndex = safeIndex;
       }
    }
  };

  const handlePointer = (clientX: number, clientY: number, type: 'down' | 'move' | 'up') => {
    if (!engine || !containerRef.current) return;
    
    if (type === 'up') {
      setIsDragging(false);
      handlePointerInternal(nx, ny, 'up');
      return;
    }
    
    const element = containerRef.current;
    const rect = element.getBoundingClientRect();
    let lnx = (clientX - rect.left - element.clientLeft) / element.clientWidth;
    let lny = (clientY - rect.top - element.clientTop) / element.clientHeight;
    
    lnx = Math.max(0, Math.min(1, lnx));
    lny = Math.max(0, Math.min(1, lny));
    
    setNx(lnx);
    setNy(1 - lny);
    
    handlePointerInternal(lnx, 1 - lny, type);
  };
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* gesture already gone */ }
    handlePointer(e.clientX, e.clientY, 'down');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handlePointer(e.clientX, e.clientY, 'move');
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* nothing captured */ }
    handlePointer(e.clientX, e.clientY, 'up');
  };

  return (
    <div className={`flex flex-col items-center flex-1 h-full ${padOnly ? 'min-h-0' : 'module'}`}>
      {!padOnly && <p className="label-meta self-start mb-2">ARPEGGIO STRUM PAD</p>}
      {!padOnly && (<>
      
      {/* Two columns rather than four: at four across, the labels wrapped and
          collided with the neighbouring readouts. */}
      <div className="w-full grid grid-cols-2 gap-x-5 gap-y-1 mb-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px] whitespace-nowrap">LOWEST NOTE</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px] whitespace-nowrap">{
              (() => {
                const p = params.arpeggioRegisterStart ?? 48;
                const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                return `${names[p % 12]}${Math.floor(p / 12) - 1}`;
              })()
            }</span>
          </div>
          <CustomSlider 
            min={24} max={84} step={1} 
            value={params.arpeggioRegisterStart ?? 48} 
            onChange={(v) => {
              const newParams = { ...params, arpeggioRegisterStart: v };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }} 
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px] whitespace-nowrap">OCTAVES</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px] whitespace-nowrap">{params.arpeggioOctaves ?? 4}</span>
          </div>
          <CustomSlider 
            min={1} max={6} step={1} 
            value={params.arpeggioOctaves ?? 4} 
            onChange={(v) => {
              const newParams = { ...params, arpeggioOctaves: v };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }} 
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px] whitespace-nowrap">MAX VEL</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px] whitespace-nowrap">{params.arpeggioMaxVelocity ?? 127}</span>
          </div>
          <CustomSlider
            min={10} max={127} step={1}
            value={params.arpeggioMaxVelocity ?? 127}
            onChange={(v) => {
              const newParams = { ...params, arpeggioMaxVelocity: v };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }}
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px] whitespace-nowrap">LENGTH</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px] whitespace-nowrap">{formatNoteLen(params.arpeggioNoteLengthMs ?? 100)}</span>
          </div>
          <CustomSlider
            min={0} max={NOTE_LEN_TICKS} step={1}
            value={noteLenToSlider(params.arpeggioNoteLengthMs ?? 100)}
            onChange={(pos) => {
              const newParams = { ...params, arpeggioNoteLengthMs: sliderToNoteLen(pos) };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }}
          />
        </div>
      </div>

      <div className="w-full mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="label-meta !text-[10px] whitespace-nowrap">PATTERN</span>
          <div className="flex items-center gap-2">
            <span className="label-meta !text-[10px] whitespace-nowrap">TAP TO PLAY</span>
            <div
              className={`toggle-switch ${params.arpeggioTapToPlay ? 'on' : ''}`}
              onClick={() => {
                const newParams = { ...params, arpeggioTapToPlay: !params.arpeggioTapToPlay };
                setParams(newParams);
                if (engine) engine.params = newParams;
              }}
            ></div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {ARP_PATTERNS.map((name, idx) => (
            <button
              key={name}
              onClick={() => {
                const newParams = { ...params, arpeggioPattern: idx };
                setParams(newParams);
                if (engine) engine.params = newParams;
              }}
              className={`analog-btn !text-[9px] !px-1 !py-[5px] ${(params.arpeggioPattern ?? 0) === idx ? 'active' : ''}`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Routing. Independent of each other: a note can be on its own channel
            and glide in from the last one, or neither, and RAW overrides both
            by taking the note out of the modulation entirely. */}
        <div className="grid grid-cols-3 gap-1 mt-2">
          {([
            ['MPE', 'arpeggioMpeChannels', 'EACH NOTE ON ITS OWN MPE CHANNEL'],
            ['GLIDE', 'arpeggioGlide', 'BEND FROM THE PREVIOUS NOTE. NEEDS MPE ON'],
            ['RAW', 'arpeggioRaw', 'NO MODULATION, VELOCITY ONLY'],
          ] as const).map(([label, key, title]) => (
            <button
              key={key}
              title={title}
              onClick={() => {
                const newParams = { ...params, [key]: !params[key] };
                setParams(newParams);
                if (engine) engine.params = newParams;
              }}
              className={`analog-btn !text-[9px] !px-1 !py-[5px] ${params[key] ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      </>)}
      <div className={`flex w-full ${padOnly ? 'gap-2 flex-1 min-h-0' : 'gap-4 h-[240px]'}`}>
        {/* Global Pitch Bend Strip */}
        <MagneticPitchBend engine={engine} incomingCC={incomingCC} />
        
        {/* XY Pad */}
        <div 
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="flex-1 h-full bg-[#12120f] border-[8px] border-[var(--surface)] rounded-md relative shadow-[inset_0_0_20px_#000] touch-none overflow-hidden group"
          style={{ containerType: 'size' }}
        >
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[linear-gradient(to_right,rgba(0,0,0,0.8),transparent)]" />
        <Strings pitches={strings} plucks={plucks} />
        
        <div className="absolute top-2 left-2 label-meta pointer-events-none text-white/75 text-[10px]">VELOCITY →</div>
        <div className="absolute bottom-2 left-2 label-meta pointer-events-none text-white/75 text-[10px]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>PITCH ↑</div>
        
        {/* XY Visual Indicator */}
        <div 
          className="absolute top-0 left-0 w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-[var(--accent)] pointer-events-none shadow-[0_0_10px_var(--accent)] transition-opacity duration-75"
          style={{
            transform: `translate3d(${nx * 100}cqw, ${(1 - ny) * 100}cqh, 0)`,
            opacity: isDragging || activePitch !== null ? 1 : 0.4
          }} 
        />

        {activePitch !== null && (
          <div className="absolute inset-0 pointer-events-none bg-[var(--accent)] opacity-10 mix-blend-screen transition-opacity duration-75" />
        )}
      </div>
      </div>
    </div>
  );
}

/**
 * One line per note the strum pad can play, struck where the finger crosses it.
 * Falls back to an even grid before a chord is held, so the surface is never
 * blank.
 */
const Strings: React.FC<{ pitches: number[]; plucks: Record<number, number> }> = ({ pitches, plucks }) => {
  if (pitches.length === 0) {
    return (
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, var(--accent) 19px, var(--accent) 20px)'
      }} />
    );
  }
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pitches.map((pitch, index) => {
        const nonce = plucks[index];
        return (
          <div
            // Remounting on each strike is what restarts the animation; without
            // it a string struck twice in a row only moves the first time.
            key={`${index}-${nonce ?? 0}`}
            className={`absolute left-0 right-0 h-px bg-[var(--accent)] ${nonce ? 'string-line' : 'opacity-[0.14]'}`}
            style={{ top: `${(1 - (index + 0.5) / pitches.length) * 100}%` }}
          />
        );
      })}
    </div>
  );
};

function MagneticPitchBend({ engine, incomingCC }: { engine: OrchidEngine | null, incomingCC?: {cc: number, val: number, ch: number, t: number} | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(64);
  
  useEffect(() => {
    if (incomingCC && incomingCC.ch === 8 && incomingCC.cc === 126) {
       setVal(incomingCC.val);
       if (engine) {
          engine.emitControlChange(126, incomingCC.val, 8);
          if (engine.onOutputNote) {
             engine.onOutputNote({
               pitch: 0, velocity: 0, isOn: false, isPitchBend: true,
               pitchBendValue: ((incomingCC.val - 64) / 64) * 12, mpeChannel: 8
             });
          }
       }
    }
  }, [incomingCC, engine]);
  
  const handlePointer = (clientX: number, clientY: number, type: 'down' | 'move' | 'up') => {
    if (!containerRef.current || !engine) return;
    
    if (type === 'up') {
      setVal(64);
      engine.emitControlChange(126, 64, 8);
      if (engine.onOutputNote) {
         engine.onOutputNote({
           pitch: 0, velocity: 0, isOn: false, isPitchBend: true,
           pitchBendValue: 0, mpeChannel: 8
         });
      }
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    let ny = (clientY - rect.top) / rect.height;
    ny = Math.max(0, Math.min(1, ny));
    
    const midiVal = Math.round((1 - ny) * 127);
    setVal(midiVal);
    engine.emitControlChange(126, midiVal, 8);
    // Also emit standard pitch bend on channel 8 (val 0-127 mapped to roughly +/- 2 semitones if range is 2)
    // Semitones = ((midiVal - 64) / 64) * 12;
    if (engine.onOutputNote) {
       engine.onOutputNote({
         pitch: 0, velocity: 0, isOn: false, isPitchBend: true,
         pitchBendValue: ((midiVal - 64) / 64) * 12, mpeChannel: 8
       });
    }
  };

  return (
    <div 
      ref={containerRef}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        handlePointer(e.clientX, e.clientY, 'down');
      }}
      onPointerMove={(e) => {
        if (e.buttons > 0) handlePointer(e.clientX, e.clientY, 'move');
      }}
      onPointerUp={(e) => {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        handlePointer(e.clientX, e.clientY, 'up');
      }}
      onPointerCancel={(e) => {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        handlePointer(e.clientX, e.clientY, 'up');
      }}
      className="w-12 shrink-0 h-full bg-[#12120f] border-[6px] border-[var(--surface)] rounded-md relative touch-none shadow-[inset_0_0_10px_#000]"
    >
      <div className="absolute top-2 left-0 right-0 label-meta text-white/75 text-[9px] text-center pointer-events-none">PB</div>
      
      <div className="absolute left-0 right-0 bg-[var(--accent)] transition-all duration-75 pointer-events-none" style={{
        bottom: '50%',
        height: val >= 64 ? `${((val - 64) / 63) * 50}%` : '0%'
      }} />
      <div className="absolute left-0 right-0 bg-[var(--accent)] top-[50%] transition-all duration-75 pointer-events-none" style={{
        height: val < 64 ? `${((64 - val) / 64) * 50}%` : '0%'
      }} />
      
      <div className="absolute top-[50%] left-0 right-0 h-[2px] bg-white -mt-[1px] shadow-[0_0_5px_rgba(255,255,255,0.5)] pointer-events-none" />
    </div>
  );
}

