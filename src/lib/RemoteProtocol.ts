/**
 * What the phone and the instrument say to each other.
 *
 * The renderer holds the only engine and the only copy of the state; the phone
 * holds a mirror it never writes to directly. Everything the phone does travels
 * up as a command, and the truth comes back down as a snapshot. That way there
 * is never a second version of the state to reconcile.
 */

export const REMOTE_PORT = 7331;

/**
 * The only methods the socket may reach. The server listens on the local
 * network, so this is a list of what a remote is allowed to do rather than a
 * convenience — without it, anything on the network could call into the engine.
 */
import commands from '../../electron/remote-commands.json';

export const ALLOWED_COMMANDS = commands as readonly string[];

export type RemoteCommandName =
  | 'handleMidi' | 'setModifiers' | 'setBaseType' | 'releaseBaseType'
  | 'toggleExtension' | 'releaseExtension' | 'handleArpeggioNoteOn'
  | 'emitControlChange' | 'sendPitchBend' | 'updateInversion' | 'updateRegister' | 'wiggleCC' | 'panic'
  | 'setParams' | 'playSlot' | 'stopSlot' | 'saveSlot' | 'updateSlots';

export const isAllowedCommand = (fn: unknown): fn is RemoteCommandName =>
  typeof fn === 'string' && ALLOWED_COMMANDS.includes(fn);

/** Everything the phone needs to draw itself. */
export interface RemoteSnapshot {
  /** The instrument's build. A phone showing a different one is a stale page. */
  version: string;
  params: Record<string, any>;
  engineState: Record<string, any>;
  memorySlots: any[];
  playingSlotIndices: number[];
  activeNotes: number[];
  /** What the strum pad would play, worked out by the engine. */
  arpSequence: number[];
  lastPlayedChord: any;
}

/**
 * A patch carries only what changed. `params` is diffed key by key because it
 * holds around a hundred values and a slider drag would otherwise send the
 * whole object sixty times a second.
 */
export interface RemotePatch {
  version?: string;
  params?: Record<string, any>;
  engineState?: Record<string, any>;
  memorySlots?: any[];
  playingSlotIndices?: number[];
  activeNotes?: number[];
  arpSequence?: number[];
  lastPlayedChord?: any;
}

export type ServerMessage =
  | { t: 'snapshot'; d: RemoteSnapshot }
  | { t: 'patch'; d: RemotePatch }
  | { t: 'ping' };

export type ClientMessage =
  | { t: 'cmd'; fn: RemoteCommandName; args: any[] }
  | { t: 'pong' };

/** Which top-level fields are compared by identity rather than by key. */
export const SNAPSHOT_FIELDS = [
  'engineState',
  'memorySlots',
  'playingSlotIndices',
  'activeNotes',
  'arpSequence',
  'lastPlayedChord',
] as const;

/**
 * Whether the page a phone is showing came from an older run of the app.
 *
 * The interface and the instrument are the same build, so a difference means
 * this page was served before the app was rebuilt and is not the version being
 * tested. An instrument that reports nothing is one from before this check
 * existed, and saying so would be worse than staying quiet.
 */
export function isStalePage(pageVersion: string, instrumentVersion: string | undefined): boolean {
  if (!instrumentVersion || !pageVersion) return false;
  return instrumentVersion !== pageVersion;
}

/** The keys of `params` that differ between two versions of it. */
export function diffParams(
  previous: Record<string, any> | null,
  next: Record<string, any>,
): Record<string, any> | undefined {
  if (!previous) return { ...next };
  const changed: Record<string, any> = {};
  let any = false;
  for (const key of Object.keys(next)) {
    const a = previous[key];
    const b = next[key];
    // Object-valued params (the colour matrix is one) are compared by their
    // serialised form: they are small, and identity says nothing useful after
    // a state update has rebuilt the object around them.
    const same = a === b || (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
    if (!same) { changed[key] = b; any = true; }
  }
  return any ? changed : undefined;
}

/** Whether two snapshot fields differ enough to be worth sending. */
export function fieldChanged(a: any, b: any): boolean {
  if (a === b) return false;
  return JSON.stringify(a) !== JSON.stringify(b);
}
