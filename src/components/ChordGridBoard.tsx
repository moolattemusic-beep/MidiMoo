import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHORD_ROWS, GridCell, RootOrder, buildChordGrid, cellAt, cellHoldsNotes, rootName, slideActions,
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
  /** Which controller each axis writes to, in the timbre mode. */
  ccY: number;
  ccX: number;
}

export const defaultGridSettings: GridSettings = {
  order: 'fifths',
  visibleRows: CHORD_ROWS.length,
  baseOctave: 4,
  velocity: 100,
  slideMode: 'off',
  // CC 74 is MPE's own third dimension, and CC 1 the mod wheel. Neither is CC
  // 11, which the glide engine uses on these channels for its own purposes.
  ccY: 74,
  ccX: 1,
};

interface ChordGridBoardProps {
  settings: GridSettings;
  onSettings: (next: GridSettings) => void;
  /**
   * A whole chord, by its root and the notes it is built from. `isUpdate`
   * re-states a chord already sounding on that key, which is how the engine
   * glides one chord into another that shares its root.
   */
  onChord: (rootPitch: number, velocity: number, isOn: boolean, intervals: number[], isUpdate: boolean) => void;
  /** Controller values for whatever a held button is sounding. */
  onExpression: (rootPitch: number, ccs: Array<[number, number]>) => void;
  /** Send a controller back and forth so a plugin can learn it. */
  onMapCC: (cc: number) => void;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
}

const COLUMNS = 12;

export const ChordGridBoard: React.FC<ChordGridBoardProps> = ({
  settings, onSettings, onChord, onExpression, onMapCC, fullScreen, onToggleFullScreen,
}) => {
  const surface = useRef<HTMLDivElement | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showRndm, setShowRndm] = useState(false);
  const [wanted, setWanted] = useState<number[]>([]);
  const [lit, setLit] = useState<Set<string>>(new Set());

  // Where the two axes were left. A new chord picks up from here rather than
  // snapping back to the middle, so releasing one button and pressing the next
  // does not put a step in the controller.
  const axis = useRef({ x: 64, y: 64 });

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
  const touches = useRef<Map<number, {
    cell: GridCell; x: number; y: number; baseX: number; baseY: number; sent: number;
  }>>(new Map());

  // The callback identity changes on every render of the remote; the cleanup
  // below means "on unmount" and must not read that as the board going away.
  const chordRef = useRef(onChord);
  useEffect(() => { chordRef.current = onChord; });

  const relight = useCallback(() => {
    setLit(new Set([...touches.current.values()].map(t => `${t.cell.column}:${t.cell.row}`)));
  }, []);

  const startChord = useCallback((cell: GridCell, isUpdate = false) => {
    onChord(cell.rootPitch, settings.velocity, true, cell.intervals, isUpdate);
    // Restate where the axes were left, so the new chord starts there instead
    // of at whatever the engine hands a fresh note.
    if (settings.slideMode === 'cc74') {
      onExpression(cell.rootPitch, [[settings.ccY, axis.current.y], [settings.ccX, axis.current.x]]);
    }
  }, [onChord, onExpression, settings.velocity, settings.slideMode, settings.ccY, settings.ccX]);

  const stopChord = useCallback((cell: GridCell) => {
    onChord(cell.rootPitch, 0, false, cell.intervals, false);
  }, [onChord]);

  const press = useCallback((pointerId: number, cell: GridCell, x: number, y: number) => {
    touches.current.set(pointerId, {
      cell, x, y, baseX: axis.current.x, baseY: axis.current.y, sent: 0,
    });
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
      // Measured from where the axes were left rather than from the middle, so
      // a finger continues the gesture the last one finished.
      const y = Math.max(0, Math.min(127, touch.baseY - ((clientY - touch.y) / (rect.height / 2)) * 64));
      const x = Math.max(0, Math.min(127, touch.baseX + ((clientX - touch.x) / (rect.width / 2)) * 64));
      axis.current = { x, y };
      onExpression(touch.cell.rootPitch, [[settings.ccY, y], [settings.ccX, x]]);
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
      else if (action.do === 'update') startChord(action.cell, true);
      else stopChord(action.cell);
    }
    touch.cell = next;
    touch.x = clientX;
    touch.y = clientY;
    haptic('tap');
    relight();
  }, [settings.slideMode, settings.ccX, settings.ccY, byPosition, rows,
    startChord, stopChord, onExpression, relight]);

  // Deliberately no dependencies: this runs when the board is genuinely put
  // away, and at no other time.
  useEffect(() => () => {
    for (const touch of touches.current.values()) {
      chordRef.current(touch.cell.rootPitch, 0, false, touch.cell.intervals, false);
    }
    touches.current.clear();
  }, []);

  const holding = useMemo(() => {
    if (wanted.length === 0) return new Set<string>();
    const out = new Set<string>();
    for (const cell of grid) {
      if (cellHoldsNotes(cell, wanted)) out.add(`${cell.column}:${cell.row}`);
    }
    return out;
  }, [grid, wanted]);

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
        <button
          onPointerDown={() => { haptic('tap'); setShowRndm(v => !v); }}
          className={`analog-btn !px-3 !py-[6px] !text-[10px] tracking-[0.14em] ${wanted.length ? 'active' : ''}`}
          {...hapticLabelProps()}
        >
          RNDM{wanted.length ? ` ${wanted.length}` : ''}
        </button>
        <span className="text-[9px] tracking-[0.16em] opacity-50">
          {settings.slideMode === 'off' ? 'SLIDE: RESTRIKE'
            : settings.slideMode === 'cc74' ? `Y CC${settings.ccY} / X CC${settings.ccX}` : 'SLIDE: GLIDE'}
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

      {showRndm && (
        <div className="shrink-0 flex flex-col gap-2 p-2 border border-white/10 bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70">NOTES EVERY CHORD MUST HOLD</span>
            <button
              onPointerDown={() => { haptic('tap'); setWanted([]); }}
              className="analog-btn !px-3 !py-[6px] !text-[9px] ml-auto" {...hapticLabelProps()}
            >CLEAR</button>
            <button
              onPointerDown={() => { haptic('tap'); setShowRndm(false); }}
              className="analog-btn !px-3 !py-[6px] !text-[9px]" {...hapticLabelProps()}
            >CLOSE</button>
          </div>
          <div className="grid grid-cols-12 gap-1">
            {Array.from({ length: 12 }, (_, pc) => (
              <button
                key={pc}
                onPointerDown={() => {
                  haptic('tap');
                  setWanted(prev => prev.includes(pc) ? prev.filter(n => n !== pc) : [...prev, pc]);
                }}
                className={`analog-btn !px-1 !py-[6px] !text-[9px] ${wanted.includes(pc) ? 'active' : ''}`}
                {...hapticLabelProps()}
              >{rootName(pc, 'chromatic')}</button>
            ))}
          </div>
          <p className="text-[8px] leading-tight opacity-50 tracking-[0.06em]">
            {wanted.length === 0
              ? 'CHOOSE THE NOTES A PROGRESSION HAS TO KEEP UNDER IT. EVERY CHORD WHOSE SCALE HOLDS ALL OF THEM IS MARKED.'
              : `${holding.size} OF ${grid.length} CHORDS HOLD ${wanted.map(n => rootName(n, 'chromatic')).join(' ')}.`}
          </p>
        </div>
      )}

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
            {([['off', 'RESTRIKE'], ['cc74', 'MPE CC'], ['glide', 'MPE GLIDE']] as const).map(([value, label]) => (
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
              ? `THE CHORD HOLDS. UP AND DOWN SENDS CC${settings.ccY}, SIDE TO SIDE CC${settings.ccX}, ON EACH VOICE'S OWN MPE CHANNEL. BOTH CARRY OVER TO THE NEXT CHORD RATHER THAN SNAPPING BACK.`
              : 'SLIDING BENDS THE VOICES INTO THE NEW CHORD INSTEAD OF RESTRIKING. NEEDS MPE AND A GLIDE MODE ON.'}
          </p>

          {settings.slideMode === 'cc74' && (
            <div className="fade-in flex flex-col gap-2">
              {([['Y', 'ccY', 'UP AND DOWN'], ['X', 'ccX', 'SIDE TO SIDE']] as const).map(([axisName, key, hint]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">{axisName} — {hint}</span>
                  <button
                    onPointerDown={() => { haptic('step'); change({ [key]: Math.max(0, settings[key] - 1) } as Partial<GridSettings>); }}
                    className="analog-btn !px-2 !py-[6px] !text-[11px]" {...hapticLabelProps()}
                  >−</button>
                  <span className="text-[11px] text-[var(--accent)] w-12 text-center tabular-nums">CC{settings[key]}</span>
                  <button
                    onPointerDown={() => { haptic('step'); change({ [key]: Math.min(127, settings[key] + 1) } as Partial<GridSettings>); }}
                    className="analog-btn !px-2 !py-[6px] !text-[11px]" {...hapticLabelProps()}
                  >+</button>
                  <button
                    onPointerDown={() => { haptic('tap'); onMapCC(settings[key]); }}
                    className="analog-btn !px-3 !py-[6px] !text-[9px]"
                    title="Send it back and forth so a plugin can learn it"
                    {...hapticLabelProps()}
                  >MAP</button>
                </div>
              ))}
            </div>
          )}

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
          if (cell) press(e.pointerId, cell, e.clientX, e.clientY);
        }}
        onPointerMove={(e) => move(e.pointerId, e.clientX, e.clientY)}
        onPointerUp={(e) => release(e.pointerId)}
        onPointerCancel={(e) => release(e.pointerId)}
      >
        {CHORD_ROWS.slice(0, rows).map((row, rowIndex) => (
          Array.from({ length: COLUMNS }, (_, column) => {
            const cell = byPosition.get(`${column}:${rowIndex}`);
            const on = lit.has(`${column}:${rowIndex}`);
            const holds = holding.has(`${column}:${rowIndex}`);
            return (
              <div
                key={`${column}:${rowIndex}`}
                className={`flex flex-col items-center justify-center overflow-hidden pointer-events-none
                  ${on ? 'bg-[var(--accent)] text-black'
                    : holds ? 'bg-[var(--accent)]/25 text-[var(--ink)]'
                    : wanted.length ? 'bg-white/[0.02] text-[var(--ink-dim)] opacity-40'
                    : 'bg-white/[0.05] text-[var(--ink-dim)]'}`}
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
