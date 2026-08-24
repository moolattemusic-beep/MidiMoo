import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MobileView } from './components/MobileView';
import { OrchidEngine } from './lib/OrchidEngine';
import { RemoteEngine } from './lib/RemoteEngine';
import { REMOTE_PORT, RemoteCommandName, RemoteSnapshot, ServerMessage } from './lib/RemoteProtocol';
import {
  audioFallbackEnabled, hapticCapability, hapticsEnabled, haptic,
  primeHaptics, setAudioFallback, setHapticsEnabled,
} from './lib/Haptics';
import { keepAwake, letSleep, wakeLockSupported, watchVisibility } from './lib/WakeLock';

type Connection = 'connecting' | 'open' | 'lost';

const EMPTY: RemoteSnapshot = {
  params: {},
  engineState: {},
  memorySlots: [],
  playingSlotIndices: [],
  activeNotes: [],
  arpSequence: [],
  lastPlayedChord: null,
};

/**
 * MidiMOO as seen from a phone.
 *
 * The interface is the one the desktop already has — `MobileView`, unchanged —
 * handed a `RemoteEngine` in place of the real one. Nothing here decides
 * anything: it draws the last state the instrument sent and passes gestures
 * back. What it does own is the phone's own concerns, which the Mac knows
 * nothing about: staying connected, staying awake, and feeling like something
 * under a finger.
 */
export function RemoteApp() {
  const [connection, setConnection] = useState<Connection>('connecting');
  const [snapshot, setSnapshot] = useState<RemoteSnapshot>(EMPTY);
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [awake, setAwake] = useState(false);
  const [, forceRender] = useState(0);

  const socket = useRef<WebSocket | null>(null);
  const retry = useRef<any>(null);
  const attempts = useRef(0);

  const send = useCallback((fn: RemoteCommandName, args: any[]) => {
    const live = socket.current;
    if (live && live.readyState === WebSocket.OPEN) {
      live.send(JSON.stringify({ t: 'cmd', fn, args }));
    }
  }, []);

  const engine = useMemo(() => new RemoteEngine({}, send), [send]);

  // ---- the connection ----------------------------------------------------
  useEffect(() => {
    let closed = false;

    const connect = () => {
      if (closed) return;
      // Whatever host served this page is the instrument, so there is no
      // address to configure — only the port, which is fixed.
      const url = `ws://${window.location.hostname}:${REMOTE_PORT}`;
      setConnection(attempts.current === 0 ? 'connecting' : 'lost');

      let live: WebSocket;
      try {
        live = new WebSocket(url);
      } catch {
        retry.current = setTimeout(connect, 1200);
        return;
      }
      socket.current = live;

      live.onopen = () => {
        attempts.current = 0;
        setConnection('open');
      };

      live.onmessage = (event) => {
        let message: ServerMessage;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.t === 'ping') {
          live.send(JSON.stringify({ t: 'pong' }));
          return;
        }
        if (message.t === 'snapshot') {
          setSnapshot(message.d);
          setReady(true);
          return;
        }
        if (message.t === 'patch') {
          setSnapshot(previous => ({
            ...previous,
            ...message.d,
            // params arrives as only the keys that changed.
            params: message.d.params ? { ...previous.params, ...message.d.params } : previous.params,
          }));
        }
      };

      const dropped = () => {
        if (closed) return;
        socket.current = null;
        setConnection('lost');
        attempts.current += 1;
        // Back off, but never so far that picking the phone up means waiting.
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

  // Feed the shim whatever came down, so reads answer from the latest state.
  useEffect(() => { engine.apply(snapshot); }, [engine, snapshot]);

  useEffect(() => watchVisibility(), []);

  // ---- the phone's own concerns -----------------------------------------
  const firstTouch = useRef(false);
  const onFirstTouch = useCallback(() => {
    if (firstTouch.current) return;
    firstTouch.current = true;
    // Audio and haptics both need a real gesture before they will start.
    primeHaptics();
    keepAwake().then(method => setAwake(method !== 'none'));
  }, []);

  const setParams = useCallback((next: any) => {
    // Applied here first so a slider tracks the finger, then confirmed by the
    // instrument a frame or two later.
    setSnapshot(previous => ({ ...previous, params: next }));
    send('setParams', [next]);
  }, [send]);

  const status =
    connection === 'open' ? (ready ? 'CONNECTED' : 'SYNCING')
    : connection === 'connecting' ? 'CONNECTING'
    : 'RECONNECTING';

  const statusColour =
    connection === 'open' && ready ? '#7FB069'
    : connection === 'lost' ? '#D9534F'
    : '#E9963E';

  if (!ready) {
    return (
      <div
        onPointerDown={onFirstTouch}
        className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white font-['Space_Mono'] p-8 text-center"
      >
        <div className="text-[var(--accent)] tracking-[0.3em] text-sm">MIDIMOO</div>
        <div className="text-xs tracking-[0.2em]" style={{ color: statusColour }}>{status}</div>
        <p className="text-[11px] leading-relaxed text-white/45 max-w-[16rem]">
          {connection === 'lost'
            ? 'The instrument stopped answering. Check that MidiMOO is open and REMOTE is switched on.'
            : 'Waiting for the instrument.'}
        </p>
      </div>
    );
  }

  return (
    <div onPointerDown={onFirstTouch} className="fixed inset-0">
      <MobileView
        engine={engine as unknown as OrchidEngine}
        params={snapshot.params as any}
        setParams={setParams}
        engineState={snapshot.engineState}
        memorySlots={snapshot.memorySlots}
        playingSlotIndices={snapshot.playingSlotIndices}
        activeNotes={snapshot.activeNotes}
        lastPlayedChord={snapshot.lastPlayedChord}
        onClose={() => setShowSettings(true)}
        hideClose
        headerExtra={
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Remote settings"
            className="h-8 px-2 flex items-center gap-[6px] bg-black/80 border border-white/15 rounded-sm font-['Space_Mono'] text-[9px] tracking-[0.16em] text-white/70"
          >
            <span className="w-[6px] h-[6px] rounded-full" style={{ background: statusColour }} />
            {connection === 'open' ? 'LINK' : status}
          </button>
        }
        onPlaySlot={(index) => send('playSlot', [index])}
        onStopSlot={(index) => send('stopSlot', [index])}
        onSaveSlot={(index, chord) => send('saveSlot', [index, chord])}
        onUpdateSlots={(slots) => send('updateSlots', [slots])}
        onPanic={() => { haptic('error'); send('panic', []); }}
      />

      {showSettings && (
        <RemoteSettings
          awake={awake}
          onAwakeChange={async (on) => {
            if (on) setAwake((await keepAwake()) !== 'none');
            else { await letSleep(); setAwake(false); }
          }}
          onChanged={() => forceRender(n => n + 1)}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

/**
 * The handful of settings that belong to the phone rather than the instrument.
 *
 * The toggles are real `<input type="checkbox" switch>` controls rather than
 * the app's own painted ones, because on iOS that is the single control the
 * system gives a genuine haptic to — so these two feel like hardware even where
 * nothing else can.
 */
function RemoteSettings({
  awake, onAwakeChange, onChanged, onClose,
}: {
  awake: boolean;
  onAwakeChange: (on: boolean) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const capability = hapticCapability();
  const description: Record<string, string> = {
    vibrate: 'This phone has a real vibration motor available to the browser.',
    switch: 'iOS gives web pages one system haptic, borrowed from its switch control.',
    audio: 'Falling back to a click through the speaker — audible rather than felt.',
    none: 'Nothing available here. Try the speaker click below.',
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-[var(--surface,#1c1c19)] border-t border-white/15 p-4 pb-8 flex flex-col gap-4 font-['Space_Mono']"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-[0.2em] text-[var(--accent)]">REMOTE</span>
          <button onClick={onClose} className="analog-btn !text-[9px] !px-3 !py-1">DONE</button>
        </div>

        <SwitchRow
          label="HAPTICS"
          hint={description[capability]}
          checked={hapticsEnabled()}
          onChange={(on) => { setHapticsEnabled(on); onChanged(); }}
        />

        <SwitchRow
          label="SPEAKER CLICK"
          hint="A short low tone when haptics are unavailable. Makes a sound, so it is off unless wanted."
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
  );
}

function SwitchRow({
  label, hint, checked, onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span className="flex flex-col gap-1">
        <span className="text-[11px] tracking-[0.16em] text-white/90">{label}</span>
        <span className="text-[10px] leading-snug text-white/40 max-w-[15rem]">{hint}</span>
      </span>
      <input
        type="checkbox"
        // Not a React prop, and the reason these rows exist in this form.
        {...{ switch: '' } as any}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="shrink-0 mt-[2px] w-[51px] h-[31px] accent-[var(--accent)]"
      />
    </label>
  );
}
