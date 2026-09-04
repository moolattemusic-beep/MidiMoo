import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HEX_LAYOUTS, HexBoardSpec, HexOrientation, buildHexBoard, continuousPitch,
  hexNoteFull, hexNoteName, hexPoints,
} from '../lib/HexBoard';
import { haptic, hapticLabelProps } from '../lib/Haptics';

export interface HexSettings {
  layoutIndex: number;
  rotation: number;
  mirrorLR: boolean;
  mirrorUD: boolean;
  /** Circumradius of a hexagon in pixels. The zoom control moves this. */
  radius: number;
  centreNote: number;
  velocity: number;
  /**
   * 0 holds the note for as long as the hex is pressed, like a keyboard.
   * Anything else makes each press a one-shot of that many milliseconds, which
   * a lifted finger does not cut short.
   */
  noteLengthMs: number;
  /**
   * What a finger does after the note has started.
   *   off — sliding retriggers each hex it crosses, a glissando.
   *   a   — the note stays, and the finger's travel becomes expression:
   *         sideways is pitch bend, up and down is MPE timbre.
   *   b   — the note stays and its pitch follows the finger exactly, so
   *         sliding towards a hex glides into it and arriving is in tune.
   */
  mpeMode: 'off' | 'a' | 'b';
  /** Semitones of bend at one hex's width sideways, in mode A. */
  mpeBendPerHex: number;
  /** Dim everything that is not the key's root, to navigate by. */
  markRoot: boolean;
}

export const defaultHexSettings: HexSettings = {
  layoutIndex: 0,
  rotation: 0,
  mirrorLR: false,
  mirrorUD: false,
  radius: 34,
  centreNote: 60,
  velocity: 100,
  noteLengthMs: 0,
  mpeMode: 'off',
  mpeBendPerHex: 2,
  markRoot: true,
};

const RADIUS_MIN = 16;
const RADIUS_MAX = 90;

interface HexKeyboardProps {
  settings: HexSettings;
  onSettings: (next: HexSettings) => void;
  /** Sent exactly as a plugged-in keyboard would: pitch, velocity, on/off. */
  onNote: (pitch: number, velocity: number, isOn: boolean) => void;
  /** Bend and timbre for whatever a held key is sounding. */
  onExpression: (sourceKey: number, bendSemitones: number, timbre?: number) => void;
  /** Pitch class the app is in, drawn brighter so the board can be read. */
  keyRoot: number;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
}

export const HexKeyboard: React.FC<HexKeyboardProps> = ({
  settings, onSettings, onNote, onExpression, keyRoot, fullScreen, onToggleFullScreen,
}) => {
  const surface = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // What each finger is currently holding, so lifting one releases only its own
  // note and sliding one moves from hex to hex without dropping the others.
  const held = useRef<Map<number, number>>(new Map());
  // Notes ringing on their own timer, in one-shot mode, keyed by pitch.
  const ringing = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [lit, setLit] = useState<Set<number>>(new Set());

  // The callback identity changes on every render of the remote, and the
  // release-everything cleanup below must not read that as the board going
  // away — doing so cut every held note at the next state push from the
  // instrument, about once a second.
  const noteRef = useRef(onNote);
  useEffect(() => { noteRef.current = onNote; });
  // Where each finger landed and what it started, so its travel can be
  // measured from there rather than from wherever it happens to be now.
  const origin = useRef<Map<number, { x: number; y: number; pitch: number; sent: number }>>(new Map());
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullScreen]);

  const orientation: HexOrientation = useMemo(
    () => ({ rotation: settings.rotation, mirrorLR: settings.mirrorLR, mirrorUD: settings.mirrorUD }),
    [settings.rotation, settings.mirrorLR, settings.mirrorUD]);

  const spec: HexBoardSpec = useMemo(() => ({
    width: size.w,
    height: size.h,
    radius: settings.radius,
    layout: HEX_LAYOUTS[settings.layoutIndex] ?? HEX_LAYOUTS[0],
    orientation,
    centreNote: settings.centreNote,
  }), [size.w, size.h, settings.radius, settings.layoutIndex, settings.centreNote, orientation]);

  const board = useMemo(() => buildHexBoard(spec), [spec]);

  /**
   * A finger that has moved. Mode B reads the pitch straight off the board at
   * the finger's position, so arriving over a hex is exactly in tune; mode A
   * measures how far it has travelled from where it started.
   */
  const moved = useCallback((pointerId: number, clientX: number, clientY: number) => {
    if (settings.mpeMode === 'off') return;
    const from = origin.current.get(pointerId);
    const el = surface.current;
    if (!from || !el) return;

    // Sending on every move would be a message a frame or faster; the ear
    // cannot hear the difference and the link should not carry it.
    const now = performance.now();
    if (now - from.sent < 14) return;
    from.sent = now;

    const rect = el.getBoundingClientRect();
    if (settings.mpeMode === 'b') {
      const here = continuousPitch(clientX - rect.left, clientY - rect.top, spec);
      onExpression(from.pitch, here - from.pitch);
      return;
    }

    const hexWidth = Math.sqrt(3) * Math.max(4, settings.radius);
    const bend = ((clientX - from.x) / hexWidth) * settings.mpeBendPerHex;
    // Up is brighter. Two hexes of travel covers the whole range, starting from
    // the middle so there is somewhere to go in both directions.
    const timbre = 64 - ((clientY - from.y) / (2 * 2 * Math.max(4, settings.radius))) * 64;
    onExpression(from.pitch, bend, Math.max(0, Math.min(127, timbre)));
  }, [settings.mpeMode, settings.radius, settings.mpeBendPerHex, spec, onExpression]);

  const relight = useCallback(() => {
    setLit(new Set([...held.current.values(), ...ringing.current.keys()]));
  }, []);

  const start = useCallback((pointerId: number, pitch: number) => {
    if (pitch < 0) return;
    const length = settings.noteLengthMs;

    if (length > 0) {
      // One-shot: the press decides the length, so lifting does not stop it and
      // sliding across the board leaves a trail of notes ringing out.
      const already = ringing.current.get(pitch);
      if (already) { clearTimeout(already); onNote(pitch, 0, false); }
      held.current.set(pointerId, pitch);
      onNote(pitch, settings.velocity, true);
      ringing.current.set(pitch, setTimeout(() => {
        ringing.current.delete(pitch);
        noteRef.current(pitch, 0, false);
        relight();
      }, length));
      haptic('tap');
      relight();
      return;
    }

    const already = held.current.get(pointerId);
    if (already === pitch) return;
    if (already !== undefined) onNote(already, 0, false);
    held.current.set(pointerId, pitch);
    onNote(pitch, settings.velocity, true);
    haptic('tap');
    relight();
  }, [onNote, settings.velocity, settings.noteLengthMs, relight]);

  const stop = useCallback((pointerId: number) => {
    const pitch = held.current.get(pointerId);
    if (pitch === undefined) return;
    held.current.delete(pointerId);
    // A note on its own timer is left to finish; only a held one is released.
    if (!ringing.current.has(pitch)) onNote(pitch, 0, false);
    relight();
  }, [onNote, relight]);

  // Every note goes off when the board is genuinely put away, or a hex left
  // down would sound until the next panic. Deliberately no dependencies: this
  // must run on unmount and at no other time.
  useEffect(() => () => {
    for (const pitch of held.current.values()) noteRef.current(pitch, 0, false);
    held.current.clear();
    for (const [pitch, timer] of ringing.current) {
      clearTimeout(timer);
      noteRef.current(pitch, 0, false);
    }
    ringing.current.clear();
  }, []);

  const change = (patch: Partial<HexSettings>) => onSettings({ ...settings, ...patch });
  const layout = HEX_LAYOUTS[settings.layoutIndex] ?? HEX_LAYOUTS[0];

  return (
    <div className={`flex flex-col gap-2 min-h-0 ${fullScreen ? 'fixed inset-0 z-40 bg-[var(--surface-deep)] p-2' : 'flex-1'}`}>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onPointerDown={() => { haptic('tap'); setShowSetup(v => !v); }}
          className={`analog-btn !px-3 !py-[6px] !text-[10px] tracking-[0.14em] ${showSetup ? 'active' : ''}`}
          {...hapticLabelProps()}
        >
          {layout.name}
        </button>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onPointerDown={() => { haptic('step'); change({ radius: Math.max(RADIUS_MIN, settings.radius - 5) }); }}
            className="analog-btn !px-3 !py-[6px] !text-[13px] leading-none"
            {...hapticLabelProps()}
          >−</button>
          <span className="text-[10px] text-[var(--accent)] w-10 text-center tabular-nums">
            {Math.round((settings.radius / defaultHexSettings.radius) * 100)}%
          </span>
          <button
            onPointerDown={() => { haptic('step'); change({ radius: Math.min(RADIUS_MAX, settings.radius + 5) }); }}
            className="analog-btn !px-3 !py-[6px] !text-[13px] leading-none"
            {...hapticLabelProps()}
          >+</button>
          <button
            onPointerDown={() => { haptic('tap'); onToggleFullScreen(); }}
            className={`analog-btn !px-3 !py-[6px] !text-[10px] ml-1 ${fullScreen ? 'active' : ''}`}
            {...hapticLabelProps()}
          >{fullScreen ? 'EXIT' : 'FULL'}</button>
        </div>
      </div>

      {showSetup && (
        <div className="shrink-0 flex flex-col gap-2 p-2 border border-white/10 bg-[var(--surface)] max-h-[46%] overflow-y-auto">
          <div className="grid grid-cols-2 gap-1">
            {HEX_LAYOUTS.map((l, i) => (
              <button
                key={l.name}
                onPointerDown={() => { haptic('tap'); change({ layoutIndex: i }); }}
                className={`analog-btn !px-2 !py-[6px] !text-[9px] tracking-[0.08em] ${i === settings.layoutIndex ? 'active' : ''}`}
                {...hapticLabelProps()}
              >{l.name}</button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">TURN</span>
            <button
              onPointerDown={() => { haptic('step'); change({ rotation: (settings.rotation + 5) % 6 }); }}
              className="analog-btn !px-3 !py-[6px] !text-[11px]" {...hapticLabelProps()}
            >↺</button>
            <button
              onPointerDown={() => { haptic('step'); change({ rotation: (settings.rotation + 1) % 6 }); }}
              className="analog-btn !px-3 !py-[6px] !text-[11px]" {...hapticLabelProps()}
            >↻</button>
            <button
              onPointerDown={() => { haptic('tap'); change({ mirrorLR: !settings.mirrorLR }); }}
              className={`analog-btn !px-3 !py-[6px] !text-[9px] ${settings.mirrorLR ? 'active' : ''}`}
              {...hapticLabelProps()}
            >FLIP ↔</button>
            <button
              onPointerDown={() => { haptic('tap'); change({ mirrorUD: !settings.mirrorUD }); }}
              className={`analog-btn !px-3 !py-[6px] !text-[9px] ${settings.mirrorUD ? 'active' : ''}`}
              {...hapticLabelProps()}
            >FLIP ↕</button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">CENTRE</span>
            <button
              onPointerDown={() => { haptic('step'); change({ centreNote: Math.max(12, settings.centreNote - 12) }); }}
              className="analog-btn !px-3 !py-[6px] !text-[11px]" {...hapticLabelProps()}
            >OCT −</button>
            <span className="text-[11px] text-[var(--accent)] w-10 text-center tabular-nums">
              {hexNoteFull(settings.centreNote)}
            </span>
            <button
              onPointerDown={() => { haptic('step'); change({ centreNote: Math.min(115, settings.centreNote + 12) }); }}
              className="analog-btn !px-3 !py-[6px] !text-[11px]" {...hapticLabelProps()}
            >OCT +</button>
            <button
              onPointerDown={() => { haptic('tap'); change({ markRoot: !settings.markRoot }); }}
              className={`analog-btn !px-3 !py-[6px] !text-[9px] ml-auto ${settings.markRoot ? 'active' : ''}`}
              {...hapticLabelProps()}
            >MARK KEY</button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">VELOCITY</span>
            <input
              type="range" min={1} max={127} step={1}
              value={settings.velocity}
              onChange={(e) => change({ velocity: parseInt(e.target.value, 10) })}
              className="flex-1"
            />
            <span className="text-[11px] text-[var(--accent)] w-8 text-right tabular-nums">{settings.velocity}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">SLIDE</span>
            {([['off', 'GLISS'], ['a', 'MPE A'], ['b', 'MPE B']] as const).map(([mode, label]) => (
              <button
                key={mode}
                onPointerDown={() => { haptic('tap'); change({ mpeMode: mode }); }}
                className={`analog-btn !px-3 !py-[6px] !text-[9px] ${settings.mpeMode === mode ? 'active' : ''}`}
                {...hapticLabelProps()}
              >{label}</button>
            ))}
          </div>
          <p className="text-[8px] leading-tight opacity-50 tracking-[0.06em] -mt-1">
            {settings.mpeMode === 'off'
              ? 'SLIDING RETRIGGERS EACH HEX IT CROSSES.'
              : settings.mpeMode === 'a'
              ? 'THE NOTE HOLDS; SIDEWAYS BENDS IT, UP AND DOWN IS MPE TIMBRE.'
              : 'THE NOTE HOLDS AND FOLLOWS THE FINGER, IN TUNE ON ARRIVAL.'}
          </p>

          {settings.mpeMode === 'a' && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">BEND/HEX</span>
              <input
                type="range" min={1} max={12} step={1}
                value={settings.mpeBendPerHex}
                onChange={(e) => change({ mpeBendPerHex: parseInt(e.target.value, 10) })}
                className="flex-1"
              />
              <span className="text-[11px] text-[var(--accent)] w-12 text-right tabular-nums">
                {settings.mpeBendPerHex} ST
              </span>
            </div>
          )}

          {/* Left of the notch the note lasts as long as the hex is pressed,
              which is what a keyboard does; move it right and each press is a
              one-shot of that length instead. */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.18em] opacity-70 w-16">LENGTH</span>
            <input
              type="range" min={0} max={4000} step={50}
              value={settings.noteLengthMs}
              onChange={(e) => change({ noteLengthMs: parseInt(e.target.value, 10) })}
              className="flex-1"
            />
            <span className="text-[11px] text-[var(--accent)] w-12 text-right tabular-nums">
              {settings.noteLengthMs === 0 ? 'HOLD'
                : settings.noteLengthMs >= 1000 ? `${(settings.noteLengthMs / 1000).toFixed(1)}S`
                : `${settings.noteLengthMs}MS`}
            </span>
          </div>
        </div>
      )}

      {/* The board. `touch-action: none` is what stops iOS treating a played
          chord as a pinch or a scroll and cancelling the notes underneath. */}
      <div
        ref={surface}
        className="flex-1 min-h-0 relative overflow-hidden bg-[var(--surface-deep)] border border-white/10"
        style={{
          touchAction: 'none',
          // Pressing and sliding across the labels is exactly the gesture iOS
          // reads as selecting text, and it answers with a highlight and the
          // magnifier. Nothing here is text to be selected.
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        } as React.CSSProperties}
      >
        <svg width={size.w} height={size.h} className="absolute inset-0 select-none">
          {board.cells.map((cell) => {
            const dead = cell.pitch < 0;
            const isLit = !dead && lit.has(cell.pitch);
            const isRoot = !dead && settings.markRoot && cell.pitch % 12 === ((keyRoot % 12) + 12) % 12;
            return (
              <g key={`${cell.col}:${cell.row}`}>
                <polygon
                  points={hexPoints(cell.x, cell.y, settings.radius * 0.94)}
                  fill={dead ? 'rgba(255,255,255,0.02)'
                    : isLit ? 'var(--accent)'
                    : isRoot ? 'rgba(240,160,32,0.22)'
                    : 'rgba(255,255,255,0.06)'}
                  stroke={isLit ? 'var(--accent)' : 'rgba(255,255,255,0.14)'}
                  strokeWidth={1}
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => {
                    if (dead) return;
                    e.preventDefault();
                    if (settings.mpeMode === 'off') {
                      // A touch pointer is captured by the element it lands on,
                      // which would stop every other hex ever seeing the finger
                      // arrive. Letting the capture go is what makes a glissando
                      // across the board possible.
                      try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* synthetic ids */ }
                    } else {
                      // The opposite in the slide modes: the note belongs to the
                      // hex it started on however far the finger wanders, so the
                      // capture is kept and every move comes back here.
                      try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* synthetic ids */ }
                      origin.current.set(e.pointerId, {
                        x: e.clientX, y: e.clientY, pitch: cell.pitch, sent: 0,
                      });
                    }
                    start(e.pointerId, cell.pitch);
                  }}
                  onPointerMove={(e) => moved(e.pointerId, e.clientX, e.clientY)}
                  onPointerEnter={(e) => {
                    // Only the glissando mode retriggers; in the slide modes a
                    // crossed hex is a destination to bend towards, not a note.
                    if (dead || settings.mpeMode !== 'off') return;
                    if (!held.current.has(e.pointerId)) return;
                    start(e.pointerId, cell.pitch);
                  }}
                  onPointerUp={(e) => { origin.current.delete(e.pointerId); stop(e.pointerId); }}
                  onPointerCancel={(e) => { origin.current.delete(e.pointerId); stop(e.pointerId); }}
                />
                {settings.radius >= 22 && !dead && (
                  <text
                    x={cell.x} y={cell.y + 4}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    style={{
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      fontFamily: "'Space Mono', monospace",
                      fontSize: Math.max(8, settings.radius * 0.36),
                      fill: isLit ? '#000' : 'rgba(246,243,237,0.72)',
                    }}
                  >
                    {settings.radius >= 34 ? hexNoteFull(cell.pitch) : hexNoteName(cell.pitch)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
