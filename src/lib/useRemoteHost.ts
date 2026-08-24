import { useEffect, useRef, useState } from 'react';
import { diffParams, fieldChanged, RemotePatch, RemoteSnapshot } from './RemoteProtocol';

export interface RemoteStatus {
  running: boolean;
  url: string | null;
  devUrl?: string | null;
  clients: number;
  error?: string;
}

interface HostSources {
  engine: any;
  params: Record<string, any>;
  setParams: (params: any) => void;
  engineState: Record<string, any>;
  memorySlots: any[];
  setMemorySlots: (updater: any) => void;
  playingSlotIndices: number[];
  setPlayingSlotIndices: (updater: any) => void;
  activeNotes: number[];
  lastPlayedChord: any;
  setLastPlayedChord: (chord: any) => void;
  onPanic: () => void;
}

/** How often state goes down the wire. One frame: fast enough to feel live, slow enough not to flood. */
const PUBLISH_MS = 16;

const bridge = () => (typeof window !== 'undefined' ? (window as any).midimooRemote : undefined);

/** Whether this build is running inside the desktop app at all. */
export const remoteHostAvailable = () => !!bridge();

/**
 * The instrument's side of the remote.
 *
 * It does two things: run commands that arrive from a phone against the real
 * engine, and push what changed back down. The renderer stays the only place
 * that knows anything — a phone is a view and a set of fingers, nothing more.
 */
export function useRemoteHost(sources: HostSources) {
  const [status, setStatus] = useState<RemoteStatus>({ running: false, url: null, clients: 0 });

  // The published state is read on a timer rather than in the render that
  // changed it, so the latest values live in a ref instead of a dependency list.
  const latest = useRef(sources);
  latest.current = sources;

  const lastSent = useRef<RemoteSnapshot | null>(null);
  const wantsSnapshot = useRef(false);

  /** Everything a phone needs to draw itself, as it stands right now. */
  const snapshot = (): RemoteSnapshot => {
    const s = latest.current;
    return {
      params: s.params,
      engineState: {
        ...s.engineState,
        // The pad that is actually lit, which the modifier pads read but the
        // desktop keeps on the engine rather than in state.
        effectiveBaseType: s.engine?.currentEffectiveBaseType,
      },
      memorySlots: s.memorySlots,
      playingSlotIndices: s.playingSlotIndices,
      activeNotes: s.activeNotes,
      arpSequence: s.engine?.getArpeggioSequence?.() ?? [],
      lastPlayedChord: s.lastPlayedChord,
    };
  };

  /** Run one command from a phone against the real engine. */
  const execute = (fn: string, args: any[]) => {
    const s = latest.current;
    switch (fn) {
      case 'setParams':
        // The effect that syncs params into the engine does the rest.
        s.setParams(args[0]);
        return;
      case 'playSlot': {
        const index = args[0];
        s.setPlayingSlotIndices((previous: number[]) =>
          previous.includes(index) ? previous : [...previous, index]);
        s.setLastPlayedChord(s.memorySlots[index]);
        return;
      }
      case 'stopSlot': {
        const index = args[0];
        s.setPlayingSlotIndices((previous: number[]) => previous.filter(x => x !== index));
        return;
      }
      case 'saveSlot': {
        const [index, chord] = args;
        s.setMemorySlots((previous: any[]) => {
          const next = [...previous];
          next[index] = chord;
          return next;
        });
        return;
      }
      case 'updateSlots':
        s.setMemorySlots(args[0]);
        return;
      case 'panic':
        s.onPanic();
        return;
      default: {
        const method = s.engine?.[fn];
        if (typeof method === 'function') method.apply(s.engine, args);
      }
    }
  };

  useEffect(() => {
    const api = bridge();
    if (!api) return;

    api.status().then(setStatus).catch(() => {});

    const unsubscribers = [
      api.onStatus((next: RemoteStatus) => setStatus(next)),
      api.onCommand(({ fn, args }: { fn: string; args: any[] }) => execute(fn, args)),
      // A phone that vanished mid-chord is owed the note-offs it never sent.
      api.onClientGone((releases: Array<{ fn: string; args: any[] }>) => {
        for (const release of releases) execute(release.fn, release.args);
      }),
      api.onWantsSnapshot(() => { wantsSnapshot.current = true; }),
    ];
    return () => { for (const off of unsubscribers) off?.(); };
  }, []);

  // Push state down. Only what changed, and only while somebody is listening.
  useEffect(() => {
    const api = bridge();
    if (!api || !status.running) return;

    const timer = setInterval(() => {
      const current = snapshot();

      if (wantsSnapshot.current || !lastSent.current) {
        wantsSnapshot.current = false;
        lastSent.current = current;
        api.publish({ t: 'snapshot', d: current });
        return;
      }
      if (status.clients === 0) { lastSent.current = current; return; }

      const patch: RemotePatch = {};
      let changed = false;

      // params is compared key by key: it holds around a hundred values, and a
      // slider drag would otherwise put the whole object on the wire every frame.
      const paramsPatch = diffParams(lastSent.current.params, current.params);
      if (paramsPatch) { patch.params = paramsPatch; changed = true; }

      for (const field of ['engineState', 'memorySlots', 'playingSlotIndices', 'activeNotes', 'arpSequence', 'lastPlayedChord'] as const) {
        if (fieldChanged(lastSent.current[field], current[field])) {
          (patch as any)[field] = current[field];
          changed = true;
        }
      }

      lastSent.current = current;
      if (changed) api.publish({ t: 'patch', d: patch });
    }, PUBLISH_MS);

    return () => clearInterval(timer);
  }, [status.running, status.clients]);

  const start = async () => { const api = bridge(); if (api) setStatus(await api.start()); };
  const stop = async () => {
    const api = bridge();
    if (!api) return;
    lastSent.current = null;
    setStatus(await api.stop());
  };

  return { status, start, stop };
}
