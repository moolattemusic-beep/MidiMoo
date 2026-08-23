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
}

export interface ChordPattern {
  name: string;
  lengthBeats: number;
  events: PatternEvent[];
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
  // ---- Played styles ----------------------------------------------------
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
    name: 'WALTZ',
    lengthBeats: 3,
    events: [
      ev(1, 0, 0.9, 108),
      ...stack([2, 3, 4], 1, 0.8, 80),
      ...stack([2, 3, 4], 2, 0.8, 72),
    ],
  },
  {
    // The chord answers the bass off the beat, the way a guitar does behind a
    // bossa.
    name: 'BOSSA',
    lengthBeats: 4,
    events: [
      ev(1, 0, 1.4, 104),
      ...stack([2, 3, 4, 5], 0.5, 0.4, 84),
      ...stack([2, 3, 4, 5], 1.75, 0.5, 92),
      ev(1, 2.5, 1.2, 96),
      ...stack([2, 3, 4, 5], 3, 0.4, 80),
    ],
  },
  {
    // One of the most quoted rhythms there is: the downbeat, then a push on the
    // and of two.
    name: 'CHARLESTON',
    lengthBeats: 4,
    events: [
      ...stack([1, 2, 3, 4, 5], 0, 1.2, 110),
      ...stack([1, 2, 3, 4, 5], 1.5, 1.4, 92),
    ],
  },
  {
    name: 'HABANERA',
    lengthBeats: 4,
    events: [
      ...stack([1, 2, 3], 0, 0.7, 112),
      ...stack([1, 2, 3], 0.75, 0.4, 84),
      ...stack([2, 3, 4], 1.5, 0.45, 96),
      ...stack([2, 3, 4], 2.5, 0.45, 88),
      ev(1, 3, 0.9, 92),
    ],
  },
  {
    // Every off-beat eighth, cut short. The four-to-the-floor chord stab.
    name: 'HOUSE',
    lengthBeats: 4,
    events: [0.5, 1.5, 2.5, 3.5].flatMap(b => stack([1, 2, 3, 4, 5], b, 0.3, b === 0.5 ? 104 : 92)),
  },
  {
    // Voices arriving in quick succession and then held: a hand rolling into a
    // chord rather than striking it.
    name: 'GOSPEL',
    lengthBeats: 4,
    events: [
      ev(1, 0, 3.6, 104),
      ev(2, 0.08, 3.4, 90),
      ev(3, 0.16, 3.3, 94),
      ev(4, 0.24, 3.2, 98),
      ev(5, 0.32, 3.1, 102),
      ...stack([3, 4, 5], 2.5, 0.4, 76),
    ],
  },
  {
    name: 'NEO SOUL',
    lengthBeats: 4,
    events: [
      ev(1, 0, 1.8, 100),
      ...stack([3, 4], 0.75, 0.6, 88),
      ...stack([2, 5], 1.5, 0.7, 80),
      ev(1, 2, 1.6, 92),
      ...stack([3, 4, 5], 2.75, 0.5, 96),
      ev(2, 3.5, 0.4, 72),
    ],
  },
  {
    // The chord arrives fractionally before the beat it belongs to, which is
    // what makes a rhythm section feel like it is leaning forward.
    name: 'PUSH',
    lengthBeats: 4,
    events: [
      ev(1, 0, 1.4, 106),
      ...stack([2, 3, 4, 5], 1.75, 1.1, 98),
      ...stack([2, 3, 4, 5], 3.75, 0.9, 90),
    ],
  },
  {
    name: 'BALLAD',
    lengthBeats: 4,
    events: [
      ev(1, 0, 3.8, 96),
      ...stack([2, 3], 0.5, 3.2, 74),
      ...stack([4, 5], 2, 1.8, 82),
    ],
  },
  {
    // Nothing but the pulse, every voice together. A baseline to hear a voicing
    // against, and the plainest thing to edit from.
    name: 'PULSE',
    lengthBeats: 4,
    events: [0, 1, 2, 3].flatMap(b => stack([1, 2, 3, 4, 5], b, 0.8, b === 0 ? 108 : 88)),
  },
  {
    name: 'SPARSE',
    lengthBeats: 4,
    events: [
      ev(1, 0, 1.8, 104),
      ...stack([2, 3, 4, 5], 2, 1.4, 90),
      ev(5, 3.5, 0.4, 78),
    ],
  },

  // ---- Constructed ------------------------------------------------------
  {
    name: 'UP',
    lengthBeats: 2,
    events: [1, 2, 3, 4, 5, 4, 3, 2].map((v, i) => ev(v, i * 0.25, 0.22, i === 0 ? 104 : 84)),
  },
  {
    name: 'DOWN',
    lengthBeats: 2,
    events: [5, 4, 3, 2, 1, 2, 3, 4].map((v, i) => ev(v, i * 0.25, 0.22, i === 0 ? 104 : 84)),
  },
  {
    // Odd against even: the pairs walk out of step with each other and only
    // meet again where the cycle closes.
    name: 'ROTATE',
    lengthBeats: 4,
    events: [[1, 3], [2, 4], [3, 5], [4, 1], [5, 2], [1, 4], [2, 5], [3, 1]].flatMap(
      (pair, i) => stack(pair, i * 0.5, 0.45, i % 2 === 0 ? 96 : 80)
    ),
  },
  {
    // Voice n sounds on step s when bit n of s is set, so the chord fills in and
    // empties out on a fixed count.
    name: 'BINARY',
    lengthBeats: 4,
    events: Array.from({ length: 16 }, (_, step) =>
      [1, 2, 3, 4, 5].filter(v => (step >> (v - 1)) & 1).map(v => ev(v, step * 0.25, 0.22, 76 + (v * 6)))
    ).flat(),
  },
  {
    name: 'TRESILLO',
    lengthBeats: 4,
    events: euclid(3, 8).flatMap((hit, i) =>
      hit ? stack([1, 2, 3, 4, 5], i * 0.5, 0.45, i === 0 ? 108 : 90) : []
    ),
  },
  {
    name: 'CINQUILLO',
    lengthBeats: 4,
    events: euclid(5, 8).flatMap((hit, i) =>
      hit ? stack(i % 2 === 0 ? [1, 3, 5] : [2, 4], i * 0.5, 0.4, i === 0 ? 106 : 86) : []
    ),
  },
  {
    // Each pass adds a voice and holds it, so the chord assembles itself over
    // the cycle rather than arriving whole.
    name: 'ADDITIVE',
    lengthBeats: 4,
    events: [
      ...[1, 2, 3].map((v, i) => ev(v, i * 0.25, 0.9, 92)),
      ...[1, 2, 3, 4].map((v, i) => ev(v, 1 + i * 0.25, 0.9, 88)),
      ...[1, 2, 3, 4, 5].map((v, i) => ev(v, 2 + i * 0.2, 1.4, 96)),
      ...[5, 4, 3].map((v, i) => ev(v, 3 + i * 0.25, 0.7, 82)),
    ],
  },
  {
    // Long overlapping entries, one voice per beat, none of them released until
    // the cycle turns over: the chord as a slow bloom.
    name: 'CASCADE',
    lengthBeats: 4,
    events: [1, 2, 3, 4, 5].map((v, i) => ev(v, i * 0.75, 4 - (i * 0.75), 78 + i * 8)),
  },
];

/**
 * A pattern made on the spot. Left to itself pure randomness gives an
 * undifferentiated clatter, so this is given the same things a written pattern
 * has: a grid to land on, a bass that mostly keeps the downbeat, a leaning
 * towards fewer voices off the beat, and accents on the beat.
 */
export function randomPattern(seed?: number): ChordPattern {
  let s = seed ?? Math.floor(Math.random() * 1e9);
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
    // Downbeats earn their hit; the spaces between are thinned out, which is
    // what keeps a random rhythm from turning into a wall.
    const chance = i === 0 ? 1 : onBeat ? 0.55 : 0.3;
    if (rnd() > chance) continue;

    const start = i * grid;
    const velocity = Math.round((onBeat ? 88 : 72) + rnd() * 30);
    // Fewer voices off the beat, so the strong positions stay the full ones.
    const count = onBeat ? 1 + Math.floor(rnd() * 4) : 1 + Math.floor(rnd() * 2);
    const chosen = new Set<number>();
    if (i === 0) chosen.add(1);
    while (chosen.size < count) chosen.add(1 + Math.floor(rnd() * 5));

    const length = pick([grid * 0.8, grid * 0.8, grid * 1.6, grid * 3]);
    for (const v of chosen) {
      const event = ev(v, start, Math.min(length, lengthBeats - start), velocity);
      // Occasionally, and only at the edges of the voicing, where an octave
      // reads as reach rather than as a wrong note.
      if (rnd() < 0.12) event.octave = v === 1 ? -1 : v >= 4 ? 1 : 0;
      events.push(event);
    }
  }

  if (events.length === 0) events.push(...stack([1, 2, 3], 0, 1, 100));
  return { name: 'RANDOM', lengthBeats, events };
}

/** Ticks in one cycle of a pattern. */
export const patternTicks = (p: ChordPattern): number => Math.round(p.lengthBeats * TICKS_PER_BEAT);

/** How long one cycle lasts at a tempo, in milliseconds. */
export const patternDurationMs = (p: ChordPattern, bpm: number): number =>
  (60000 / Math.max(1, bpm)) * p.lengthBeats;
