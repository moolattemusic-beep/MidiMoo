import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrchidEngine } from './lib/OrchidEngine';
import { OrchidParams } from './types';
import { ArpeggioXYPad } from './components/ArpeggioXYPad';
import { CustomSlider } from './components/CustomSlider';
import { MemorySlots } from './components/MemorySlots';
import { RemoteEngine } from './lib/RemoteEngine';
import { REMOTE_PORT, RemoteCommandName, RemoteSnapshot, ServerMessage } from './lib/RemoteProtocol';
import {
  audioFallbackEnabled, hapticCapability, hapticsEnabled, haptic,
  hapticLabelProps, HAPTIC_TARGET_ID, primeHaptics, setAudioFallback, setHapticsEnabled,
} from './lib/Haptics';
import { keepAwake, letSleep, wakeLockSupported, watchVisibility } from './lib/WakeLock';

type Connection = 'connecting' | 'open' | 'lost';
type Tab = 'chords' | 'pads';

const EMPTY: RemoteSnapshot = {
  params: {}, engineState: {}, memorySlots: [],
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

  useEffect(() => { engine.apply(snapshot); }, [engine, snapshot]);
  useEffect(() => watchVisibility(), []);

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
        <div className="text-xs tracking-[0.2em]" style={{ color: light }}>{status}</div>
        <p className="text-[11px] leading-relaxed text-white/45 max-w-[16rem]">
          {connection === 'lost'
            ? 'The instrument stopped answering. Check that MidiMOO is open and REMOTE is switched on.'
            : 'Waiting for the instrument.'}
        </p>
      </div>
    );
  }

  const activeBaseType = state.effectiveBaseType ?? state.manualBaseType ?? -1;
  const isDominant = !!state.ext_alt && activeBaseType === 3;
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
        {([['pads', 'PADS'], ['chords', 'CHORDS']] as const).map(([id, label]) => (
          <button
            key={id}
            onPointerDown={() => { haptic('tap'); setTab(id); }}
            className={`analog-btn !px-4 !py-[6px] !text-[11px] tracking-[0.18em] ${tab === id ? 'active' : ''}`}
          >
            {label}
          </button>
        ))}

        {tab === 'chords' && (
          <button
            onPointerDown={() => { haptic('tap'); engine.toggleExtension('alt'); }}
            className={`analog-btn !px-3 !py-[6px] !text-[11px] tracking-[0.18em] ${state.ext_alt ? 'active' : ''}`}
            title="Alterations instead of extensions"
          >
            ALT
          </button>
        )}

        <div className="flex-1" />

        <span className="flex items-center gap-[6px] px-2 text-[9px] tracking-[0.16em] text-white/50">
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: light }} />
          {status}
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
            {tab === 'pads' ? (
              <MemorySlots
                engine={engine as unknown as OrchidEngine}
                slots={snapshot.memorySlots}
                playingSlotIndices={snapshot.playingSlotIndices}
                hideHeader
                hideEdit
                hapticFor={HAPTIC_TARGET_ID}
                padHeight="h-full"
                onPlaySlot={(index) => send('playSlot', [index])}
                onStopSlot={(index) => send('stopSlot', [index])}
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
                      // Latching rather than momentary: a phone has no spare
                      // finger to hold a modifier down with.
                      onPress={() => engine.setBaseType(active ? -1 : type.value)}
                    />
                  );
                })}
                {EXTENSIONS(isDominant).map((ext) => (
                  <PadButton
                    key={ext.id}
                    label={ext.label}
                    active={!!state[`ext_${ext.id}`]}
                    onPress={() => engine.toggleExtension(ext.id as any)}
                  />
                ))}
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

      {showMore && (
        <MorePanel
          engine={engine}
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

const PadButton: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => {
  const anchor = hapticLabelProps();
  // A label where the phone has a haptic to give, a button otherwise. It must
  // not preventDefault: that would stop the label activating, and the tick with it.
  const Tag: any = anchor.htmlFor ? 'label' : 'button';
  return (
    <Tag
      {...anchor}
      onPointerDown={(event: any) => { if (!anchor.htmlFor) event.preventDefault(); onPress(); }}
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
  engine, awake, onAwakeChange, onChanged, onClose,
}: {
  engine: RemoteEngine;
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
            hint="A short low tone where there is no haptic. It makes a sound, so it is off unless wanted."
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
