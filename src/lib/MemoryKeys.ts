/**
 * Which keys on a MIDI keyboard fire the eight memory pads.
 *
 * Playing the pads from a physical keyboard rather than from a screen is the
 * difference between a chord landing where it was meant to and landing where
 * the network and the browser got round to it, which is why this exists at all.
 *
 * Two ways of laying them out. The original counts eight semitones up from its
 * starting note, which is compact but puts pads on black keys — awkward to hit
 * without looking, and impossible to feel. White keys instead give the pads a
 * shape the hand already knows: an octave of naturals, C to C.
 */

/** Semitones above the starting C for each pad, on the white keys. */
const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12];

export const MEMORY_PAD_COUNT = 8;

/** The C notes a run of pads can start from, low to high. */
export const START_NOTES = [12, 24, 36, 48, 60, 72, 84, 96];

/**
 * The key that fires each pad, pad 0 first.
 *
 * White keys run C D E F G A B C — eight naturals, so the last pad is the
 * octave above the first rather than a seventh above it. That is what "count
 * to eight from a C" means to a hand on a keyboard.
 */
export function memoryPadKeys(startNote: number, whiteOnly: boolean): number[] {
  const offsets = whiteOnly ? WHITE_OFFSETS : [0, 1, 2, 3, 4, 5, 6, 7];
  return offsets.map(o => startNote + o);
}

/**
 * Which pad a key fires, or null if it fires none.
 *
 * Null is the answer that matters: everything else the keyboard plays has to
 * pass through untouched, so a key that is not one of the eight must not be
 * quietly swallowed.
 */
export function padForKey(pitch: number, startNote: number, whiteOnly: boolean): number | null {
  const offset = pitch - startNote;
  if (offset < 0) return null;
  if (!whiteOnly) return offset < MEMORY_PAD_COUNT ? offset : null;
  const index = WHITE_OFFSETS.indexOf(offset);
  return index === -1 ? null : index;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteLabel(pitch: number): string {
  return `${NOTE_NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

/** The span the pads occupy, for saying so on screen. */
export function memoryKeyRange(startNote: number, whiteOnly: boolean): string {
  const keys = memoryPadKeys(startNote, whiteOnly);
  return `${noteLabel(keys[0])}–${noteLabel(keys[keys.length - 1])}`;
}
