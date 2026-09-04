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
   * What crossing onto another button does: strike it afresh, or bend the
   * voices into it. Independent of the controllers below, because wanting a
   * chord to glide and wanting a finger to send CC are not alternatives.
   */
  slideMode: 'off' | 'glide';
  /** Whether a finger's travel also sends controllers. */
  ccEnabled: boolean;
  /**
   * On each voice's own MPE channel, or all on channel 1. Channel 1 is the
   * default because it is the one a DAW can learn: under MPE the voices are
   * spread across channels 2-15 and a mapping made on one of them would never
   * see the controller again.
   */
  ccPerVoice: boolean;
  ccY: number;
  ccX: number;
}

export const defaultGridSettings: GridSettings = {
  order: 'fifths',
  visibleRows: CHORD_ROWS.length,
  baseOctave: 4,
  velocity: 100,
  slideMode: 'off',
  ccEnabled: false,
  ccPerVoice: false,
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
  /** Controller values. `perVoice` puts them on each sounding voice's channel. */
  onExpression: (rootPitch: number, ccs: Array<[number, number]>, perVoice: boolean) => void;
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

  // What the axes last sent, shown over the board while a finger is moving
  // them. Without it there is no way to tell which controller is going out or
  // where it has got to, short of watching the receiving end.
  const [hud, setHud] = useState<Array<[number, number]> | null>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // It stays for as long as a finger is on the board, and lingers a moment
  // after: a readout that expired while the hand was still holding still would
  // vanish exactly when it was being read.
  const showHud = useCallback((ccs: Array<[number, number]>) => {
    if (hudTimer.current) { clearTimeout(hudTimer.current); hudTimer.current = null; }
    setHud(ccs);
  }, []);
  const fadeHud = useCallback(() => {
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHud(null), 1400);
  }, []);
  useEffect(() => () => { if (hudTimer.current) clearTimeout(hudTimer.current); }, []);

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
    if (settings.ccEnabled) {
      onExpression(cell.rootPitch,
        [[settings.ccY, axis.current.y], [settings.ccX, axis.current.x]], settings.ccPerVoice);
    }
  }, [onChord, onExpression, settings.velocity, settings.ccEnabled, settings.ccPerVoice,
    settings.ccY, settings.ccX]);

  const stopChord = useCallback((cell: GridCell) => {
    onChord(cell.rootPitch, 0, false, cell.intervals, false);
  }, [onChord]);

  const press = useCallback((pointerId: number, cell: GridCell, x: number, y: number) => {
    touches.current.set(pointerId, {
      cell, x, y, baseX: axis.current.x, baseY: axis.current.y, sent: 0,
    });
    startChord(cell);
    if (settings.ccEnabled) {
      showHud([[settings.ccY, axis.current.y], [settings.ccX, axis.current.x]]);
    }
    haptic('tap');
    relight();
  }, [startChord, relight, showHud, settings.ccEnabled, settings.ccY, settings.ccX]);

  const release = useCallback((pointerId: number) => {
    const touch = touches.current.get(pointerId);
    if (!touch) return;
    touches.current.delete(pointerId);
    stopChord(touch.cell);
    if (touches.current.size === 0) fadeHud();
    relight();
  }, [stopChord, relight, fadeHud]);

  const move = useCallback((pointerId: number, clientX: number, clientY: number) => {
    const touch = touches.current.get(pointerId);
    const el = surface.current;
    if (!touch || !el) return;
    const rect = el.getBoundingClientRect();

    if (settings.ccEnabled) {
      // Sending on every move would be a message a frame or faster, which the
      // ear cannot use and the link should not carry.
      const now = performance.now();
      if (now - touch.sent >= 14) {
        touch.sent = now;
        // Measured from where the axes were left rather than from the middle,
        // so a finger continues the gesture the last one finished.
        const y = Math.max(0, Math.min(127, touch.baseY - ((clientY - touch.y) / (rect.height / 2)) * 64));
        const x = Math.max(0, Math.min(127, touch.baseX + ((clientX - touch.x) / (rect.width / 2)) * 64));
        const moved: Array<[number, number]> = [];
        if (Math.round(y) !== Math.round(axis.current.y)) moved.push([settings.ccY, y]);
        if (Math.round(x) !== Math.round(axis.current.x)) moved.push([settings.ccX, x]);
        axis.current = { x, y };
        if (moved.length) {
          onExpression(touch.cell.rootPitch, moved, settings.ccPerVoice);
          showHud(moved);
        }
      }
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
    // Deliberately not moving the point the travel is measured from: the axes
    // follow the whole journey of the finger, and resetting it here pinned
    // them to however far it had come since the last button.
    haptic('tap');
    relight();
  }, [settings.slideMode, settings.ccEnabled, settings.ccPerVoice, settings.ccX, settings.ccY,
    byPosition, rows, startChord, stopChord, onExpression, relight, showHud]);

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
            : 'SLIDE: GLIDE'}{settings.ccEnabled ? ` · Y CC${settings.ccY} X CC${settings.ccX}` : ''}
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
            {([['off', 'RESTRIKE'], ['glide', 'MPE GLIDE']] as const).map(([value, label]) => (
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
              : 'SLIDING BENDS THE VOICES INTO THE NEW CHORD, DOWN A COLUMN AS WELL AS ACROSS. NEEDS MPE ON — ANY GLIDE MODE WILL DO.'}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">AXES</span>
            <button
              onPointerDown={() => { haptic('tap'); change({ ccEnabled: !settings.ccEnabled }); }}
              className={`analog-btn !px-3 !py-[6px] !text-[9px] ${settings.ccEnabled ? 'active' : ''}`}
              {...hapticLabelProps()}
            >SEND CC</button>
            {settings.ccEnabled && (
              <button
                onPointerDown={() => { haptic('tap'); change({ ccPerVoice: !settings.ccPerVoice }); }}
                className={`analog-btn !px-3 !py-[6px] !text-[9px] ${settings.ccPerVoice ? 'active' : ''}`}
                title="Per voice is true MPE but cannot be learned by a DAW"
                {...hapticLabelProps()}
              >{settings.ccPerVoice ? 'PER VOICE' : 'CHANNEL 1'}</button>
            )}
          </div>

          {settings.ccEnabled && (
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
              {settings.ccPerVoice && (
                <p className="text-[8px] leading-tight opacity-50 tracking-[0.06em]">
                  PER VOICE SPREADS THESE ACROSS MPE CHANNELS 2-15, SO A DAW CANNOT LEARN THEM:
                  A MAPPING MADE ON ONE CHANNEL NEVER SEES THEM AGAIN. USE CHANNEL 1 TO MAP.
                </p>
              )}
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
        className="relative flex-1 min-h-0 grid gap-[2px] bg-[var(--surface-deep)] border border-white/10 p-[2px] overflow-hidden"
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
        {hud && (
          <div className="absolute top-1 right-1 z-10 pointer-events-none flex flex-col items-end gap-[2px]
                          bg-black/80 border border-[var(--accent)] px-2 py-1 fade-in">
            {hud.map(([cc, value]) => (
              <span key={cc} className="font-['Space_Mono'] text-[11px] text-[var(--accent)] tabular-nums leading-none">
                CC{cc} · {Math.round(value)}
              </span>
            ))}
          </div>
        )}
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
