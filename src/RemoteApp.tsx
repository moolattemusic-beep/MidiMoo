import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrchidEngine } from './lib/OrchidEngine';
import { OrchidParams } from './types';
import { ArpeggioXYPad } from './components/ArpeggioXYPad';
import { CustomSlider } from './components/CustomSlider';
import { MemorySlots } from './components/MemorySlots';
import { HexKeyboard, HexSettings, defaultHexSettings } from './components/HexKeyboard';
import { ChordGridBoard, GridSettings, defaultGridSettings } from './components/ChordGridBoard';
import { RemoteEngine } from './lib/RemoteEngine';
import { isStalePage, REMOTE_PORT, RemoteCommandName, RemoteSnapshot, ServerMessage } from './lib/RemoteProtocol';
import {
  audioFallbackEnabled, hapticCapability, hapticsEnabled, haptic,
  hapticLabelProps, HAPTIC_TARGET_ID, primeHaptics, setAudioFallback, setHapticsEnabled,
} from './lib/Haptics';
import { keepAwake, letSleep, wakeLockSupported, watchVisibility } from './lib/WakeLock';

type Connection = 'connecting' | 'open' | 'lost';
type Tab = 'chords' | 'pads' | 'grid';

const EMPTY: RemoteSnapshot = {
  version: '', params: {}, engineState: {}, memorySlots: [],
  playingSlotIndices: [], activeNotes: [], arpSequence: [], lastPlayedChord: null,
};

const BASE_TYPES = [
  { label: 'MAJOR', value: 0 },
  { label: 'MINOR', value: 1 },
  { label: 'SUS', value: 2 },
  { label: 'DIM', value: 3 },
];

/** Once ALT is on over a diminished pad the extensions become alterations. */
const EXTENSIONS = (dominant: boolean) => dominant
  ? [
      { id: 'm7', label: 'b9' }, { id: 'M7', label: '#9' },
      { id: '6', label: 'b13' }, { id: '9', label: '#13' },
    ]
  : [
      { id: 'M7', label: 'M7' }, { id: 'm7', label: 'm7' },
      { id: '6', label: '6' }, { id: '9', label: '9' },
    ];

/**
 * MidiMOO as a control surface.
 *
 * Laid out for a phone held sideways, which is how it is played: two banks of
 * eight pads sharing the same space behind a pair of tabs, the strum pad down
 * the side, and register and inversion along the bottom. Everything that is not
 * played lives behind MORE, so the surface itself is only controls.
 */
export function RemoteApp() {
  const [connection, setConnection] = useState<Connection>('connecting');
  const [snapshot, setSnapshot] = useState<RemoteSnapshot>(EMPTY);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('pads');
  // The hex board's settings belong to the device it is played on, not to the
  // instrument: the zoom exists precisely because a phone and an iPad want
  // different sizes, so they are kept here rather than sent to the desktop.
  const [hex, setHex] = useState<HexSettings>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('midimoo-hex') || 'null');
      return saved ? { ...defaultHexSettings, ...saved } : defaultHexSettings;
    } catch { return defaultHexSettings; }
  });
  const [hexFull, setHexFull] = useState(false);
  // The chord board's settings belong to the device it is played on, like the
  // hex board's: how many rows fit is a fact about the screen.
  const [gridSet, setGridSet] = useState<GridSettings>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('midimoo-grid') || 'null');
      return saved ? { ...defaultGridSettings, ...saved } : defaultGridSettings;
    } catch { return defaultGridSettings; }
  });
  // The hex board is still here behind a switch rather than deleted, since it
  // was asked for two versions ago and is a keystroke away from being wanted.
  const [useHex, setUseHex] = useState(() => localStorage.getItem('midimoo-board') === 'hex');
  useEffect(() => {
    try { localStorage.setItem('midimoo-grid', JSON.stringify(gridSet)); } catch { /* private mode */ }
  }, [gridSet]);
  useEffect(() => {
    try { localStorage.setItem('midimoo-board', useHex ? 'hex' : 'grid'); } catch { /* private mode */ }
  }, [useHex]);
  useEffect(() => {
    try { localStorage.setItem('midimoo-hex', JSON.stringify(hex)); } catch { /* private mode */ }
  }, [hex]);
  const [showMore, setShowMore] = useState(false);
  const [awake, setAwake] = useState(false);
  const [, redraw] = useState(0);

  const socket = useRef<WebSocket | null>(null);
  const retry = useRef<any>(null);
  const attempts = useRef(0);

  const send = useCallback((fn: RemoteCommandName, args: any[]) => {
    const live = socket.current;
    if (live && live.readyState === WebSocket.OPEN) live.send(JSON.stringify({ t: 'cmd', fn, args }));
  }, []);

  const engine = useMemo(() => new RemoteEngine({}, send), [send]);

  // Straight into the same entry point a plugged-in keyboard uses. Stable,
  // because a fresh callback each render used to look like the hex board
  // being torn down and released every note a second into playing it.
  const hexNote = useCallback(
    (pitch: number, velocity: number, isOn: boolean) => send('handleMidi', [pitch, velocity, isOn]),
    [send]);

  // The same route a memory pad takes: a root, and the notes to build on it.
  const gridChord = useCallback(
    (rootPitch: number, velocity: number, isOn: boolean, intervals: number[]) =>
      send('handleMidi', [rootPitch, velocity, isOn, false, false, false, true, undefined, intervals]),
    [send]);

  const gridTimbre = useCallback(
    (rootPitch: number, timbre: number) => send('keyExpression', [rootPitch, null, timbre]),
    [send]);

  const hexExpression = useCallback(
    (sourceKey: number, bend: number, timbre?: number) =>
      send('keyExpression', timbre === undefined ? [sourceKey, bend] : [sourceKey, bend, timbre]),
    [send]);

  useEffect(() => {
    let closed = false;
    const connect = () => {
      if (closed) return;
      // Whatever served this page is the instrument, so there is no address to
      // configure — only the port, which is fixed.
      setConnection(attempts.current === 0 ? 'connecting' : 'lost');
      let live: WebSocket;
      try {
        live = new WebSocket(`ws://${window.location.hostname}:${REMOTE_PORT}`);
      } catch {
        retry.current = setTimeout(connect, 1200);
        return;
      }
      socket.current = live;
      live.onopen = () => { attempts.current = 0; setConnection('open'); };
      live.onmessage = (event) => {
        let message: ServerMessage;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.t === 'ping') { live.send(JSON.stringify({ t: 'pong' })); return; }
        if (message.t === 'snapshot') { setSnapshot(message.d); setReady(true); return; }
        if (message.t === 'patch') {
          setSnapshot(previous => ({
            ...previous, ...message.d,
            params: message.d.params ? { ...previous.params, ...message.d.params } : previous.params,
          }));
        }
      };
      const dropped = () => {
        if (closed) return;
        socket.current = null;
        setConnection('lost');
        attempts.current += 1;
        retry.current = setTimeout(connect, Math.min(400 * attempts.current, 3000));
      };
      live.onclose = dropped;
      live.onerror = () => { try { live.close(); } catch { /* already closing */ } };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry.current);
      try { socket.current?.close(); } catch { /* nothing to close */ }
    };
  }, []);

  // Applied here rather than in an effect: an effect runs after the render that
  // brought the new state, so everything reading through the mirror would draw
  // the previous chord — and once the patches stop, it would stay there. The
  // call only copies what is already in props, so it is safe to do while
  // rendering and idempotent if React renders twice.
  engine.apply(snapshot);

  useEffect(() => watchVisibility(), []);


  // What this phone believes it is doing, held until the instrument agrees or
  // long enough to know the message went missing.
  const [padHint, setPadHint] = useState<number[] | null>(null);
  const [chordHint, setChordHint] = useState<Record<string, any> | null>(null);
  const hintTimers = useRef<{ pad?: any; chord?: any }>({});

  const hintPads = (next: number[]) => {
    setPadHint(next);
    clearTimeout(hintTimers.current.pad);
    hintTimers.current.pad = setTimeout(() => setPadHint(null), 700);
  };
  const hintChord = (next: Record<string, any>) => {
    setChordHint(previous => ({ ...(previous ?? {}), ...next }));
    clearTimeout(hintTimers.current.chord);
    hintTimers.current.chord = setTimeout(() => setChordHint(null), 700);
  };
  useEffect(() => () => {
    clearTimeout(hintTimers.current.pad);
    clearTimeout(hintTimers.current.chord);
  }, []);
  // Once the instrument agrees there is nothing left to guess about.
  useEffect(() => {
    if (padHint && padHint.join() === snapshot.playingSlotIndices.join()) setPadHint(null);
  }, [snapshot.playingSlotIndices, padHint]);
  useEffect(() => {
    if (chordHint && Object.entries(chordHint).every(([key, value]) => snapshot.engineState[key] === value)) {
      setChordHint(null);
    }
  }, [snapshot.engineState, chordHint]);

  const firstTouch = useRef(false);
  const onFirstTouch = useCallback(() => {
    if (firstTouch.current) return;
    firstTouch.current = true;
    // Audio and the screen lock both need a real gesture before they will start.
    primeHaptics();
    keepAwake().then(method => setAwake(method !== 'none'));
  }, []);

  const params = snapshot.params as OrchidParams;
  const state = snapshot.engineState;

  const setParams = useCallback((next: any) => {
    // Applied here first so a control tracks the finger, then confirmed by the
    // instrument a frame or two later.
    setSnapshot(previous => ({ ...previous, params: next }));
    send('setParams', [next]);
  }, [send]);

  const stale = isStalePage(__APP_VERSION__, snapshot.version);

  const status = connection === 'open' ? (ready ? 'LINK' : 'SYNC')
    : connection === 'connecting' ? 'CONNECTING' : 'RECONNECTING';
  const light = connection === 'open' && ready ? '#7FB069'
    : connection === 'lost' ? '#D9534F' : 'var(--accent)';

  if (!ready) {
    return (
      <div
        onPointerDown={onFirstTouch}
        className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white font-['Space_Mono'] p-8 text-center"
      >
        <div className="text-[var(--accent)] tracking-[0.3em] text-sm">MIDIMOO</div>
        <div className="text-[10px] tracking-[0.2em] text-white/35">V{__APP_VERSION__}</div>
        <div className="text-xs tracking-[0.2em]" style={{ color: light }}>{status}</div>
        <p className="text-[11px] leading-relaxed text-white/45 max-w-[16rem]">
          {connection === 'lost'
            ? 'The instrument stopped answering. Check that MidiMOO is open and REMOTE is switched on.'
            : 'Waiting for the instrument.'}
        </p>
      </div>
    );
  }

  // The finger's version of the truth, with the instrument's underneath it.
  const shown = { ...state, ...(chordHint ?? {}) };
  const litPads = padHint ?? snapshot.playingSlotIndices;

  const momentaryBase = !!params.momentaryBase;
  const momentaryExt = !!params.momentaryExt;
  const activeBaseType = shown.effectiveBaseType ?? shown.manualBaseType ?? -1;
  const isDominant = !!shown.ext_alt && activeBaseType === 3;
  const inversion = params.chordInversion ?? 0;

  const nudgeInversion = (by: number) => {
    const next = Math.max(-8, Math.min(8, inversion + by));
    if (next === inversion) { haptic('error'); return; }
    setParams({ ...params, chordInversion: next });
    engine.updateInversion(next);
  };

  return (
    <div
      onPointerDown={onFirstTouch}
      className="remote-surface fixed inset-0 bg-black text-white font-['Space_Mono'] flex flex-col"
      style={{
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* The switch every pad's label points at. iOS gives it the system haptic
          when it is genuinely operated, and a label tap counts as operating it.
          Rendered rather than hidden with display:none: an element the layout
          has thrown away cannot be activated. */}
      <input
        id={HAPTIC_TARGET_ID}
        type="checkbox"
        {...{ switch: '' } as any}
        aria-hidden="true"
        tabIndex={-1}
        // Inside the viewport rather than parked off-screen: activating a label
        // focuses its control, and Safari scrolls to bring a focused control
        // into view — which off at -9999px would yank the whole surface sideways.
        className="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none"
      />

      {/* Which bank is showing, and the two things that are not played. */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1 shrink-0">
        {([['pads', 'PADS'], ['chords', 'CHORDS'], ['grid', 'GRID']] as const).map(([id, label]) => (
          <button
            key={id}
            onPointerDown={() => { haptic('tap'); setTab(id); }}
            className={`analog-btn !px-4 !py-[6px] !text-[11px] tracking-[0.18em] ${tab === id ? 'active' : ''}`}
          >
            {label}
          </button>
        ))}

        {tab === 'grid' && (
          <button
            onPointerDown={() => { haptic('tap'); setUseHex(v => !v); }}
            className={`analog-btn !px-3 !py-[6px] !text-[11px] tracking-[0.18em] ${useHex ? 'active' : ''}`}
            title="The isomorphic hex board instead of the chord buttons"
          >
            HEX
          </button>
        )}

        {tab === 'chords' && (
          <button
            onPointerDown={() => {
              haptic('tap');
              hintChord({ ext_alt: !shown.ext_alt });
              engine.toggleExtension('alt');
            }}
            className={`analog-btn !px-3 !py-[6px] !text-[11px] tracking-[0.18em] ${shown.ext_alt ? 'active' : ''}`}
            title="Alterations instead of extensions"
          >
            ALT
          </button>
        )}

        <div className="flex-1" />

        <span className="flex items-center gap-[6px] px-2 text-[9px] tracking-[0.16em] text-white/50">
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: light }} />
          {status}
          <span className="text-white/30">V{__APP_VERSION__}</span>
        </span>
        <button
          onPointerDown={() => { haptic('tap'); setShowMore(true); }}
          className="analog-btn !px-4 !py-[6px] !text-[11px] tracking-[0.18em]"
        >
          MORE
        </button>
      </div>

      {/* The surface: banks and the transport strip, with the strum pad alongside. */}
      <div
        className="flex-1 min-h-0 flex portrait:flex-col gap-2 px-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex-1 min-h-0 flex flex-col">
            {tab === 'grid' && !useHex ? (
              <ChordGridBoard
                settings={gridSet}
                onSettings={setGridSet}
                onChord={gridChord}
                onExpression={gridTimbre}
                fullScreen={hexFull}
                onToggleFullScreen={() => setHexFull(v => !v)}
              />
            ) : tab === 'grid' ? (
              <HexKeyboard
                settings={hex}
                onSettings={setHex}
                keyRoot={params.keyRoot ?? 0}
                fullScreen={hexFull}
                onToggleFullScreen={() => setHexFull(v => !v)}
                onNote={hexNote}
                onExpression={hexExpression}
              />
            ) : tab === 'pads' ? (
              <MemorySlots
                engine={engine as unknown as OrchidEngine}
                slots={snapshot.memorySlots}
                playingSlotIndices={litPads}
                hideHeader
                hideEdit
                hapticFor={HAPTIC_TARGET_ID}
                padHeight="h-full"
                onPlaySlot={(index) => { hintPads([index]); send('playSlot', [index]); }}
                onStopSlot={(index) => { hintPads([]); send('stopSlot', [index]); }}
                onSaveSlot={(index, chord) => send('saveSlot', [index, chord])}
                onUpdateSlots={(slots) => send('updateSlots', [slots])}
                lastPlayedChord={snapshot.lastPlayedChord}
                isEditMode={false}
                onToggleEditMode={() => {}}
                activeEditSlotIndex={null}
                onSelectEditSlot={() => {}}
                memoryVelocity={params.memoryVelocity || 100}
                onMemoryVelocityChange={() => {}}
                isFreeEditMode={false}
                onToggleFreeEditMode={() => {}}
                armedSlotIndex={null}
                onArmSlot={() => {}}
                followRegister={params.memoryFollowRegister !== false}
                onToggleFollowRegister={() => {}}
                momentary={params.memoryMomentary !== false}
                onToggleMomentary={() => {}}
              />
            ) : (
              <div className="flex-1 min-h-0 grid grid-cols-4 grid-rows-2 gap-2">
                {BASE_TYPES.map((type) => {
                  const active = activeBaseType === type.value;
                  return (
                    <PadButton
                      key={type.label}
                      label={type.label}
                      active={active}
                      onPress={() => {
                        if (momentaryBase) {
                          hintChord({ effectiveBaseType: type.value, manualBaseType: type.value });
                          engine.setBaseType(type.value);
                          return;
                        }
                        const next = active ? -1 : type.value;
                        hintChord({ effectiveBaseType: next, manualBaseType: next });
                        engine.setBaseType(next);
                      }}
                      onRelease={momentaryBase ? () => {
                        hintChord({ effectiveBaseType: -1, manualBaseType: -1 });
                        engine.releaseBaseType(type.value);
                      } : undefined}
                    />
                  );
                })}
                {EXTENSIONS(isDominant).map((ext) => {
                  const on = !!shown[`ext_${ext.id}`];
                  return (
                    <PadButton
                      key={ext.id}
                      label={ext.label}
                      active={on}
                      onPress={() => {
                        // Momentary extensions toggle on the way down and back
                        // off on the way up, which is how the desktop pads read
                        // the same setting.
                        if (momentaryExt && on) return;
                        hintChord({ [`ext_${ext.id}`]: !on });
                        engine.toggleExtension(ext.id as any);
                      }}
                      onRelease={momentaryExt ? () => {
                        hintChord({ [`ext_${ext.id}`]: false });
                        engine.releaseExtension(ext.id as any);
                      } : undefined}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Register along the bottom, with inversion beside it. */}
          <div className="shrink-0 flex items-center gap-3">
            <span className="text-[9px] tracking-[0.16em] text-white/50 shrink-0">REG</span>
            <span className="text-[11px] text-[var(--accent)] w-7 shrink-0 tabular-nums">{params.chordRegisterStart}</span>
            <CustomSlider
              className="flex-1"
              min={24}
              max={96}
              step={1}
              value={params.chordRegisterStart}
              onChange={(value) => {
                setParams({ ...params, chordRegisterStart: value });
                engine.updateRegister(value);
              }}
            />
            <div className="flex items-center gap-1 shrink-0">
              <button
                onPointerDown={() => nudgeInversion(-1)}
                className="analog-btn !px-4 !py-2 !text-[15px] leading-none"
                title="Take the top note down an octave"
              >
                −
              </button>
              <span className="text-[11px] text-[var(--accent)] w-6 text-center tabular-nums">{inversion}</span>
              <button
                onPointerDown={() => nudgeInversion(1)}
                className="analog-btn !px-4 !py-2 !text-[15px] leading-none"
                title="Take the bottom note up an octave"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="w-[27%] min-w-[150px] portrait:w-full portrait:h-[38%] shrink-0">
          <ArpeggioXYPad engine={engine as unknown as OrchidEngine} params={params} setParams={setParams} padOnly />
        </div>
      </div>

      {stale && (
        <button
          onClick={() => window.location.reload()}
          className="absolute inset-x-0 bottom-0 z-[80] py-2 px-3 bg-[#8a2b28] text-white text-[10px] tracking-[0.14em] text-left"
        >
          THIS PAGE IS V{__APP_VERSION__}, THE INSTRUMENT IS V{snapshot.version} — TAP TO RELOAD
        </button>
      )}

      {showMore && (
        <MorePanel
          engine={engine}
          params={params}
          setParams={setParams}
          instrumentVersion={snapshot.version}
          awake={awake}
          onAwakeChange={async (on) => {
            if (on) setAwake((await keepAwake()) !== 'none');
            else { await letSleep(); setAwake(false); }
          }}
          onChanged={() => redraw(n => n + 1)}
          onClose={() => setShowMore(false)}
        />
      )}
    </div>
  );
}

const PadButton: React.FC<{
  label: string; active: boolean; onPress: () => void; onRelease?: () => void;
}> = ({ label, active, onPress, onRelease }) => {
  const anchor = hapticLabelProps();
  // A label where the phone has a haptic to give, a button otherwise. It must
  // not preventDefault: that would stop the label activating, and the tick with it.
  const Tag: any = anchor.htmlFor ? 'label' : 'button';
  return (
    <Tag
      {...anchor}
      onPointerDown={(event: any) => { if (!anchor.htmlFor) event.preventDefault(); onPress(); }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      className={`rounded-sm border-[3px] flex items-center justify-center touch-none transition-colors
        ${active
          ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
          : 'bg-[#1e1e1a] border-[#111] text-[var(--accent)]'}`}
    >
      <span className="font-['Oswald'] text-[clamp(0.9rem,3.4vh,1.6rem)] tracking-wider pointer-events-none">{label}</span>
    </Tag>
  );
};

/**
 * Everything that is not played: panic, the controller sweeps a plugin needs to
 * learn from, and the phone's own business.
 */
function MorePanel({
  engine, params, setParams, instrumentVersion, awake, onAwakeChange, onChanged, onClose,
}: {
  engine: RemoteEngine;
  params: OrchidParams;
  setParams: (next: any) => void;
  instrumentVersion: string;
  awake: boolean;
  onAwakeChange: (on: boolean) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const capability = hapticCapability();
  const says: Record<string, string> = {
    vibrate: 'A real buzz — this phone lets the browser reach its vibration motor.',
    switch: 'The one system haptic iOS gives a web page, borrowed from its switch control.',
    audio: 'Falling back to a click through the speaker.',
    none: 'Nothing available here. The speaker click below is the remaining option.',
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-[560px] max-h-full overflow-y-auto bg-[var(--surface,#1c1c19)] border border-white/15 rounded-sm p-3 flex flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-[0.2em] text-[var(--accent)]">MORE</span>
          <span className="text-[9px] tracking-[0.14em] text-white/35">
            REMOTE V{__APP_VERSION__} · INSTRUMENT V{instrumentVersion || '?'}
          </span>
          <button onPointerDown={onClose} className="analog-btn !text-[10px] !px-4 !py-1">DONE</button>
        </div>

        <button
          onPointerDown={() => engine.panic()}
          className="analog-btn !py-2 !text-[12px] tracking-[0.2em] !border-[#8a2b28] !text-[#ff9b96]"
        >
          PANIC
        </button>

        <div className="flex flex-col gap-2">
          <span className="text-[9px] tracking-[0.18em] text-white/40">
            THE STRIP BESIDE THE PAD
          </span>
          <div className="grid grid-cols-3 gap-2">
            {([['PITCH BEND', 0], ['CC1', 1], ['VELOCITY', 2]] as const).map(([label, mode]) => (
              <button
                key={label}
                onPointerDown={() => setParams({ ...params, arpeggioStripMode: mode })}
                className={`analog-btn !py-2 !text-[10px] tracking-[0.12em] ${(params.arpeggioStripMode ?? 0) === mode ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[10px] leading-snug text-white/40">
            {(params.arpeggioStripMode ?? 0) === 0
              ? 'Bends while held and springs back to centre when you let go. Sent on the master channel.'
              : (params.arpeggioStripMode ?? 0) === 1
                ? 'An ordinary slider sending the mod wheel. It stays where you put it.'
                : 'Trims how hard everything leaves the instrument, after everything else has had its say. It goes back to full whenever the strip is given another job, so a position left behind cannot quietly hold the whole instrument down.'}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[9px] tracking-[0.18em] text-white/40">
            RANGE — NOTHING LEAVES THE INSTRUMENT OUTSIDE IT
          </span>
          <RangeRow
            label="LOW"
            value={params.outputRangeLow ?? 0}
            min={0}
            max={(params.outputRangeHigh ?? 127) - 12}
            onChange={(value) => setParams({ ...params, outputRangeLow: value })}
          />
          <RangeRow
            label="HIGH"
            value={params.outputRangeHigh ?? 127}
            min={(params.outputRangeLow ?? 0) + 12}
            max={127}
            onChange={(value) => setParams({ ...params, outputRangeHigh: value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[9px] tracking-[0.18em] text-white/40">
            SEND A CONTROLLER SO A PLUGIN CAN LEARN IT
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[1, 74, 80].map(cc => (
              <button
                key={cc}
                onPointerDown={() => engine.wiggleCC(cc)}
                className="analog-btn !py-2 !text-[11px] tracking-[0.14em]"
              >
                CC{cc}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
          <SwitchRow
            label="HAPTICS"
            hint={says[capability]}
            checked={hapticsEnabled()}
            onChange={(on) => { setHapticsEnabled(on); onChanged(); }}
          />
          <SwitchRow
            label="SPEAKER CLICK"
            hint="The only feedback an iPhone can give the moment a pad goes down rather than when it comes up. It makes a sound, so it is off unless wanted."
            checked={audioFallbackEnabled()}
            onChange={(on) => { setAudioFallback(on); if (on) haptic('tap'); onChanged(); }}
          />
          <SwitchRow
            label="STAY AWAKE"
            hint={wakeLockSupported()
              ? 'Holding the screen on with the browser wake lock.'
              : 'Held with a silent looping video: the wake lock itself needs https.'}
            checked={awake}
            onChange={onAwakeChange}
          />
        </div>
      </div>
    </div>
  );
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (pitch: number) => `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;

/** One end of the output range, named as a note rather than a number. */
function RangeRow({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] tracking-[0.16em] text-white/60 w-10 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={127}
        step={1}
        value={value}
        onChange={(event) => {
          const next = parseInt(event.target.value, 10);
          // The two ends cannot cross, and a window under an octave cannot be
          // folded into at all, so they keep twelve semitones apart.
          onChange(Math.max(min, Math.min(max, next)));
        }}
        className="range-sm flex-1 accent-[var(--accent)]"
      />
      <span className="text-[11px] text-[var(--accent)] w-10 text-right tabular-nums">{noteName(value)}</span>
    </div>
  );
}

/**
 * A real `<input type="checkbox" switch>` rather than the app's painted toggle:
 * on iOS it is the one control the system gives a genuine haptic to.
 */
function SwitchRow({
  label, hint, checked, onChange,
}: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span className="flex flex-col gap-1">
        <span className="text-[11px] tracking-[0.16em] text-white/90">{label}</span>
        <span className="text-[10px] leading-snug text-white/40 max-w-[22rem]">{hint}</span>
      </span>
      <input
        type="checkbox"
        {...{ switch: '' } as any}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="shrink-0 mt-[2px] w-[51px] h-[31px] accent-[var(--accent)]"
      />
    </label>
  );
}
