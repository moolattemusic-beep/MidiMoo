import React, { useRef, useState, useEffect } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { OrchidParams } from '../types';
import { CustomSlider } from './CustomSlider';

interface ArpeggioXYPadProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  incomingCC?: {cc: number, val: number, ch: number, t: number} | null;
}

export function ArpeggioXYPad({ engine, params, setParams, incomingCC }: ArpeggioXYPadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activePitch, setActivePitch] = useState<number | null>(null);
  
  // To avoid re-triggering the same note while dragging horizontally
  const activePitchRef = useRef<number | null>(null);
  
  // Track CC state internally for external MIDI
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
      if (activePitchRef.current !== null) {
         engine.handleArpeggioNoteOff(activePitchRef.current);
      }
      activePitchRef.current = null;
      setActivePitch(null);
      return;
    }
    
    const yVal = ly;
    const xVal = lx;
    
    engine.emitControlChange(124, Math.round(xVal * 127), 8);
    engine.emitControlChange(125, Math.round((1 - yVal) * 127), 8);
    
    const pitches = engine.getArpeggioPitches();
    if (pitches.length === 0) return;
    
    const index = Math.floor(yVal * pitches.length);
    const safeIndex = Math.min(pitches.length - 1, Math.max(0, index));
    const targetPitch = pitches[safeIndex];
    
    if (type === 'down') {
       const maxVel = params.arpeggioMaxVelocity ?? 127;
       const velocity = Math.max(1, Math.min(maxVel, Math.round(xVal * maxVel)));
       engine.handleArpeggioNoteOn(targetPitch, velocity);
       activePitchRef.current = targetPitch;
       setActivePitch(targetPitch);
       (containerRef as any).lastIndex = safeIndex;
    } else if (type === 'midi_jump') {
       // Clear old note if it was held
       if (activePitchRef.current !== null) {
          engine.handleArpeggioNoteOff(activePitchRef.current);
       }
       // Update cursor position silently without playing a note
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
           activePitchRef.current = targetPitch;
           setActivePitch(targetPitch);
           (containerRef as any).lastIndex = safeIndex;
       } else {
           const lastIndex = (containerRef as any).lastIndex ?? safeIndex;
           const minIdx = Math.min(lastIndex, safeIndex);
           const maxIdx = Math.max(lastIndex, safeIndex);
           
           engine.handleArpeggioNoteOff(activePitchRef.current);
           
           for (let i = minIdx; i <= maxIdx; i++) {
             if (i !== lastIndex) {
                engine.handleArpeggioNoteOn(pitches[i], velocity);
                if (i !== safeIndex) {
                   engine.handleArpeggioNoteOff(pitches[i]);
                }
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
    
    const rect = containerRef.current.getBoundingClientRect();
    let lnx = (clientX - rect.left) / rect.width;
    let lny = (clientY - rect.top) / rect.height;
    
    lnx = Math.max(0, Math.min(1, lnx));
    lny = Math.max(0, Math.min(1, lny));
    
    setNx(lnx);
    setNy(1 - lny);
    
    handlePointerInternal(lnx, 1 - lny, type);
  };
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointer(e.clientX, e.clientY, 'down');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handlePointer(e.clientX, e.clientY, 'move');
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    handlePointer(e.clientX, e.clientY, 'up');
  };

  return (
    <div className="module flex flex-col items-center flex-1 h-full">
      <p className="label-meta self-start mb-2">ARPEGGIO STRUM PAD</p>
      
      <div className="w-full flex gap-4 mb-4">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px]">LOWEST NOTE</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px]">{
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
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px]">OCTAVES</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px]">{params.arpeggioOctaves ?? 4}</span>
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
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px]">MAX VEL</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px]">{params.arpeggioMaxVelocity ?? 127}</span>
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
      </div>
      
      <div className="flex gap-4 w-full h-[240px]">
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
        >
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[linear-gradient(to_right,rgba(0,0,0,0.8),transparent)]" />
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
           backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, var(--accent) 19px, var(--accent) 20px)'
        }} />
        
        <div className="absolute top-2 left-2 label-meta pointer-events-none text-white/50 text-[10px]">VELOCITY →</div>
        <div className="absolute bottom-2 left-2 label-meta pointer-events-none text-white/50 text-[10px]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>PITCH ↑</div>
        
        {/* XY Visual Indicator */}
        <div 
          className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-[var(--accent)] pointer-events-none shadow-[0_0_10px_var(--accent)] transition-all duration-75" 
          style={{ 
            left: `${nx * 100}%`, 
            top: `${(1 - ny) * 100}%`,
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
      <div className="absolute top-2 left-0 right-0 label-meta text-white/50 text-[9px] text-center pointer-events-none">PB</div>
      
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

