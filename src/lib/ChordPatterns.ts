/**
 * Rhythmic patterns for a chord's voices.
 *
 * A pattern says nothing about pitch. It says that voice 3 sounds on the second
 * beat, briefly, and a little softer — the voicing decides what voice 3 is. That
 * is what lets one pattern play any chord, from the pads or from a memory slot,
 * without knowing anything about it.
 *
 * Voices are numbered from the bottom of the voicing up, 1 being the lowest.
 * A pattern may name more voices than a chord has; the player wraps them round
 * rather than dropping the events, so a five-voice pattern keeps its rhythm on
 * a three-note chord.
 *
 * Velocity is an accent, not an absolute: it scales whatever velocity the chord
 * was played at, so the pattern shapes the dynamics without flattening them.
 */

export const TICKS_PER_BEAT = 96;
export const TICKS_PER_BAR = TICKS_PER_BEAT * 4;

export interface PatternEvent {
  voice: number; // 1-based, from the bottom of the voicing
  start: number; // ticks from the start of the pattern
  length: number; // ticks
  velocity: number; // 1-127, scaling the played velocity
  // Octaves away from where the voicing put this voice. Lets a pattern drop a
  // bass an octave or throw a voice up top without the voicing knowing.
  octave?: number;
  // A finer offset in semitones, on top of the octave. Still relative to the
  // voicing rather than an absolute pitch, so the event follows the chord.
  semitones?: number;
  // Sounded once and left ringing rather than re-struck each cycle, until the
  // chord changes or the key is let go. This is what lets a pattern move over a
  // chord that is being held rather than restating the whole chord every time
  // round — the commonest shape there is in real parts.
  hold?: boolean;
}

export type PatternCategory = 'piano' | 'harp' | 'guitar' | 'shapes';

export interface ChordPattern {
  name: string;
  lengthBeats: number;
  events: PatternEvent[];
  category?: PatternCategory; // defaults to piano
}

const T = TICKS_PER_BEAT;
const E = T / 2; // eighth
const S = T / 4; // sixteenth

/** Shorthand: an event at a beat offset, in beats. */
const ev = (voice: number, startBeats: number, lengthBeats: number, velocity: number): PatternEvent => ({
  voice,
  start: Math.round(startBeats * T),
  length: Math.max(1, Math.round(lengthBeats * T)),
  velocity,
});

/** Several voices struck together — a block chord. */
const stack = (voices: number[], startBeats: number, lengthBeats: number, velocity: number): PatternEvent[] =>
  voices.map(v => ev(v, startBeats, lengthBeats, velocity));

/**
 * A chord spread rather than struck: the notes arrive a few ticks apart instead
 * of together. This is what separates a harp or a guitar from a keyboard, and
 * what stops a written chord sounding like a machine hitting every string at
 * once. A tick is a 96th of a beat, so a spread of four is about 25ms at a
 * walking tempo — the speed a hand actually crosses the strings.
 *
 * The roll is bottom-up by default, which is how a harpist places the left hand
 * fractionally before the right, and the notes are given slightly falling
 * velocities so the bottom of the chord speaks first and loudest.
 */
const roll = (
  voices: number[],
  startBeats: number,
  lengthBeats: number,
  velocity: number,
  spreadTicks = 4,
  opts: { down?: boolean; ring?: boolean; octave?: number } = {}
): PatternEvent[] => {
  const order = opts.down ? [...voices].reverse() : voices;
  return order.map((v, i) => ({
    voice: v,
    start: Math.max(0, Math.round(startBeats * T) + i * spreadTicks),
    // Ringing notes keep sounding into what follows, the way a plucked string
    // does; that overlap is most of why a harp sounds like a harp.
    length: Math.max(1, Math.round(lengthBeats * T)),
    velocity: Math.max(1, Math.min(127, velocity - i * 3)),
    ...(opts.ring ? { hold: true } : {}),
    ...(opts.octave ? { octave: opts.octave } : {}),
  }));
};

/** A run of single notes, each left to ring into the next. */
const run = (
  voices: number[],
  startBeats: number,
  stepBeats: number,
  ringBeats: number,
  velocities: number[],
  humanTicks = 0
): PatternEvent[] =>
  voices.map((v, i) => ({
    voice: v,
    // A tick or two either side of the grid. Perfectly placed notes are what
    // make a written part sound typed rather than played.
    start: Math.max(0, Math.round((startBeats + i * stepBeats) * T) + (humanTicks ? ((i * 5) % 3) - 1 : 0)),
    length: Math.max(1, Math.round(ringBeats * T)),
    velocity: velocities[i % velocities.length],
  }));

/** A voice left ringing rather than re-struck: the chord being held under a part. */
const hold = (voice: number, startBeats: number, velocity: number, octave = 0): PatternEvent => ({
  ...ev(voice, startBeats, 4, velocity),
  hold: true,
  ...(octave ? { octave } : {}),
});

// A rhythm spread as evenly as possible over a number of steps. Distributing
// hits this way is what gives a great many folk and dance rhythms their shape —
// 3 over 8 is the tresillo, 5 over 8 the cinquillo.
function euclid(hits: number, steps: number): boolean[] {
  const out: boolean[] = [];
  let bucket = 0;
  for (let i = 0; i < steps; i++) {
    bucket += hits;
    if (bucket >= steps) {
      bucket -= steps;
      out.push(true);
    } else {
      out.push(false);
    }
  }
  return out;
}

export const CHORD_PATTERNS: ChordPattern[] = [
  // The library leans on figuration rather than block chords: single notes in
  // continuous motion, each left ringing into the next, with the accent falling
  // on the first of every group. That is what these instruments actually do
  // behind a song, and it is what a held chord wants moving over it.

  // ---- Piano --------------------------------------------------------------
  {
    // Low, high, middle, high: the accompaniment figure under a great deal of
    // classical keyboard writing.
    name: 'ALBERTI',
    lengthBeats: 4,
    events: [0, 1, 2, 3].flatMap(beat => [
      ev(1, beat, 0.45, 100),
      ev(5, beat + 0.5, 0.45, 78),
      ev(3, beat + 0.25, 0.45, 86),
      ev(5, beat + 0.75, 0.45, 74),
    ]),
  },
  {
    // Four to a beat, up and back: the plainest broken chord there is.
    name: 'BROKEN',
    lengthBeats: 4,
    events: [0, 1, 2, 3].flatMap(b => run([1, 3, 5, 3], b, 0.25, 1.4, [98, 78, 84, 76], 1)),
  },
  {
    name: 'RIPPLE',
    lengthBeats: 4,
    events: run([1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2], 0, 0.25, 1.6,
      [100, 76, 80, 84, 92, 78, 76, 74], 1),
  },
  {
    name: 'TUMBLE',
    lengthBeats: 4,
    events: run([5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4], 0, 0.25, 1.5,
      [98, 80, 78, 76, 90, 74, 76, 78], 1),
  },
  {
    // Outer notes against inner ones, so the hand rocks rather than climbs.
    name: 'ROCKING',
    lengthBeats: 4,
    events: [0, 1, 2, 3].flatMap(b => run([1, 4, 2, 5], b, 0.25, 1.5, [96, 80, 84, 78], 1)),
  },
  {
    name: 'NOCTURNE',
    lengthBeats: 4,
    events: [
      ...run([1], 0, 0.25, 3.6, [96], 0).map(e => ({ ...e, octave: -1 })),
      ...run([3, 5, 2, 4], 0.5, 0.375, 2.2, [78, 84, 76, 82], 1),
      ...run([1], 2, 0.25, 1.9, [90], 0).map(e => ({ ...e, octave: -1 })),
      ...run([3, 5, 4, 5], 2.5, 0.375, 1.6, [80, 86, 78, 84], 1),
    ],
  },
  {
    // Three to the beat against a four-beat bar: it never lands the same way
    // twice inside the bar.
    name: 'TRIPLETS',
    lengthBeats: 4,
    events: [0, 1, 2, 3].flatMap(b => run([1, 3, 5], b, 0.333, 1.3, [96, 78, 84], 1)),
  },
  {
    name: 'WALTZ ARP',
    lengthBeats: 3,
    events: [
      ...run([1], 0, 0.5, 2.8, [102], 0).map(e => ({ ...e, octave: -1 })),
      ...run([3, 5, 4, 5], 1, 0.5, 1.6, [82, 88, 78, 84], 1),
    ],
  },
  {
    // A slow rise that leans harder as it climbs.
    name: 'SWELL',
    lengthBeats: 8,
    events: run([1, 2, 3, 4, 5, 4, 5, 4, 5, 4, 3, 2, 1, 2, 3, 4], 0, 0.5, 2.4,
      [66, 70, 74, 78, 84, 88, 94, 100], 1),
  },
  {
    // Almost still: one voice repeating quietly under a chord that is held.
    name: 'MURMUR',
    lengthBeats: 4,
    events: [
      hold(1, 0, 82, -1), hold(2, 0, 70),
      ...run([3, 5, 3, 4, 3, 5, 3, 4], 0, 0.5, 1.2, [80, 68, 72, 66], 1),
    ],
  },
  {
    // Sparse and high, over a chord left ringing beneath.
    name: 'CHIME',
    lengthBeats: 8,
    events: [
      hold(1, 0, 84, -1), hold(2, 0, 72), hold(3, 0, 70),
      ...run([5], 1, 1, 2.4, [88], 1).map(e => ({ ...e, octave: 1 })),
      ...run([4], 3, 1, 2.4, [80], 1).map(e => ({ ...e, octave: 1 })),
      ...run([5, 4], 5.5, 0.5, 2, [84, 76], 1).map(e => ({ ...e, octave: 1 })),
    ],
  },
  {
    // A run climbing away from a bass that keeps its own time.
    name: 'CLIMB',
    lengthBeats: 4,
    events: [
      ...[0, 2].map(b => ({ ...ev(1, b, 1.8, 100), octave: -1 })),
      ...run([2, 3, 4, 5, 4, 3], 0.5, 0.25, 1.4, [78, 82, 86, 92, 80, 76], 1),
      ...run([2, 3, 4, 5, 4, 3], 2.5, 0.25, 1.2, [76, 80, 84, 90, 78, 74], 1),
    ],
  },

  // ---- Harp ---------------------------------------------------------------
  // A harp has four fingers to a hand and no fifth, so its figures come in
  // threes and fours rather than fives. Its strings ring until they are damped,
  // which is why nothing here is short: the notes pile up into the chord rather
  // than articulating it. Chords are spread from the bottom, the left hand
  // placed a moment before the right, and no two notes ever land together.
  {
    name: 'HARP ROLL',
    category: 'harp',
    lengthBeats: 4,
    events: [
      ...roll([1, 2, 3, 4, 5], 0, 3.9, 104, 5),
      ...roll([1, 2, 3, 4, 5], 2, 1.9, 88, 5),
    ],
  },
  {
    // Four-note groups, each note left ringing into the next: the harp's
    // commonest accompaniment and the reason it sounds continuous rather than
    // rhythmic.
    name: 'HARP FOURS',
    category: 'harp',
    lengthBeats: 4,
    events: [
      ...run([1, 2, 3, 4], 0, 0.25, 1.6, [96, 78, 82, 86], 1),
      ...run([1, 2, 3, 4], 1, 0.25, 1.6, [92, 76, 80, 84], 1),
      ...run([2, 3, 4, 5], 2, 0.25, 1.6, [94, 78, 82, 88], 1),
      ...run([2, 3, 4, 5], 3, 0.25, 1.4, [90, 76, 80, 86], 1),
    ],
  },
  {
    // Threes against a four-beat bar, so the figure turns over inside the bar
    // rather than restating it.
    name: 'HARP THREES',
    category: 'harp',
    lengthBeats: 4,
    events: [
      ...run([1, 3, 5], 0, 0.333, 1.4, [98, 80, 86], 1),
      ...run([2, 4, 5], 1, 0.333, 1.4, [92, 78, 84], 1),
      ...run([1, 3, 4], 2, 0.333, 1.4, [96, 80, 86], 1),
      ...run([2, 4, 5], 3, 0.333, 1.2, [90, 78, 84], 1),
    ],
  },
  {
    // Up and back down without a seam, everything ringing: the figure under a
    // great deal of harp writing.
    name: 'HARP WAVE',
    category: 'harp',
    lengthBeats: 4,
    events: run([1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2], 0, 0.25, 1.8,
      [98, 76, 80, 84, 90, 78, 76, 74], 1),
  },
  {
    // Bisbigliando — "whispering". The same chord alternated softly between the
    // hands, so it shimmers rather than repeats.
    name: 'HARP WHISPER',
    category: 'harp',
    lengthBeats: 4,
    events: Array.from({ length: 16 }, (_, i) =>
      roll(i % 2 === 0 ? [1, 3] : [2, 4], i * 0.25, 1.2, i % 4 === 0 ? 74 : 62, 2)
    ).flat(),
  },
  {
    // A hand crossing over: low, high, middle, high — wide and unhurried.
    name: 'HARP CROSS',
    category: 'harp',
    lengthBeats: 4,
    events: [
      ...run([1], 0, 0.5, 2, [102], 0).map(e => ({ ...e, octave: -1 })),
      ...run([5], 0.5, 0.5, 1.4, [86], 1).map(e => ({ ...e, octave: 1 })),
      ...run([3], 1, 0.5, 1.4, [88], 1),
      ...run([5], 1.5, 0.5, 1.4, [82], 1),
      ...run([1], 2, 0.5, 2, [96], 0).map(e => ({ ...e, octave: -1 })),
      ...run([4], 2.5, 0.5, 1.4, [84], 1),
      ...run([3], 3, 0.5, 1.2, [86], 1),
      ...run([5], 3.5, 0.5, 1, [80], 1),
    ],
  },
  {
    // Falling through the chord, each note still sounding: the gesture a harp
    // makes at the end of a phrase.
    name: 'HARP FALL',
    category: 'harp',
    lengthBeats: 4,
    events: [
      ...roll([1, 2, 3, 4, 5], 0, 3.9, 100, 4),
      ...run([5, 4, 3, 2], 2, 0.25, 1.8, [88, 82, 78, 74], 1),
      ...run([5, 4, 3], 3.25, 0.25, 0.8, [80, 76, 72], 1),
    ],
  },
  {
    // The sweep. Fast, quiet at the start, opening out as it climbs.
    name: 'HARP GLISS',
    category: 'harp',
    lengthBeats: 4,
    events: [
      ...roll([1, 2, 3, 4, 5], 0, 3.9, 96, 3),
      ...run([1, 2, 3, 4, 5, 1, 2, 3, 4, 5], 2, 0.125, 1.6,
        [64, 68, 72, 78, 84, 88, 92, 96, 100, 104], 1)
        .map((e, i) => (i >= 5 ? { ...e, octave: 1 } : e)),
    ],
  },
  {
    // Six-eight, rocking: the harp's lullaby figure.
    name: 'HARP LULLABY',
    category: 'harp',
    lengthBeats: 6,
    events: [
      ...run([1, 3, 5], 0, 0.5, 2.4, [96, 78, 84], 1),
      ...run([2, 4, 5], 1.5, 0.5, 2.4, [88, 76, 82], 1),
      ...run([1, 3, 5], 3, 0.5, 2.4, [94, 78, 84], 1),
      ...run([2, 4, 3], 4.5, 0.5, 1.4, [86, 76, 80], 1),
    ],
  },
  {
    // Almost still: a rolled chord left to ring, touched once in the middle.
    name: 'HARP SLOW',
    category: 'harp',
    lengthBeats: 8,
    events: [
      ...roll([1, 2, 3, 4], 0, 8, 88, 6, { ring: true }),
      ...run([5, 4, 5], 3, 0.5, 2.5, [80, 72, 76], 1),
      ...run([3, 5], 6, 0.5, 1.8, [74, 78], 1),
    ],
  },
  {
    // The same four notes over and over, high and quiet, under everything else.
    name: 'HARP OSTINATO',
    category: 'harp',
    lengthBeats: 4,
    events: [
      // Placed rather than struck: the bass, then the note above it, then the
      // figure — three separate moments, as a hand crossing the strings makes.
      hold(1, 0, 84, -1), hold(2, 0.1, 68),
      ...[0, 1, 2, 3].flatMap(b => run([3, 5, 4, 5], b + 0.05, 0.25, 1.2, [78, 66, 70, 64], 1)),
    ],
  },
  {
    // A figure and its echo, the answer quieter and an octave up.
    name: 'HARP ECHO',
    category: 'harp',
    lengthBeats: 8,
    events: [
      ...run([1, 3, 5, 4], 0, 0.25, 2, [96, 80, 88, 78], 1),
      ...run([1, 3, 5, 4], 2, 0.25, 2, [70, 60, 66, 58], 1).map(e => ({ ...e, octave: 1 })),
      ...run([2, 4, 5, 3], 4, 0.25, 2, [92, 78, 86, 76], 1),
      ...run([2, 4, 5, 3], 6, 0.25, 2, [66, 58, 64, 56], 1).map(e => ({ ...e, octave: 1 })),
    ],
  },

  // ---- Guitar -------------------------------------------------------------
  // Picked rather than strummed: one note to a finger, the strings left ringing
  // between. The two strums that remain are spread across their strings — down
  // from the bass up, up from the top back down — rather than struck at once.
  {
    // p-i-m-a: the classical right hand, one note to a finger, all ringing.
    name: 'PIMA',
    category: 'guitar',
    lengthBeats: 4,
    events: [
      ...run([1, 3, 4, 5], 0, 0.25, 1.8, [100, 78, 82, 88], 1),
      ...run([1, 3, 4, 5], 1, 0.25, 1.8, [92, 76, 80, 86], 1),
      ...run([2, 3, 4, 5], 2, 0.25, 1.8, [96, 78, 82, 88], 1),
      ...run([2, 3, 4, 5], 3, 0.25, 1.4, [90, 76, 80, 84], 1),
    ],
  },
  {
    // p-i-m-a-m-i: out to the top and back, the classical study figure.
    name: 'PIMAMI',
    category: 'guitar',
    lengthBeats: 4,
    events: [0, 2].flatMap(b => run([1, 3, 4, 5, 4, 3], b, 0.333, 1.6,
      [100, 78, 82, 90, 80, 76], 1)),
  },
  {
    // Thumb keeping the bass while the fingers pick between: the pattern under
    // most fingerpicked songs.
    name: 'TRAVIS',
    category: 'guitar',
    lengthBeats: 4,
    events: [
      ...[0, 1, 2, 3].map(b => ({ ...ev(1, b, 0.9, b % 2 === 0 ? 104 : 92), octave: -1 })),
      ...run([3], 0.5, 0.5, 1, [82], 1),
      ...run([5], 1.25, 0.5, 1, [86], 1),
      ...run([4], 1.75, 0.5, 1, [78], 1),
      ...run([3], 2.5, 0.5, 1, [84], 1),
      ...run([5], 3.25, 0.5, 0.8, [88], 1),
      ...run([4], 3.75, 0.5, 0.6, [76], 1),
    ],
  },
  {
    // Slow and picked, one note a beat, everything left to ring.
    name: 'PICKED BALLAD',
    category: 'guitar',
    lengthBeats: 4,
    events: [
      ...roll([1, 2, 3], 0, 4, 92, 5, { ring: true }),
      ...run([5], 1, 0.5, 1.4, [86], 1),
      ...run([4], 2, 0.5, 1.4, [80], 1),
      ...run([5, 4], 3, 0.5, 1, [84, 76], 1),
    ],
  },
  {
    // The folk eighth-note pattern: bass, then the top three answering.
    name: 'FOLK PICK',
    category: 'guitar',
    lengthBeats: 4,
    events: [0, 2].flatMap(b => [
      { ...ev(1, b, 1.8, 102), octave: -1 },
      ...run([3, 5, 4, 3, 5, 4, 3], b + 0.25, 0.25, 1.2,
        [76, 84, 74, 78, 86, 72, 76], 1),
    ]),
  },
  {
    // Three fingers rolling, over and over.
    name: 'ROLL PICK',
    category: 'guitar',
    lengthBeats: 4,
    events: [0, 1, 2, 3].flatMap(b => run([1, 3, 5], b, 0.333, 1.4, [98, 78, 86], 1)),
  },
  {
    // Alternating between two strings across the chord: a cross-picked figure.
    name: 'CROSS PICK',
    category: 'guitar',
    lengthBeats: 4,
    events: [0, 1, 2, 3].flatMap(b => run([1, 5, 2, 4], b, 0.25, 1.5, [96, 84, 78, 80], 1)),
  },
  {
    name: 'DESCENT',
    category: 'guitar',
    lengthBeats: 4,
    events: [0, 2].flatMap(b => run([5, 4, 3, 2, 1, 2, 3, 4], b, 0.25, 1.6,
      [96, 82, 78, 74, 90, 72, 76, 80], 1)),
  },
  {
    // A strum, spread across the strings rather than struck at them.
    name: 'STRUM',
    category: 'guitar',
    lengthBeats: 4,
    events: [
      ...roll([1, 2, 3, 4, 5], 0, 1.4, 106, 4),
      ...roll([1, 2, 3, 4, 5], 1, 0.6, 84, 3),
      ...roll([5, 4, 3, 2], 1.5, 0.5, 76, 3),
      ...roll([1, 2, 3, 4, 5], 2.5, 0.8, 96, 4),
      ...roll([5, 4, 3, 2], 3, 0.5, 74, 3),
      ...roll([1, 2, 3, 4, 5], 3.5, 0.6, 88, 4),
    ],
  },
  {
    // Bass, then chord. The oldest accompaniment there is.
    name: 'BOOM CHICK',
    category: 'guitar',
    lengthBeats: 4,
    events: [
      { ...ev(1, 0, 0.45, 106), octave: -1 },
      ...roll([2, 3, 4, 5], 1, 0.5, 84, 3),
      { ...ev(1, 2, 0.45, 98), octave: -1 },
      ...roll([2, 3, 4, 5], 3, 0.5, 82, 3),
    ],
  },

  // ---- Shapes -------------------------------------------------------------
  // The same continuous motion, arrived at by counting rather than by ear.
  {
    name: 'UP',
    category: 'shapes',
    lengthBeats: 2,
    events: run([1, 2, 3, 4, 5, 6, 7, 8], 0, 0.25, 1.2, [100, 76, 80, 84, 88, 80, 84, 78], 1),
  },
  {
    name: 'DOWN',
    category: 'shapes',
    lengthBeats: 2,
    events: run([8, 7, 6, 5, 4, 3, 2, 1], 0, 0.25, 1.2, [100, 80, 84, 88, 78, 82, 76, 90], 1),
  },
  {
    // Out from the middle to both edges and back.
    name: 'MIRROR',
    category: 'shapes',
    lengthBeats: 4,
    events: run([4, 5, 3, 6, 2, 7, 1, 8, 1, 7, 2, 6, 3, 5, 4, 5], 0, 0.25, 1.4,
      [96, 78, 82, 76, 86, 74, 92, 72], 1),
  },
  {
    // A three-step figure over a four-beat bar, so it comes home every third one.
    name: 'THREE OVER',
    category: 'shapes',
    lengthBeats: 4,
    events: Array.from({ length: 12 }, (_, i) => {
      const voice = (i % 6 >= 3 ? [2, 5, 7] : [1, 4, 6])[i % 3];
      // A contour rather than an on-or-off accent: the figure leans through each
      // pass instead of ticking.
      const velocity = [98, 76, 84, 92, 74, 80][i % 6];
      return ev(voice, i * 0.333, 1.2, velocity);
    }),
  },
  {
    // Widening steps: one, then two, then three, and back in again.
    name: 'EXPAND',
    category: 'shapes',
    lengthBeats: 4,
    events: run([1, 2, 1, 3, 1, 4, 1, 5, 1, 6, 1, 5, 1, 4, 1, 3], 0, 0.25, 1.3,
      [96, 74, 88, 76, 86, 78, 84, 80], 1),
  },
  {
    // Every other rung, so the figure climbs twice as fast as it steps.
    name: 'SKIP',
    category: 'shapes',
    lengthBeats: 4,
    events: run([1, 3, 5, 7, 8, 6, 4, 2, 1, 3, 5, 7, 8, 6, 4, 2], 0, 0.25, 1.4,
      [98, 78, 84, 80, 90, 76, 82, 74], 1),
  },
  {
    // Five hits spread over sixteen, one voice each: it never lands the same way
    // twice until the whole thing comes round.
    name: 'EUCLID 5',
    category: 'shapes',
    lengthBeats: 4,
    events: euclid(5, 16).flatMap((hit, i) =>
      hit ? [ev(((i % 5) + 1), i * 0.25, 1.4, [100, 76, 86, 78, 90][i % 5])] : []
    ),
  },
  {
    name: 'EUCLID 7',
    category: 'shapes',
    lengthBeats: 4,
    events: euclid(7, 16).flatMap((hit, i) =>
      hit ? [ev(((i % 6) + 1), i * 0.25, 1.2, [98, 74, 84, 76, 88, 72][i % 6])] : []
    ),
  },
  {
    // Voice n sounds on step s when bit n of s is set, one note at a time.
    name: 'BINARY',
    category: 'shapes',
    lengthBeats: 4,
    events: Array.from({ length: 16 }, (_, step) => {
      const voice = 1 + (step % 5) + (step % 3);
      return ev(Math.min(8, voice), step * 0.25, 1.1, 72 + ((step * 7) % 5) * 7);
    }),
  },
  {
    // One voice added on each pass, so the figure lengthens as it repeats.
    name: 'ADDITIVE',
    category: 'shapes',
    lengthBeats: 4,
    events: [
      ...run([1, 2, 3], 0, 0.25, 1.2, [96, 76, 82], 1),
      ...run([1, 2, 3, 4], 1, 0.25, 1.2, [92, 74, 80, 84], 1),
      ...run([1, 2, 3, 4, 5], 2, 0.2, 1.4, [96, 76, 82, 86, 90], 1),
      ...run([6, 5, 4, 3], 3, 0.25, 1.2, [88, 78, 76, 74], 1),
    ],
  },
];

export interface RandomOptions {
  seed?: number;
  /** 0-100: how much of the grid is filled. */
  density?: number;
  /** 0-100: how often voices sound together rather than alone. */
  overlap?: number;
}

/**
 * A pattern made on the spot, in the same idiom as the written ones: notes in
 * continuous motion, left ringing, accented on the beat. Left to itself pure
 * randomness gives an undifferentiated clatter, so it is given a grid to land
 * on, a downbeat it must keep, and a leaning towards fewer voices off the beat.
 */
export function randomPattern(opts: RandomOptions | number = {}): ChordPattern {
  const o: RandomOptions = typeof opts === 'number' ? { seed: opts } : opts;
  let s = o.seed ?? Math.floor(Math.random() * 1e9);
  const density = Math.max(0, Math.min(100, o.density ?? 45)) / 100;
  const overlap = Math.max(0, Math.min(100, o.overlap ?? 30)) / 100;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pick = <U,>(arr: U[]): U => arr[Math.floor(rnd() * arr.length)];

  const lengthBeats = pick([2, 4, 4, 4]);
  const grid = pick([0.25, 0.25, 0.5]);
  const steps = Math.round(lengthBeats / grid);
  const events: PatternEvent[] = [];

  for (let i = 0; i < steps; i++) {
    const onBeat = (i * grid) % 1 === 0;
    const chance = i === 0 ? 1 : Math.min(1, density * (onBeat ? 1.5 : 0.85));
    if (rnd() > chance) continue;

    const start = i * grid;
    const velocity = Math.round((onBeat ? 88 : 72) + rnd() * 30);
    const maxVoices = 1 + Math.round(overlap * 4);
    const count = rnd() < overlap ? 1 + Math.floor(rnd() * maxVoices) : 1;
    const chosen = new Set<number>();
    if (i === 0) chosen.add(1);
    let guard = 0;
    while (chosen.size < Math.min(5, count) && guard++ < 24) chosen.add(1 + Math.floor(rnd() * 5));

    // Long enough to ring into what follows, which is what the written patterns
    // do and what keeps a generated one from sounding clipped.
    const length = pick([grid * 4, grid * 5, grid * 6, grid * 3]);
    for (const v of chosen) {
      const event = ev(v, start, length, velocity);
      if (rnd() < 0.12) event.octave = v === 1 ? -1 : v >= 4 ? 1 : 0;
      events.push(event);
    }
  }

  if (events.length === 0) events.push(...stack([1, 2, 3], 0, 1, 100));
  return { name: 'RANDOM', lengthBeats, events };
}

/**
 * Nudge a pattern rather than replace it. The amount is how likely any one note
 * is to be touched, so a low setting varies a figure you already like and a
 * high one takes it somewhere else while keeping its length and its grid.
 *
 * What it will not do is empty the bar or lose the downbeat: a pattern that
 * comes back silent is not a variation, and one that has lost its first beat
 * stops sounding like the same idea.
 */
export function mutatePattern(pattern: ChordPattern, amount: number, seed?: number): ChordPattern {
  const strength = Math.max(0, Math.min(100, amount)) / 100;
  if (strength === 0) return pattern;
  let s = seed ?? Math.floor(Math.random() * 1e9);
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const totalTicks = Math.round(pattern.lengthBeats * TICKS_PER_BEAT);
  const grid = TICKS_PER_BEAT / 4;
  const events: PatternEvent[] = [];

  for (const event of pattern.events) {
    if (rnd() > strength) {
      events.push({ ...event });
      continue;
    }
    // Dropping a note is a real variation, but only at higher settings and
    // never so often that the bar thins out.
    if (rnd() < strength * 0.25 && pattern.events.length > 3) continue;

    const next: PatternEvent = { ...event };
    const reach = 1 + Math.floor(strength * 3);

    // Move it on the grid.
    if (rnd() < 0.6) {
      const steps = Math.round((rnd() * 2 - 1) * reach);
      next.start = Math.max(0, Math.min(totalTicks - 1, next.start + steps * grid));
    }
    // Give it to a neighbouring voice.
    if (rnd() < 0.5) {
      const step = rnd() < 0.5 ? -1 : 1;
      next.voice = Math.max(1, Math.min(8, next.voice + step));
    }
    // Lean on it, or back off it.
    if (rnd() < 0.6) {
      next.velocity = Math.max(30, Math.min(127, Math.round(next.velocity + (rnd() * 2 - 1) * 30 * strength)));
    }
    // Let it ring longer, or clip it.
    if (rnd() < 0.4) {
      const factor = 0.5 + rnd() * 1.5;
      next.length = Math.max(grid, Math.round(next.length * factor));
    }
    // Occasionally throw one an octave, where an octave reads as reach.
    if (rnd() < strength * 0.2) next.octave = rnd() < 0.5 ? -1 : 1;
    events.push(next);
  }

  // Add a note or two at the stronger settings, so a pattern can grow and not
  // only erode.
  const additions = Math.floor(strength * 3 * rnd());
  for (let i = 0; i < additions; i++) {
    const stepCount = Math.max(1, Math.round(totalTicks / grid));
    events.push({
      voice: 1 + Math.floor(rnd() * 5),
      start: Math.floor(rnd() * stepCount) * grid,
      length: grid * (1 + Math.floor(rnd() * 3)),
      velocity: Math.round(70 + rnd() * 40),
    });
  }

  if (!events.some(e => e.start === 0)) {
    const first = [...pattern.events].sort((a, b) => a.start - b.start)[0];
    if (first) events.push({ ...first, start: 0 });
  }
  if (events.length === 0) return pattern;

  events.sort((a, b) => a.start - b.start);
  return { ...pattern, name: pattern.name, events };
}

/** Ticks in one cycle of a pattern. */
export const patternTicks = (p: ChordPattern): number => Math.round(p.lengthBeats * TICKS_PER_BEAT);

/** How long one cycle lasts at a tempo, in milliseconds. */
export const patternDurationMs = (p: ChordPattern, bpm: number): number =>
  (60000 / Math.max(1, bpm)) * p.lengthBeats;
