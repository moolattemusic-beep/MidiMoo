/**
 * SETUPS — the whole instrument, named and recalled.
 *
 * Everything that decides how the app sounds lived in one live state that was
 * overwritten as you worked, so a sound built over an evening could only be
 * kept by not touching anything. A setup is that state, copied and named.
 *
 * What a setup deliberately does *not* carry is the rig: which MIDI ports are
 * ticked, and which port the outboard synth is on. Those describe the room the
 * instrument is standing in rather than the sound it makes, and recalling a
 * setup should never silently repoint your outputs — least of all on a machine
 * where the ports are different ones. Everything about the external synth
 * *except* which socket it is plugged into travels, since channel, voice mode
 * and the arp settings are part of the sound.
 */

import { OrchidParams, defaultParams } from '../types';
import type { MemorySlot } from '../components/MemorySlots';

export const SNAPSHOT_STORE_KEY = 'orchid-setups';
const SLOT_COUNT = 8;

export interface Snapshot {
  id: string;
  name: string;
  /** Epoch ms, so the list can be shown newest first. */
  saved: number;
  params: OrchidParams;
  slots: MemorySlot[];
  rndmRequired: string[];
}

export interface RestoredState {
  params: OrchidParams;
  slots: MemorySlot[];
  rndmRequired: string[];
}

export function newSnapshotId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Pad or trim to the fixed number of pads, whatever was stored. */
export function normaliseSlots(slots: unknown): MemorySlot[] {
  const out: MemorySlot[] = Array(SLOT_COUNT).fill(null);
  if (!Array.isArray(slots)) return out;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot: any = slots[i];
    // A pad is either a chord or empty. Anything else stored under that name is
    // not worth guessing at.
    out[i] = slot && typeof slot === 'object' && typeof slot.rootPitch === 'number' ? slot : null;
  }
  return out;
}

export function captureSnapshot(
  name: string,
  params: OrchidParams,
  slots: MemorySlot[],
  rndmRequired: string[],
): Snapshot {
  return {
    id: newSnapshotId(),
    name: name.trim() || 'UNTITLED',
    saved: Date.now(),
    params: { ...params },
    slots: normaliseSlots(slots),
    rndmRequired: [...rndmRequired],
  };
}

export function restoreSnapshot(snap: Snapshot): RestoredState {
  return {
    // A setup saved before a parameter existed simply does not mention it, and
    // has to come back holding that parameter's default rather than undefined —
    // the same merge the live settings already get on load. Without this, every
    // feature added after a setup was saved would break it.
    params: { ...defaultParams, ...(snap?.params ?? {}) },
    slots: normaliseSlots(snap?.slots),
    rndmRequired: Array.isArray(snap?.rndmRequired)
      ? snap.rndmRequired.filter((n): n is string => typeof n === 'string')
      : [],
  };
}

/** Anything unreadable is dropped rather than taking the whole list with it. */
export function parseSnapshots(raw: string | null): Snapshot[] {
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];

  const out: Snapshot[] = [];
  for (const entry of parsed as any[]) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.name !== 'string') continue;
    out.push({
      id: typeof entry.id === 'string' ? entry.id : newSnapshotId(),
      name: entry.name,
      saved: typeof entry.saved === 'number' ? entry.saved : 0,
      params: (entry.params && typeof entry.params === 'object' ? entry.params : {}) as OrchidParams,
      slots: normaliseSlots(entry.slots),
      rndmRequired: Array.isArray(entry.rndmRequired) ? entry.rndmRequired : [],
    });
  }
  return out;
}

/**
 * Add a setup, or replace the one already using that name.
 *
 * Saving over a name is the common case — you tweak a sound and save it again —
 * and two setups called the same thing would be impossible to tell apart in the
 * list, so the name is the identity.
 */
export function withSnapshot(list: Snapshot[], snap: Snapshot): Snapshot[] {
  const key = snap.name.trim().toLowerCase();
  const existing = list.findIndex(s => s.name.trim().toLowerCase() === key);
  if (existing === -1) return [...list, snap];
  const next = [...list];
  next[existing] = { ...snap, id: list[existing].id };
  return next;
}

export function removeSnapshot(list: Snapshot[], id: string): Snapshot[] {
  return list.filter(s => s.id !== id);
}

export function renameSnapshot(list: Snapshot[], id: string, name: string): Snapshot[] {
  const clean = name.trim();
  if (!clean) return list;
  // Renaming onto a name that is taken would break the one-setup-per-name rule
  // that saving relies on, so it is refused rather than silently merging two.
  if (list.some(s => s.id !== id && s.name.trim().toLowerCase() === clean.toLowerCase())) return list;
  return list.map(s => (s.id === id ? { ...s, name: clean } : s));
}
