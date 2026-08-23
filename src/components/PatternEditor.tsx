import React, { useRef, useState } from 'react';
import { OrchidParams } from '../types';
import { OrchidEngine } from '../lib/OrchidEngine';
import {
  CHORD_PATTERNS,
  ChordPattern,
  PatternCategory,
  PatternEvent,
  TICKS_PER_BEAT,
  randomPattern,
} from '../lib/ChordPatterns';

const CATEGORIES: Array<{ key: PatternCategory; label: string }> = [
  { key: 'piano', label: 'PIANO' },
  { key: 'harp', label: 'HARP' },
  { key: 'guitar', label: 'GUITAR' },
  { key: 'shapes', label: 'SHAPES' },
];

// Eight rungs rather than five. The chord still has as many notes as it has
// tones; SPREAD repeats them upward so there is something for the upper rungs
// to play.
const VOICES = 8;
const MIN_BPM = 40;
const MAX_BPM = 240;

interface Props {
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  engine: OrchidEngine | null;
}

type Drag =
  | { kind: 'move'; index: number; grabTicks: number; startVoice: number }
  | { kind: 'length'; index: number }
  | { kind: 'transpose'; index: number; grabY: number; startSemitones: number }
  | null;

export const PatternEditor: React.FC<Props> = ({ params, setParams, engine }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag>(null);
  // Read from the engine each frame rather than run a clock of its own: the
  // playhead should show where the notes actually are, not where a second
  // timer thinks they should be.
  const [phase, setPhase] = useState<number | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [category, setCategory] = useState<PatternCategory>('piano');
  React.useEffect(() => {
    let raf = 0;
    const follow = () => {
      setPhase(engine ? engine.getPatternPhase() : null);
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const pattern: ChordPattern = React.useMemo(() => {
    if (params.patternCustom) {
      try {
        return JSON.parse(params.patternCustom) as ChordPattern;
      } catch {
        /* fall through to the library */
      }
    }
    return CHORD_PATTERNS[Math.max(0, Math.min(CHORD_PATTERNS.length - 1, params.patternIndex ?? 0))];
  }, [params.patternCustom, params.patternIndex]);

  const totalTicks = Math.max(1, Math.round(pattern.lengthBeats * TICKS_PER_BEAT));

  const update = (next: Partial<OrchidParams>) => {
    const merged = { ...params, ...next };
    setParams(merged);
    if (engine) engine.params = merged;
  };

  /** Editing anything writes a custom pattern; the library stays untouched. */
  const writePattern = (next: ChordPattern) => update({ patternCustom: JSON.stringify(next) });

  const selectLibrary = (index: number) => update({ patternIndex: index, patternCustom: null });

  const ticksFromClientX = (clientX: number): number => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * totalTicks;
  };

  const voiceFromClientY = (clientY: number): number => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return 1;
    const ratio = Math.max(0, Math.min(0.999, (clientY - rect.top) / rect.height));
    // Voice 1 is the lowest note, so it belongs at the bottom of the grid.
    return VOICES - Math.floor(ratio * VOICES);
  };

  // Snapping is what makes dragging by hand produce something playable rather
  // than approximately right. The step is the grid the player has chosen, so
  // triplets land on triplets.
  const gridTicks = Math.max(1, params.patternGrid ?? TICKS_PER_BEAT / 4);
  const snap = (ticks: number) => Math.round(ticks / gridTicks) * gridTicks;

  const onPointerDown = (e: React.PointerEvent, index: number, kind: 'move' | 'length') => {
    e.stopPropagation();
    e.preventDefault();
    // Held modifiers move the note an octave instead of starting a drag, which
    // keeps the vertical axis meaning "which voice" rather than "which pitch".
    if (kind === 'move' && (e.shiftKey || e.altKey)) {
      nudgeOctave(index, e.shiftKey ? 1 : -1);
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const event = pattern.events[index];
    // Command turns the vertical drag into pitch instead of voice, so a single
    // note can be moved off the chord without leaving the voice it belongs to.
    if (kind === 'move' && (e.metaKey || e.ctrlKey)) {
      setDrag({ kind: 'transpose', index, grabY: e.clientY, startSemitones: event.semitones ?? 0 });
      return;
    }
    setDrag(
      kind === 'move'
        ? { kind, index, grabTicks: ticksFromClientX(e.clientX) - event.start, startVoice: event.voice }
        : { kind, index }
    );
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const events = [...pattern.events];
    const event = { ...events[drag.index] };

    if (drag.kind === 'move') {
      event.start = Math.max(0, Math.min(totalTicks - 1, snap(ticksFromClientX(e.clientX) - drag.grabTicks)));
      event.voice = voiceFromClientY(e.clientY);
    } else if (drag.kind === 'transpose') {
      // Up is up: dragging away from the screen's top raises the note. Eight
      // pixels a semitone is fine enough to land on one and coarse enough not
      // to skid past it.
      const steps = Math.round((drag.grabY - e.clientY) / 8);
      event.semitones = Math.max(-24, Math.min(24, drag.startSemitones + steps));
    } else {
      event.length = Math.max(gridTicks, snap(ticksFromClientX(e.clientX) - event.start));
    }
    events[drag.index] = event;
    writePattern({ ...pattern, events });
  };

  const endDrag = () => setDrag(null);

  const addEvent = (e: React.PointerEvent) => {
    if (drag) return;
    const start = Math.max(0, Math.min(totalTicks - 1, snap(ticksFromClientX(e.clientX))));
    const voice = voiceFromClientY(e.clientY);
    writePattern({
      ...pattern,
      events: [...pattern.events, { voice, start, length: gridTicks, velocity: 96 }],
    });
  };

  const removeEvent = (index: number) => {
    writePattern({ ...pattern, events: pattern.events.filter((_, i) => i !== index) });
  };

  /** A held note rings on instead of being re-struck each cycle. */
  const toggleHold = (index: number) => {
    const events = [...pattern.events];
    events[index] = { ...events[index], hold: !events[index].hold };
    writePattern({ ...pattern, events });
  };

  /** Step an event through octave down, home and up. */
  const nudgeOctave = (index: number, delta: number) => {
    const events = [...pattern.events];
    const event = { ...events[index] };
    event.octave = Math.max(-1, Math.min(1, (event.octave ?? 0) + delta));
    events[index] = event;
    writePattern({ ...pattern, events });
  };

  const beats = Math.max(1, Math.round(pattern.lengthBeats));

  return (
    <div className="module flex flex-col gap-2 shrink-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="label-meta">PATTERN</p>
          <div
            className={`toggle-switch sm ${params.patternEnabled ? 'on' : ''}`}
            onClick={() => update({ patternEnabled: !params.patternEnabled })}
          ></div>
          <button
            onClick={() => {
              setCategory((pattern.category ?? 'piano') as PatternCategory);
              setBrowsing(true);
            }}
            className="analog-btn !text-[10px] !px-3 !py-[4px] min-w-[130px]"
            title="Choose a pattern"
          >
            {params.patternCustom ? 'EDITED' : pattern.name} ▾
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="label-meta whitespace-nowrap">BPM</span>
            <input
              type="number"
              min={MIN_BPM}
              max={MAX_BPM}
              value={params.patternBpm ?? 100}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v)) update({ patternBpm: Math.max(MIN_BPM, Math.min(MAX_BPM, v)) });
              }}
              className="w-14 bg-black text-[var(--accent)] border border-[#444] px-1 py-[2px] font-['Space_Mono'] text-[11px] rounded-sm outline-none"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="label-meta whitespace-nowrap">CHANGE</span>
            {['NEXT NOTE', 'NEXT BAR'].map((label, i) => (
              <button
                key={label}
                onClick={() => update({ patternChordChange: i })}
                title={i === 0
                  ? 'A new chord is heard on the very next note the pattern plays'
                  : 'A new chord is held back until the cycle starts again'}
                className={`analog-btn !text-[9px] !px-2 !py-[3px] ${(params.patternChordChange ?? 0) === i ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="label-meta whitespace-nowrap">RELEASE</span>
            <input
              type="range"
              min={10}
              max={400}
              step={5}
              value={params.patternRelease ?? 100}
              onChange={(e) => update({ patternRelease: parseInt(e.target.value, 10) })}
              title="How long the pattern's notes ring, as a percentage of their written length"
              className="range-sm w-20 accent-[var(--accent)]"
            />
            <span className="label-meta !text-[var(--accent)] w-9">{params.patternRelease ?? 100}%</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="label-meta whitespace-nowrap">GRID</span>
            {([['1/4', TICKS_PER_BEAT], ['1/8', TICKS_PER_BEAT / 2], ['1/8T', TICKS_PER_BEAT / 3],
               ['1/16', TICKS_PER_BEAT / 4], ['1/16T', TICKS_PER_BEAT / 6], ['1/32', TICKS_PER_BEAT / 8]] as const).map(([label, ticks]) => (
              <button
                key={label}
                onClick={() => update({ patternGrid: ticks })}
                className={`analog-btn !text-[9px] !px-1.5 !py-[3px] ${gridTicks === ticks ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => writePattern(randomPattern({
              density: params.patternRandomDensity ?? 45,
              overlap: params.patternRandomOverlap ?? 30,
            }))}
            className="analog-btn !text-[9px] !px-2 !py-[3px]"
            title="Build a new pattern with the density and overlap set below"
          >
            RANDOM
          </button>
          {params.patternCustom && (
            <button
              onClick={() => update({ patternCustom: null })}
              className="analog-btn !text-[9px] !px-2 !py-[3px]"
              title="Discard the edit and go back to the library pattern"
            >
              REVERT
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2" title="Play at a set level instead of at whatever the keys were struck at">
            <span className="label-meta whitespace-nowrap">FIXED VEL</span>
            <div
              className={`toggle-switch sm ${params.patternFixedVelocity ? 'on' : ''}`}
              onClick={() => update({ patternFixedVelocity: !params.patternFixedVelocity })}
            ></div>
            <input
              type="range" min={1} max={127}
              value={params.patternVelocity ?? 100}
              onChange={(e) => update({ patternVelocity: parseInt(e.target.value, 10) })}
              className={`range-sm w-20 accent-[var(--accent)] ${params.patternFixedVelocity ? '' : 'opacity-30'}`}
            />
            <span className="label-meta !text-[var(--accent)] w-6">{params.patternVelocity ?? 100}</span>
          </div>

          <div className="flex items-center gap-1" title="How many octaves of the chord the pattern can reach">
            <span className="label-meta whitespace-nowrap">SPREAD</span>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => update({ patternSpread: n })}
                className={`analog-btn !text-[9px] !px-2 !py-[3px] ${(params.patternSpread ?? 1) === n ? 'active' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2" title="Rotate which chord tone each voice plays, live">
            <span className="label-meta whitespace-nowrap">INVERSION</span>
            <input
              type="range" min={-4} max={4} step={1}
              value={params.patternInversion ?? 0}
              onChange={(e) => update({ patternInversion: parseInt(e.target.value, 10) })}
              className="range-sm w-20 accent-[var(--accent)]"
            />
            <span className="label-meta !text-[var(--accent)] w-5">{params.patternInversion ?? 0}</span>
          </div>

          <div className="flex items-center gap-2" title="Keep the cycle running between chords, so they need not be overlapped">
            <span className="label-meta whitespace-nowrap">GRACE</span>
            <div
              className={`toggle-switch sm ${params.patternGraceEnabled !== false ? 'on' : ''}`}
              onClick={() => update({ patternGraceEnabled: !(params.patternGraceEnabled !== false) })}
            ></div>
            <input
              type="range" min={0} max={1500} step={25}
              value={params.patternGraceMs ?? 350}
              onChange={(e) => update({ patternGraceMs: parseInt(e.target.value, 10) })}
              className={`range-sm w-20 accent-[var(--accent)] ${params.patternGraceEnabled !== false ? '' : 'opacity-30'}`}
            />
            <span className="label-meta !text-[var(--accent)] w-10">{params.patternGraceMs ?? 350}MS</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2" title="How much of the grid a generated pattern fills">
            <span className="label-meta whitespace-nowrap">DENSITY</span>
            <input
              type="range" min={0} max={100}
              value={params.patternRandomDensity ?? 45}
              onChange={(e) => update({ patternRandomDensity: parseInt(e.target.value, 10) })}
              className="range-sm w-16 accent-[var(--accent)]"
            />
            <span className="label-meta !text-[var(--accent)] w-6">{params.patternRandomDensity ?? 45}</span>
          </div>
          <div className="flex items-center gap-2" title="How often a generated pattern sounds voices together rather than alone">
            <span className="label-meta whitespace-nowrap">OVERLAP</span>
            <input
              type="range" min={0} max={100}
              value={params.patternRandomOverlap ?? 30}
              onChange={(e) => update({ patternRandomOverlap: parseInt(e.target.value, 10) })}
              className="range-sm w-16 accent-[var(--accent)]"
            />
            <span className="label-meta !text-[var(--accent)] w-6">{params.patternRandomOverlap ?? 30}</span>
          </div>
        </div>
      </div>

      {browsing && (
        <div
          className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-6"
          onClick={() => setBrowsing(false)}
        >
          <div
            className="module w-[760px] max-w-full max-h-[80vh] flex flex-col gap-3 !bg-[var(--surface)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="label-meta">CHOOSE A PATTERN</p>
              <button onClick={() => setBrowsing(false)} className="analog-btn !text-[9px] !px-2 !py-[3px]">CLOSE</button>
            </div>

            <div className="flex items-center gap-1">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`analog-btn !text-[10px] !px-3 !py-[5px] ${category === c.key ? 'active' : ''}`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-1 overflow-y-auto settings-scroll pr-1">
              {CHORD_PATTERNS.map((p, i) => ({ p, i }))
                .filter(({ p }) => (p.category ?? 'piano') === category)
                .map(({ p, i }) => (
                  <button
                    key={p.name}
                    onClick={() => { selectLibrary(i); setBrowsing(false); }}
                    className={`analog-btn !text-[9px] !px-1 !py-[7px] ${!params.patternCustom && (params.patternIndex ?? 0) === i ? 'active' : ''}`}
                  >
                    {p.name}
                  </button>
                ))}
            </div>

            <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
              HARP AND GUITAR PATTERNS SPREAD THEIR CHORDS RATHER THAN STRIKING THEM,
              AND LEAVE THE NOTES RINGING INTO ONE ANOTHER, WHICH IS WHAT THOSE
              INSTRUMENTS ACTUALLY DO. THEY WILL SOUND BEST WITH A LONG RELEASE.
            </p>
          </div>
        </div>
      )}

      {/* The roll. Voice 1 sits at the bottom, so the picture matches the chord:
          low notes low, high notes high. Clipped, because a note may run past
          the end of the cycle and ring into the next one — which is musical,
          but should not draw outside the grid. */}
      <div
        ref={gridRef}
        className="relative w-full h-[184px] bg-[var(--surface-deep)] border border-white/10 rounded-sm touch-none select-none overflow-hidden"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => addEvent(e as unknown as React.PointerEvent)}
      >
        {Array.from({ length: VOICES }, (_, row) => (
          <div
            key={row}
            className="absolute left-0 right-0 border-t border-white/5"
            style={{ top: `${(row / VOICES) * 100}%`, height: `${100 / VOICES}%` }}
          >
            <span className="absolute left-1 top-0 label-meta !text-[8px] opacity-60">{VOICES - row}</span>
          </div>
        ))}

        {(() => {
          const lines = Math.min(200, Math.round(totalTicks / gridTicks));
          const perBeat = TICKS_PER_BEAT / gridTicks;
          return Array.from({ length: lines + 1 }, (_, i) => (
            <div
              key={`g${i}`}
              className="absolute top-0 bottom-0 border-l"
              style={{
                left: `${(i / lines) * 100}%`,
                // The beat is drawn stronger than its subdivisions, so the bar
                // stays readable however fine the grid gets.
                borderColor: i % perBeat === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)',
              }}
            />
          ));
        })()}

        {phase !== null && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-white/80 pointer-events-none"
            style={{ left: `${phase * 100}%`, boxShadow: '0 0 6px rgba(255,255,255,0.5)' }}
          />
        )}

        {pattern.events.map((event: PatternEvent, index: number) => {
          const left = (event.start / totalTicks) * 100;
          const width = Math.max(1.2, (event.length / totalTicks) * 100);
          const voice = Math.max(1, Math.min(VOICES, event.voice));
          const top = ((VOICES - voice) / VOICES) * 100;
          return (
            <div
              key={index}
              onPointerDown={(e) => onPointerDown(e, index, 'move')}
              onDoubleClick={(e) => {
                e.stopPropagation();
                toggleHold(index);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                removeEvent(index);
              }}
              title="Drag to move, drag the right edge to lengthen, double-click to hold, right-click to remove"
              className="absolute rounded-[2px] border border-black/40 cursor-grab active:cursor-grabbing"
              style={{
                left: `${left}%`,
                // A held note runs to the end of the cycle, because that is
                // what it does: it is still sounding when the cycle comes round.
                width: event.hold ? `${Math.max(1.2, 100 - left)}%` : `${width}%`,
                top: `calc(${top}% + 3px)`,
                height: `calc(${100 / VOICES}% - 6px)`,
                // Louder events read as more solid, so the accents in a pattern
                // are visible at a glance rather than only audible. A held note
                // is drawn open, since it is sustaining rather than striking.
                background: event.hold
                  ? 'repeating-linear-gradient(90deg, rgba(240,160,32,0.5) 0 6px, rgba(240,160,32,0.22) 6px 12px)'
                  : `rgba(240, 160, 32, ${0.35 + (event.velocity / 127) * 0.65})`,
                borderStyle: event.hold ? 'dashed' : 'solid',
              }}
            >
              {(event.octave || event.semitones) ? (
                <span className="absolute left-[3px] top-0 bottom-0 flex items-center text-black/80 font-['Space_Mono'] text-[8px] leading-none pointer-events-none">
                  {(() => {
                    const total = 12 * (event.octave ?? 0) + (event.semitones ?? 0);
                    return total > 0 ? `+${total}` : `${total}`;
                  })()}
                </span>
              ) : null}
              <div
                onPointerDown={(e) => onPointerDown(e, index, 'length')}
                className="absolute top-0 right-0 bottom-0 w-[6px] cursor-ew-resize"
              />
            </div>
          );
        })}
      </div>

      <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
        VOICE 1 IS THE LOWEST NOTE OF WHATEVER CHORD IS PLAYING. A PATTERN NAMING MORE
        SPREAD REPEATS THE CHORD'S TONES UPWARD, SO VOICE 4 ON A THREE-NOTE CHORD
        BECOMES THE ROOT AN OCTAVE HIGHER — THE SAME NOTES, MORE RUNGS TO PLAY THEM
        ON. AT SPREAD 1 A PATTERN NAMING MORE VOICES THAN THE CHORD HAS WRAPS ROUND
        IN PLACE INSTEAD. DOUBLE-CLICK TO ADD, DRAG TO MOVE,
        DRAG THE RIGHT EDGE TO LENGTHEN, RIGHT-CLICK TO REMOVE.
        SHIFT-CLICK AND ALT-CLICK MOVE A NOTE AN OCTAVE UP OR DOWN; CMD-DRAG UP AND
        DOWN TRANSPOSES IT BY SEMITONES. RELEASE SETS HOW LONG EVERY NOTE RINGS AND
        IS DELIBERATELY NOT DRAWN, SO THE EDITOR STAYS READABLE.
        FIXED VEL PLAYS AT A SET LEVEL WHATEVER THE KEYS WERE STRUCK AT, WITH THE
        PATTERN'S OWN ACCENTS RIDING ON IT. INVERSION ROTATES WHICH CHORD TONE EACH
        VOICE PLAYS AND WRAPS UP AN OCTAVE PAST THE TOP. GRACE KEEPS THE CYCLE
        RUNNING BETWEEN CHORDS SO THEY NEED NOT BE OVERLAPPED. DOUBLE-CLICK A NOTE TO HOLD IT: A HELD NOTE
        RINGS ON INSTEAD OF BEING STRUCK AGAIN EACH CYCLE, SO THE REST OF THE PATTERN
        MOVES OVER A CHORD THAT STAYS DOWN.
        CHANGE: NEXT NOTE SWAPS THE CHORD ON THE VERY NEXT NOTE THE PATTERN PLAYS —
        NEXT BAR HOLDS IT BACK UNTIL THE CYCLE STARTS AGAIN, SO THE CHANGE ALWAYS
        LANDS ON THE DOWNBEAT.
      </p>
    </div>
  );
};
