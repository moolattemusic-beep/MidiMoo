import React, { useRef, useState } from 'react';
import { OrchidParams } from '../types';
import { OrchidEngine } from '../lib/OrchidEngine';
import {
  CHORD_PATTERNS,
  ChordPattern,
  PatternEvent,
  TICKS_PER_BEAT,
  randomPattern,
} from '../lib/ChordPatterns';

const VOICES = 5;
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
  | null;

export const PatternEditor: React.FC<Props> = ({ params, setParams, engine }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag>(null);

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

  // A sixteenth is the finest useful placement here, and snapping is what makes
  // dragging by hand produce something playable rather than approximately right.
  const snap = (ticks: number) => Math.round(ticks / (TICKS_PER_BEAT / 4)) * (TICKS_PER_BEAT / 4);

  const onPointerDown = (e: React.PointerEvent, index: number, kind: 'move' | 'length') => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const event = pattern.events[index];
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
    } else {
      event.length = Math.max(TICKS_PER_BEAT / 8, snap(ticksFromClientX(e.clientX) - event.start));
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
      events: [...pattern.events, { voice, start, length: TICKS_PER_BEAT / 2, velocity: 96 }],
    });
  };

  const removeEvent = (index: number) => {
    writePattern({ ...pattern, events: pattern.events.filter((_, i) => i !== index) });
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
          <span className="label-meta !text-[var(--accent)] whitespace-nowrap">
            {params.patternCustom ? 'EDITED' : pattern.name}
          </span>
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
            {['NOW', 'BAR'].map((label, i) => (
              <button
                key={label}
                onClick={() => update({ patternChordChange: i })}
                title={i === 0
                  ? 'A new chord takes effect where the pattern already is'
                  : 'A new chord waits for the cycle to come round'}
                className={`analog-btn !text-[9px] !px-2 !py-[3px] ${(params.patternChordChange ?? 0) === i ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => writePattern(randomPattern())}
            className="analog-btn !text-[9px] !px-2 !py-[3px]"
            title="Build a new pattern"
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

      <div className="grid grid-cols-10 gap-1">
        {CHORD_PATTERNS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => selectLibrary(i)}
            className={`analog-btn !text-[8px] !px-1 !py-[4px] ${!params.patternCustom && (params.patternIndex ?? 0) === i ? 'active' : ''}`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* The roll. Voice 1 sits at the bottom, so the picture matches the chord:
          low notes low, high notes high. Clipped, because a note may run past
          the end of the cycle and ring into the next one — which is musical,
          but should not draw outside the grid. */}
      <div
        ref={gridRef}
        className="relative w-full h-[120px] bg-[var(--surface-deep)] border border-white/10 rounded-sm touch-none select-none overflow-hidden"
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

        {Array.from({ length: beats * 4 + 1 }, (_, i) => (
          <div
            key={`g${i}`}
            className="absolute top-0 bottom-0 border-l"
            style={{
              left: `${(i / (beats * 4)) * 100}%`,
              borderColor: i % 4 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)',
            }}
          />
        ))}

        {pattern.events.map((event: PatternEvent, index: number) => {
          const left = (event.start / totalTicks) * 100;
          const width = Math.max(1.2, (event.length / totalTicks) * 100);
          const voice = Math.max(1, Math.min(VOICES, event.voice));
          const top = ((VOICES - voice) / VOICES) * 100;
          return (
            <div
              key={index}
              onPointerDown={(e) => onPointerDown(e, index, 'move')}
              onContextMenu={(e) => {
                e.preventDefault();
                removeEvent(index);
              }}
              title="Drag to move, drag the right edge to lengthen, right-click to remove"
              className="absolute rounded-[2px] border border-black/40 cursor-grab active:cursor-grabbing"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: `calc(${top}% + 3px)`,
                height: `calc(${100 / VOICES}% - 6px)`,
                // Louder events read as more solid, so the accents in a pattern
                // are visible at a glance rather than only audible.
                background: `rgba(240, 160, 32, ${0.35 + (event.velocity / 127) * 0.65})`,
              }}
            >
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
        VOICES THAN THE CHORD HAS WRAPS ROUND. DOUBLE-CLICK TO ADD, DRAG TO MOVE,
        DRAG THE RIGHT EDGE TO LENGTHEN, RIGHT-CLICK TO REMOVE.
      </p>
    </div>
  );
};
