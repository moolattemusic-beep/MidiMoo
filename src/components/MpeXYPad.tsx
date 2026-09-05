import React, { useCallback, useRef, useSyncExternalStore } from 'react';
import { AxisStore, AxisValues } from '../lib/AxisStore';
import { haptic } from '../lib/Haptics';

interface MpeXYPadProps {
  store: AxisStore;
  ccY: number;
  ccX: number;
  /** Send the axes as they stand. Channel 1, since no chord need be sounding. */
  onSend: (ccs: Array<[number, number]>) => void;
}

/**
 * The two controller axes as a pad, so they can be moved without a chord under
 * a finger — set the sound up first, then play.
 *
 * Touching sets the values outright rather than nudging them from where they
 * were: a pad is a place, and a finger landing halfway up should mean halfway,
 * not "a little more than last time". That is the opposite of the chord grid,
 * where a finger is already busy holding a chord and can only offer its travel.
 */
export const MpeXYPad: React.FC<MpeXYPadProps> = ({ store, ccY, ccX, onSend }) => {
  const surface = useRef<HTMLDivElement | null>(null);
  const axis: AxisValues = useSyncExternalStore(store.subscribe, store.get, store.get);
  const sent = useRef(0);

  const apply = useCallback((clientX: number, clientY: number, force = false) => {
    const el = surface.current;
    if (!el) return;
    const now = performance.now();
    if (!force && now - sent.current < 14) return;
    sent.current = now;

    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 127;
    // Up is more, as every other vertical control here reads.
    const y = (1 - (clientY - rect.top) / rect.height) * 127;
    const moved = store.set({ x, y });
    if (moved.length === 0) return;
    const now2 = store.get();
    onSend(moved.map(k => (k === 'y' ? [ccY, now2.y] : [ccX, now2.x])));
  }, [store, ccY, ccX, onSend]);

  return (
    <div className="h-full flex flex-col gap-1 min-h-0">
      <div className="flex items-center justify-between shrink-0 px-[2px]">
        <span className="text-[9px] tracking-[0.16em] opacity-60">MPE XY</span>
        <span className="font-['Space_Mono'] text-[9px] text-[var(--accent)] tabular-nums">
          {Math.round(axis.x)} · {Math.round(axis.y)}
        </span>
      </div>

      <div
        ref={surface}
        className="relative flex-1 min-h-0 bg-[var(--surface-deep)] border border-white/10 overflow-hidden"
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
        onPointerDown={(e) => {
          e.preventDefault();
          try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* synthetic ids */ }
          haptic('tap');
          apply(e.clientX, e.clientY, true);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0 && e.pointerType === 'mouse') return;
          apply(e.clientX, e.clientY);
        }}
      >
        {/* Where the axes rest, so the middle is findable without looking. */}
        <div className="absolute inset-x-0 top-1/2 border-t border-white/10 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/2 border-l border-white/10 pointer-events-none" />

        <div
          className="absolute w-5 h-5 -ml-[10px] -mt-[10px] rounded-full border-2 border-[var(--accent)] bg-[var(--accent)]/25 pointer-events-none"
          style={{ left: `${(axis.x / 127) * 100}%`, top: `${(1 - axis.y / 127) * 100}%` }}
        />

        <span className="absolute bottom-[2px] left-1 text-[8px] tracking-[0.14em] opacity-40 pointer-events-none">
          CC{ccX} →
        </span>
        <span
          className="absolute bottom-1 right-[2px] text-[8px] tracking-[0.14em] opacity-40 pointer-events-none"
          style={{ writingMode: 'vertical-rl' }}
        >
          CC{ccY} ↑
        </span>
      </div>
    </div>
  );
};
