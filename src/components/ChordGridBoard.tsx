import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  CHORD_ROWS, GridCell, RootOrder, buildChordGrid, cellAt, cellHoldsNotes, rootName, slideActions,
} from '../lib/ChordGrid';
import { haptic, hapticLabelProps } from '../lib/Haptics';
import { AXIS_REST, AxisStore } from '../lib/AxisStore';

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
   * On, a chord sounds while its button is held. Off, a press latches it: the
   * same button again lets it go, another button takes over from it.
   */
  momentary: boolean;
  /**
   * How long a chord goes on sounding after it is let go. Press the next one
   * inside that and it glides from this one; miss it and it strikes fresh.
   */
  graceMs: number;
  /** Send the controllers back to the middle when the grace window runs out. */
  graceCcReset: boolean;
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
  momentary: true,
  graceMs: 150,
  graceCcReset: false,
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
  /** Shared with the XY pad, so the two never disagree about where they are. */
  axisStore: AxisStore;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
}

const COLUMNS = 12;

/**
 * The axes as they stand, always on screen.
 *
 * Its own component and its own subscription: the board around it is 144
 * buttons, and re-rendering those to move two numbers seventy times a second
 * is what made the old floating readout flicker.
 */
const AxisReadout: React.FC<{ store: AxisStore; ccY: number; ccX: number }> = ({ store, ccY, ccX }) => {
  const axis = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (
    <span className="flex items-center gap-2 px-2 py-[3px] border border-white/10 bg-[var(--surface-deep)]
                     font-['Space_Mono'] text-[10px] text-[var(--accent)] tabular-nums whitespace-nowrap">
      <span>CC{ccY} · {String(Math.round(axis.y)).padStart(3, ' ')}</span>
      <span className="opacity-40">|</span>
      <span>CC{ccX} · {String(Math.round(axis.x)).padStart(3, ' ')}</span>
    </span>
  );
};

export const ChordGridBoard: React.FC<ChordGridBoardProps> = ({
  settings, onSettings, onChord, onExpression, onMapCC, axisStore, fullScreen, onToggleFullScreen,
}) => {
  const surface = useRef<HTMLDivElement | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showRndm, setShowRndm] = useState(false);
  const [wanted, setWanted] = useState<number[]>([]);
  const [lit, setLit] = useState<Set<string>>(new Set());

  // Where the two axes stand, shared with the XY pad. Read through the store
  // rather than held here, so a chord picked up after the pad was moved
  // continues from the pad's value instead of from its own idea of it.
  const axis = axisStore;

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
  // A chord still sounding after its finger left, waiting out the grace window.
  const pending = useRef<{ cell: GridCell; timer: ReturnType<typeof setTimeout> } | null>(null);
  // The chord a press has latched on, when the board is not momentary.
  const latched = useRef<GridCell | null>(null);

  const chordRef = useRef(onChord);
  useEffect(() => { chordRef.current = onChord; });

  const relight = useCallback(() => {
    const on = new Set([...touches.current.values()].map(t => `${t.cell.column}:${t.cell.row}`));
    if (latched.current) on.add(`${latched.current.column}:${latched.current.row}`);
    setLit(on);
  }, []);

  const startChord = useCallback((cell: GridCell, isUpdate = false) => {
    onChord(cell.rootPitch, settings.velocity, true, cell.intervals, isUpdate);
    // Restate where the axes were left, so the new chord starts there instead
    // of at whatever the engine hands a fresh note.
    if (settings.ccEnabled) {
      onExpression(cell.rootPitch,
        [[settings.ccY, axis.get().y], [settings.ccX, axis.get().x]], settings.ccPerVoice);
    }
  }, [onChord, onExpression, settings.velocity, settings.ccEnabled, settings.ccPerVoice,
    settings.ccY, settings.ccX]);

  const stopChord = useCallback((cell: GridCell) => {
    onChord(cell.rootPitch, 0, false, cell.intervals, false);
  }, [onChord]);

  /** Put the axes back where they rest, and say so. */
  const resetAxes = useCallback(() => {
    const moved = axis.reset();
    if (!settings.ccEnabled || moved.length === 0) return;
    onExpression(0, [[settings.ccY, AXIS_REST], [settings.ccX, AXIS_REST]], false);
  }, [axis, settings.ccEnabled, settings.ccY, settings.ccX, onExpression]);

  /**
   * Let a chord go, after the grace window rather than at once.
   *
   * Holding the release is what makes a glide between two separate presses
   * possible at all: the old chord has to still be sounding when the new one
   * arrives for the engine to have anything to bend across from.
   */
  const letGo = useCallback((cell: GridCell) => {
    const finish = () => {
      stopChord(cell);
      pending.current = null;
      if (settings.graceCcReset) resetAxes();
    };
    if (settings.graceMs <= 0) { finish(); return; }
    if (pending.current) { clearTimeout(pending.current.timer); stopChord(pending.current.cell); }
    pending.current = { cell, timer: setTimeout(finish, settings.graceMs) };
  }, [stopChord, settings.graceMs, settings.graceCcReset, resetAxes]);

  /**
   * Take a chord, from silence or from whatever is still ringing.
   *
   * A chord inside its grace window is not gone yet, so this is the same
   * question as sliding between two buttons — which `slideActions` already
   * answers, including the same-root case the engine wants stated as an update.
   */
  const takeChord = useCallback((cell: GridCell) => {
    const waiting = pending.current;
    if (waiting) {
      clearTimeout(waiting.timer);
      pending.current = null;
      if (waiting.cell === cell) return; // still sounding; simply keep it
      for (const action of slideActions(waiting.cell, cell, settings.slideMode)) {
        if (action.do === 'start') startChord(action.cell);
        else if (action.do === 'update') startChord(action.cell, true);
        else stopChord(action.cell);
      }
      return;
    }
    startChord(cell);
  }, [settings.slideMode, startChord, stopChord]);

  const press = useCallback((pointerId: number, cell: GridCell, x: number, y: number) => {
    // Latched: a press takes the chord over from whatever is held, and the same
    // button twice lets it go.
    if (!settings.momentary) {
      const held = latched.current;
      if (held && held.column === cell.column && held.row === cell.row) {
        latched.current = null;
        letGo(cell);
        relight();
        haptic('release');
        return;
      }
      if (held) {
        for (const action of slideActions(held, cell, settings.slideMode)) {
          if (action.do === 'start') startChord(action.cell);
          else if (action.do === 'update') startChord(action.cell, true);
          else stopChord(action.cell);
        }
      } else {
        takeChord(cell);
      }
      latched.current = cell;
      touches.current.set(pointerId, {
        cell, x, y, baseX: axis.get().x, baseY: axis.get().y, sent: 0,
      });
      haptic('tap');
      relight();
      return;
    }

    touches.current.set(pointerId, {
      cell, x, y, baseX: axis.get().x, baseY: axis.get().y, sent: 0,
    });
    takeChord(cell);
    haptic('tap');
    relight();
  }, [settings.momentary, settings.slideMode, axis, takeChord, letGo, startChord, stopChord, relight]);

  const release = useCallback((pointerId: number) => {
    const touch = touches.current.get(pointerId);
    if (!touch) return;
    touches.current.delete(pointerId);
    // Latched, the finger leaving means nothing: the chord is held by the
    // button, not by the hand.
    if (settings.momentary) letGo(touch.cell);
    relight();
  }, [settings.momentary, letGo, relight]);

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
        const y = touch.baseY - ((clientY - touch.y) / (rect.height / 2)) * 64;
        const x = touch.baseX + ((clientX - touch.x) / (rect.width / 2)) * 64;
        const moved = axis.set({ x, y });
        if (moved.length) {
          const now2 = axis.get();
          onExpression(touch.cell.rootPitch,
            moved.map(k => (k === 'y' ? [settings.ccY, now2.y] : [settings.ccX, now2.x])),
            settings.ccPerVoice);
        }
      }
    }

    // In GLIDE a held finger says nothing about which chord is playing. Dragging
    // across the board used to walk through every button it crossed, which on a
    // twelve by twelve grid is a cascade of chord changes nobody asked for — so
    // the chord is decided by presses, and the finger only moves the
    // controllers. RESTRIKE keeps the old behaviour, where crossing a button is
    // the point.
    if (settings.slideMode === 'glide') return;
    // A latched chord belongs to its button too, not to the finger.
    if (!settings.momentary) return;

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
  }, [settings.slideMode, settings.momentary, settings.ccEnabled, settings.ccPerVoice,
    settings.ccX, settings.ccY, axis, byPosition, rows, startChord, stopChord,
    onExpression, relight]);

  // Deliberately no dependencies: this runs when the board is genuinely put
  // away, and at no other time.
  useEffect(() => () => {
    for (const touch of touches.current.values()) {
      chordRef.current(touch.cell.rootPitch, 0, false, touch.cell.intervals, false);
    }
    touches.current.clear();
    if (pending.current) {
      clearTimeout(pending.current.timer);
      const cell = pending.current.cell;
      chordRef.current(cell.rootPitch, 0, false, cell.intervals, false);
      pending.current = null;
    }
    if (latched.current) {
      const cell = latched.current;
      chordRef.current(cell.rootPitch, 0, false, cell.intervals, false);
      latched.current = null;
    }
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
          GRID OPTIONS
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
            : 'SLIDE: GLIDE'}
          {settings.momentary ? '' : ' · LATCH'}

        </span>

        <div className="flex items-center gap-1 ml-auto">
          {settings.ccEnabled && (
            <AxisReadout store={axisStore} ccY={settings.ccY} ccX={settings.ccX} />
          )}
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
              : 'PRESSING THE NEXT CHORD BENDS THE VOICES INTO IT. A HELD FINGER ONLY MOVES THE AXES — IT DOES NOT WALK THROUGH THE BUTTONS IT CROSSES. NEEDS MPE ON; ANY GLIDE MODE WILL DO.'}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">HOLD</span>
            <button
              onPointerDown={() => { haptic('tap'); change({ momentary: !settings.momentary }); }}
              className={`analog-btn !px-3 !py-[6px] !text-[9px] ${settings.momentary ? 'active' : ''}`}
              title="On, a chord sounds while held. Off, a press latches it until pressed again."
              {...hapticLabelProps()}
            >{settings.momentary ? 'MOMENTARY' : 'LATCH'}</button>

            <span className="text-[9px] tracking-[0.18em] opacity-70 ml-3">GRACE</span>
            <input
              type="range" min={0} max={1000} step={10}
              value={settings.graceMs}
              onChange={(e) => change({ graceMs: parseInt(e.target.value, 10) })}
              className="flex-1"
            />
            <span className="text-[11px] text-[var(--accent)] w-12 text-right tabular-nums">
              {settings.graceMs === 0 ? 'OFF' : `${settings.graceMs}MS`}
            </span>
          </div>
          <p className="text-[8px] leading-tight opacity-50 tracking-[0.06em] -mt-1">
            HOW LONG A CHORD GOES ON SOUNDING AFTER IT IS LET GO. PRESS THE NEXT ONE INSIDE
            THAT AND IT GLIDES FROM THIS ONE; MISS IT AND IT STRIKES FRESH.
          </p>

          {settings.ccEnabled && settings.graceMs > 0 && (
            <div className="fade-in flex items-center gap-2">
              <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">GRACE CC</span>
              <button
                onPointerDown={() => { haptic('tap'); change({ graceCcReset: !settings.graceCcReset }); }}
                className={`analog-btn !px-3 !py-[6px] !text-[9px] ${settings.graceCcReset ? 'active' : ''}`}
                title="Send the axes back to the middle when the grace window runs out"
                {...hapticLabelProps()}
              >GRACE CC RESET</button>
              <span className="text-[8px] opacity-50 tracking-[0.06em]">
                {settings.graceCcReset
                  ? 'THE AXES RETURN TO 64 WHEN THE WINDOW CLOSES.'
                  : 'THE AXES STAY WHERE THEY WERE LEFT.'}
              </span>
            </div>
          )}

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
