/**
 * Reading a MIDI file into chords.
 *
 * Two jobs, kept apart because only the second involves any judgement: turning
 * the bytes into notes, which the format decides, and deciding where one chord
 * ends and the next begins, which it does not.
 */

export interface ImportedNote {
  pitch: number;
  /** Ticks from the start of the file. */
  start: number;
  duration: number;
  track: number;
}

export interface ImportedChord {
  pitches: number[];
  start: number;
}

export interface ParsedMidi {
  notes: ImportedNote[];
  /** Ticks per quarter note, so ticks can be read as time. */
  ppq: number;
}

/** A variable-length quantity, and where it ended. */
function readVlq(bytes: Uint8Array, at: number): [number, number] {
  let value = 0;
  let index = at;
  for (let i = 0; i < 4 && index < bytes.length; i++) {
    const byte = bytes[index++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) break;
  }
  return [value, index];
}

const chunkName = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);

const readU32 = (bytes: Uint8Array, at: number) =>
  (bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3];

/**
 * Read a standard MIDI file. Both file types are the same to us: every track is
 * read and the notes are pooled, because what is wanted is the harmony rather
 * than the arrangement.
 */
export function parseMidiFile(bytes: Uint8Array): ParsedMidi {
  if (bytes.length < 14 || chunkName(bytes, 0) !== 'MThd') {
    throw new Error('Not a MIDI file');
  }
  const division = (bytes[12] << 8) | bytes[13];
  // A negative division is SMPTE timecode, where the low byte is ticks per
  // frame. Nothing here needs real seconds, only which notes are together.
  const ppq = division & 0x8000 ? (division & 0xff) || 96 : division || 96;

  const notes: ImportedNote[] = [];
  let at = 8 + readU32(bytes, 4);
  let track = 0;

  while (at + 8 <= bytes.length) {
    if (chunkName(bytes, at) !== 'MTrk') break;
    const length = readU32(bytes, at + 4);
    const end = Math.min(bytes.length, at + 8 + length);
    let index = at + 8;
    let time = 0;
    let status = 0;
    const open = new Map<number, { pitch: number; start: number }[]>();

    while (index < end) {
      const [delta, next] = readVlq(bytes, index);
      index = next;
      time += delta;
      if (index >= end) break;

      let byte = bytes[index];
      if (byte & 0x80) { status = byte; index++; } // otherwise running status
      const kind = status & 0xf0;

      if (status === 0xff) {
        const type = bytes[index++];
        const [metaLength, afterLength] = readVlq(bytes, index);
        index = afterLength + metaLength;
        if (type === 0x2f) break; // end of track
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const [sysexLength, afterLength] = readVlq(bytes, index);
        index = afterLength + sysexLength;
        continue;
      }

      if (kind === 0x90 || kind === 0x80) {
        const pitch = bytes[index++];
        const velocity = bytes[index++];
        // A note-on at nothing is a note-off; plenty of writers only ever send
        // the one message.
        if (kind === 0x90 && velocity > 0) {
          const held = open.get(pitch) ?? [];
          held.push({ pitch, start: time });
          open.set(pitch, held);
        } else {
          const held = open.get(pitch);
          const started = held?.shift();
          if (started) notes.push({ pitch, start: started.start, duration: time - started.start, track });
        }
        continue;
      }

      // Everything else is one or two bytes of something we do not need.
      index += (kind === 0xc0 || kind === 0xd0) ? 1 : 2;
    }

    // Anything still down when the track ended is taken as sounding to the end.
    for (const held of open.values()) {
      for (const started of held) {
        notes.push({ pitch: started.pitch, start: started.start, duration: Math.max(1, time - started.start), track });
      }
    }

    at = at + 8 + length;
    track++;
  }

  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return { notes, ppq };
}

/**
 * Group notes into chords.
 *
 * A chord is not the notes that start at the same instant — a strummed one is
 * spread over a moment, and splitting it would give six chords of one note. So
 * a new chord begins where there is a gap: notes go on joining the one being
 * built for as long as each arrives within the window of the last, and a longer
 * silence than that starts the next.
 *
 * @param spreadMs how far apart two notes can be and still be the same chord
 */
export function groupIntoChords(
  parsed: ParsedMidi,
  spreadMs = 180,
  bpm = 120,
): ImportedChord[] {
  const { notes, ppq } = parsed;
  if (notes.length === 0) return [];
  const ticksPerMs = ppq / (60000 / bpm);
  const window = Math.max(1, spreadMs * ticksPerMs);

  const chords: ImportedChord[] = [];
  let current: ImportedNote[] = [];
  let lastStart = notes[0].start;

  const flush = () => {
    if (current.length === 0) return;
    const pitches = [...new Set(current.map(n => n.pitch))].sort((a, b) => a - b);
    chords.push({ pitches, start: current[0].start });
    current = [];
  };

  for (const note of notes) {
    if (current.length > 0 && note.start - lastStart > window) flush();
    current.push(note);
    lastStart = note.start;
  }
  flush();

  // A progression that holds a chord for two bars is one chord, not two.
  return chords.filter((chord, i) => {
    if (i === 0) return true;
    const before = chords[i - 1].pitches;
    return before.length !== chord.pitches.length
      || chord.pitches.some((p, j) => p !== before[j]);
  });
}
