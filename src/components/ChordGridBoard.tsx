import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHORD_ROWS, GridCell, RootOrder, buildChordGrid, cellAt, rootName, slideActions,
} from '../lib/ChordGrid';
import { haptic, hapticLabelProps } from '../lib/Haptics';

export interface GridSettings {
  order: RootOrder;
  /** How many quality rows are on screen; fewer means bigger buttons. */
  visibleRows: number;
  baseOctave: number;
  velocity: number;
  /**
   * What a finger does after the chord has started.
   *   off   — sliding to another button changes chord, struck afresh.
   *   cc74  — the chord holds and up-and-down movement sends MPE timbre.
   *   glide — sliding changes chord, and the voices bend into the new one
   *           instead of being restruck.
   */
  slideMode: 'off' | 'cc74' | 'glide';
}

export const defaultGridSettings: GridSettings = {
  order: 'fifths',
  visibleRows: CHORD_ROWS.length,
  baseOctave: 4,
  velocity: 100,
  slideMode: 'off',
};

interface ChordGridBoardProps {
  settings: GridSettings;
  onSettings: (next: GridSettings) => void;
  /** A whole chord, by its root and the notes it is built from. */
  onChord: (rootPitch: number, velocity: number, isOn: boolean, intervals: number[]) => void;
  /** Timbre for whatever a held button is sounding. */
  onExpression: (rootPitch: number, timbre: number) => void;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
}

const COLUMNS = 12;

export const ChordGridBoard: React.FC<ChordGridBoardProps> = ({
  settings, onSettings, onChord, onExpression, fullScreen, onToggleFullScreen,
}) => {
  const surface = useRef<HTMLDivElement | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [lit, setLit] = useState<Set<string>>(new Set());

  const rows = Math.max(1, Math.min(CHORD_ROWS.length, settings.visibleRows));
  const grid = useMemo(
    () => buildChordGrid({ order: settings.order, rows: CHORD_ROWS.slice(0, rows), baseOctave: settings.baseOctave }),
    [settings.order, settings.baseOctave, rows]);

  const byPosition = useMemo(() => {
    const map = new Map<string, GridCell>();
    for (const cell of grid) map.set(`${cell.column}:${cell.row}`, cell);
    return map;
  }, [grid]);

  // What each finger is holding, and where it landed, so travel is measured
  // from the button rather than from wherever the finger has got to.
  const touches = useRef<Map<number, { cell: GridCell; y: number; sent: number }>>(new Map());

  // The callback identity changes on every render of the remote; the cleanup
  // below means "on unmount" and must not read that as the board going away.
  const chordRef = useRef(onChord);
  useEffect(() => { chordRef.current = onChord; });

  const relight = useCallback(() => {
    setLit(new Set([...touches.current.values()].map(t => `${t.cell.column}:${t.cell.row}`)));
  }, []);

  const startChord = useCallback((cell: GridCell) => {
    onChord(cell.rootPitch, settings.velocity, true, cell.intervals);
  }, [onChord, settings.velocity]);

  const stopChord = useCallback((cell: GridCell) => {
    onChord(cell.rootPitch, 0, false, cell.intervals);
  }, [onChord]);

  const press = useCallback((pointerId: number, cell: GridCell, y: number) => {
    touches.current.set(pointerId, { cell, y, sent: 0 });
    startChord(cell);
    haptic('tap');
    relight();
  }, [startChord, relight]);

  const release = useCallback((pointerId: number) => {
    const touch = touches.current.get(pointerId);
    if (!touch) return;
    touches.current.delete(pointerId);
    stopChord(touch.cell);
    relight();
  }, [stopChord, relight]);

  const move = useCallback((pointerId: number, clientX: number, clientY: number) => {
    const touch = touches.current.get(pointerId);
    const el = surface.current;
    if (!touch || !el) return;
    const rect = el.getBoundingClientRect();

    if (settings.slideMode === 'cc74') {
      // The button is kept; only the travel is heard. Sending on every move
      // would be a message a frame or faster, which the ear cannot use.
      const now = performance.now();
      if (now - touch.sent < 14) return;
      touch.sent = now;
      const span = rect.height / 2;
      const timbre = Math.max(0, Math.min(127, 64 - ((clientY - touch.y) / span) * 64));
      onExpression(touch.cell.rootPitch, timbre);
      return;
    }

    const hit = cellAt(clientX - rect.left, clientY - rect.top, rect.width, rect.height, COLUMNS, rows);
    if (!hit) return;
    const next = byPosition.get(`${hit.column}:${hit.row}`);
    if (!next || next === touch.cell) return;

    // The ordering is the substance of the two modes, and it lives in the
    // library where it is tested rather than being spelled out here.
    for (const action of slideActions(touch.cell, next, settings.slideMode)) {
      if (action.do === 'start') startChord(action.cell);
      else stopChord(action.cell);
    }
    touch.cell = next;
    touch.y = clientY;
    haptic('tap');
    relight();
  }, [settings.slideMode, byPosition, rows, startChord, stopChord, onExpression, relight]);

  // Deliberately no dependencies: this runs when the board is genuinely put
  // away, and at no other time.
  useEffect(() => () => {
    for (const touch of touches.current.values()) {
      chordRef.current(touch.cell.rootPitch, 0, false, touch.cell.intervals);
    }
    touches.current.clear();
  }, []);

  const change = (patch: Partial<GridSettings>) => onSettings({ ...settings, ...patch });

  return (
    <div className={`flex flex-col gap-2 min-h-0 ${fullScreen ? 'fixed inset-0 z-40 bg-[var(--surface-deep)] p-2' : 'flex-1'}`}>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onPointerDown={() => { haptic('tap'); setShowSetup(v => !v); }}
          className={`analog-btn !px-3 !py-[6px] !text-[10px] tracking-[0.14em] ${showSetup ? 'active' : ''}`}
          {...hapticLabelProps()}
        >
          {settings.order === 'fifths' ? 'FIFTHS' : 'CHROMATIC'}
        </button>
        <span className="text-[9px] tracking-[0.16em] opacity-50">
          {settings.slideMode === 'off' ? 'SLIDE: RESTRIKE'
            : settings.slideMode === 'cc74' ? 'SLIDE: CC74' : 'SLIDE: GLIDE'}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onPointerDown={() => { haptic('step'); change({ visibleRows: Math.max(3, rows - 1) }); }}
            className="analog-btn !px-3 !py-[6px] !text-[13px] leading-none" {...hapticLabelProps()}
          >−</button>
          <span className="text-[10px] text-[var(--accent)] w-12 text-center tabular-nums">{rows} ROWS</span>
          <button
            onPointerDown={() => { haptic('step'); change({ visibleRows: Math.min(CHORD_ROWS.length, rows + 1) }); }}
            className="analog-btn !px-3 !py-[6px] !text-[13px] leading-none" {...hapticLabelProps()}
          >+</button>
          <button
            onPointerDown={() => { haptic('tap'); onToggleFullScreen(); }}
            className={`analog-btn !px-3 !py-[6px] !text-[10px] ml-1 ${fullScreen ? 'active' : ''}`}
            {...hapticLabelProps()}
          >{fullScreen ? 'EXIT' : 'FULL'}</button>
        </div>
      </div>

      {showSetup && (
        <div className="shrink-0 flex flex-col gap-2 p-2 border border-white/10 bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">COLUMNS</span>
            {([['fifths', 'FIFTHS'], ['chromatic', 'CHROMATIC']] as const).map(([value, label]) => (
              <button
                key={value}
                onPointerDown={() => { haptic('tap'); change({ order: value }); }}
                className={`analog-btn !px-3 !py-[6px] !text-[9px] ${settings.order === value ? 'active' : ''}`}
                {...hapticLabelProps()}
              >{label}</button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">SLIDE</span>
            {([['off', 'RESTRIKE'], ['cc74', 'MPE CC74'], ['glide', 'MPE GLIDE']] as const).map(([value, label]) => (
              <button
                key={value}
                onPointerDown={() => { haptic('tap'); change({ slideMode: value }); }}
                className={`analog-btn !px-3 !py-[6px] !text-[9px] ${settings.slideMode === value ? 'active' : ''}`}
                {...hapticLabelProps()}
              >{label}</button>
            ))}
          </div>
          <p className="text-[8px] leading-tight opacity-50 tracking-[0.06em] -mt-1">
            {settings.slideMode === 'off'
              ? 'SLIDING TO ANOTHER CHORD STRIKES IT AFRESH.'
              : settings.slideMode === 'cc74'
              ? 'THE CHORD HOLDS; UP AND DOWN SENDS MPE TIMBRE ON CC74.'
              : 'SLIDING BENDS THE VOICES INTO THE NEW CHORD INSTEAD OF RESTRIKING. NEEDS MPE AND A GLIDE MODE ON.'}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">OCTAVE</span>
            <button
              onPointerDown={() => { haptic('step'); change({ baseOctave: Math.max(1, settings.baseOctave - 1) }); }}
              className="analog-btn !px-3 !py-[6px] !text-[11px]" {...hapticLabelProps()}
            >−</button>
            <span className="text-[11px] text-[var(--accent)] w-8 text-center tabular-nums">{settings.baseOctave}</span>
            <button
              onPointerDown={() => { haptic('step'); change({ baseOctave: Math.min(7, settings.baseOctave + 1) }); }}
              className="analog-btn !px-3 !py-[6px] !text-[11px]" {...hapticLabelProps()}
            >+</button>

            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16 ml-3">VELOCITY</span>
            <input
              type="range" min={1} max={127} step={1}
              value={settings.velocity}
              onChange={(e) => change({ velocity: parseInt(e.target.value, 10) })}
              className="flex-1"
            />
            <span className="text-[11px] text-[var(--accent)] w-8 text-right tabular-nums">{settings.velocity}</span>
          </div>
        </div>
      )}

      {/* One handler on the surface rather than one per button: the finger is
          captured here and the button under it worked out from the geometry,
          which is what lets a slide cross buttons without them fighting over
          the pointer. */}
      <div
        ref={surface}
        className="flex-1 min-h-0 grid gap-[2px] bg-[var(--surface-deep)] border border-white/10 p-[2px] overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          touchAction: 'none',
          // Sliding across the labels is the gesture iOS reads as selecting
          // text, and it answers with a highlight and the magnifier.
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        } as React.CSSProperties}
        onPointerDown={(e) => {
          const el = surface.current;
          if (!el) return;
          e.preventDefault();
          try { el.setPointerCapture(e.pointerId); } catch { /* synthetic ids */ }
          const rect = el.getBoundingClientRect();
          const hit = cellAt(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height, COLUMNS, rows);
          if (!hit) return;
          const cell = byPosition.get(`${hit.column}:${hit.row}`);
          if (cell) press(e.pointerId, cell, e.clientY);
        }}
        onPointerMove={(e) => move(e.pointerId, e.clientX, e.clientY)}
        onPointerUp={(e) => release(e.pointerId)}
        onPointerCancel={(e) => release(e.pointerId)}
      >
        {CHORD_ROWS.slice(0, rows).map((row, rowIndex) => (
          Array.from({ length: COLUMNS }, (_, column) => {
            const cell = byPosition.get(`${column}:${rowIndex}`);
            const on = lit.has(`${column}:${rowIndex}`);
            return (
              <div
                key={`${column}:${rowIndex}`}
                className={`flex flex-col items-center justify-center overflow-hidden pointer-events-none
                  ${on ? 'bg-[var(--accent)] text-black' : 'bg-white/[0.05] text-[var(--ink-dim)]'}`}
                style={{ borderRadius: 2 }}
              >
                <span
                  className="font-['Space_Mono'] leading-none"
                  style={{ fontSize: 'clamp(7px, 1.4vh, 13px)' }}
                >
                  {cell ? rootName(cell.rootClass, settings.order) : ''}
                </span>
                <span
                  className="leading-none tracking-[0.04em] opacity-70"
                  style={{ fontSize: 'clamp(6px, 1vh, 10px)' }}
                >
                  {row.label === 'MAJ' ? '' : row.label}
                </span>
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
};
