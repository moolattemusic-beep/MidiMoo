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

  // ---- Harp ---------------------------------------------------------------
  // A harp has four fingers to a hand and no fifth, so its figures come in
  // threes and fours rather than fives. Its strings ring until they are damped,
  // which is why almost nothing here is short: the notes are meant to pile up
  // into the chord rather than articulate it. Chords are spread from the bottom,
  // the left hand placed a moment before the right.
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

  // ---- Guitar -------------------------------------------------------------
  // A guitar is struck across its strings rather than at them, so its chords
  // are spread — down-strokes from the bass up, up-strokes from the top back
  // down — and the strings keep ringing between strokes.
  {
    name: 'STRUM',
    category: 'guitar',
    lengthBeats: 4,
    events: [
      ...roll([1, 2, 3, 4, 5], 0, 1.4, 106, 4),
      ...roll([1, 2, 3, 4, 5], 1, 0.6, 84, 3),
      ...roll([5, 4, 3, 2], 1.5, 0.5, 76, 3, { down: false }),
      ...roll([1, 2, 3, 4, 5], 2.5, 0.8, 96, 4),
      ...roll([5, 4, 3, 2], 3, 0.5, 74, 3),
      ...roll([1, 2, 3, 4, 5], 3.5, 0.6, 88, 4),
    ],
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
  {
    // Flamenco: a fast flourish across the strings, then the chord left ringing.
    name: 'RASGUEADO',
    category: 'guitar',
    lengthBeats: 4,
    events: [
      ...roll([1, 2, 3, 4, 5], 0, 1.8, 108, 2),
      ...roll([5, 4, 3, 2, 1], 1, 0.5, 78, 2),
      ...roll([1, 2, 3, 4, 5], 1.5, 1.4, 96, 2),
      ...roll([1, 2, 3, 4, 5], 2.75, 0.4, 86, 2),
      ...roll([5, 4, 3, 2, 1], 3.25, 0.4, 74, 2),
      ...roll([1, 2, 3, 4, 5], 3.5, 0.5, 92, 2),
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
    // Up-strokes only, cut short: the off-beat chop.
    name: 'CHOP',
    category: 'guitar',
    lengthBeats: 4,
    events: [0.5, 1.5, 2.5, 3.5].flatMap(b =>
      roll([5, 4, 3, 2], b, 0.22, b === 0.5 ? 100 : 88, 2)
    ),
  },

  // ---- Constructed ------------------------------------------------------
  {
    name: 'UP',
    category: 'shapes',
    lengthBeats: 2,
    events: [1, 2, 3, 4, 5, 4, 3, 2].map((v, i) => ev(v, i * 0.25, 0.22, i === 0 ? 104 : 84)),
  },
  {
    name: 'DOWN',
    category: 'shapes',
    lengthBeats: 2,
    events: [5, 4, 3, 2, 1, 2, 3, 4].map((v, i) => ev(v, i * 0.25, 0.22, i === 0 ? 104 : 84)),
  },
  {
    // Odd against even: the pairs walk out of step with each other and only
    // meet again where the cycle closes.
    name: 'ROTATE',
    category: 'shapes',
    lengthBeats: 4,
    events: [[1, 3], [2, 4], [3, 5], [4, 1], [5, 2], [1, 4], [2, 5], [3, 1]].flatMap(
      (pair, i) => stack(pair, i * 0.5, 0.45, i % 2 === 0 ? 96 : 80)
    ),
  },
  {
    // Voice n sounds on step s when bit n of s is set, so the chord fills in and
    // empties out on a fixed count.
    name: 'BINARY',
    category: 'shapes',
    lengthBeats: 4,
    events: Array.from({ length: 16 }, (_, step) =>
      [1, 2, 3, 4, 5].filter(v => (step >> (v - 1)) & 1).map(v => ev(v, step * 0.25, 0.22, 76 + (v * 6)))
    ).flat(),
  },
  {
    name: 'TRESILLO',
    category: 'shapes',
    lengthBeats: 4,
    events: euclid(3, 8).flatMap((hit, i) =>
      hit ? stack([1, 2, 3, 4, 5], i * 0.5, 0.45, i === 0 ? 108 : 90) : []
    ),
  },
  {
    name: 'CINQUILLO',
    category: 'shapes',
    lengthBeats: 4,
    events: euclid(5, 8).flatMap((hit, i) =>
      hit ? stack(i % 2 === 0 ? [1, 3, 5] : [2, 4], i * 0.5, 0.4, i === 0 ? 106 : 86) : []
    ),
  },
  {
    // Each pass adds a voice and holds it, so the chord assembles itself over
    // the cycle rather than arriving whole.
    name: 'ADDITIVE',
    category: 'shapes',
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
    category: 'shapes',
    lengthBeats: 4,
    events: [1, 2, 3, 4, 5].map((v, i) => ev(v, i * 0.75, 4 - (i * 0.75), 78 + i * 8)),
  },

  // ---- More played styles ------------------------------------------------
  {
    // Bass and chord alternating on and off the beat, the left hand of a stride
    // piano.
    name: 'STRIDE',
    lengthBeats: 4,
    events: [
      { ...ev(1, 0, 0.4, 108), octave: -1 },
      ...stack([2, 3, 4], 0.5, 0.4, 84),
      ev(1, 1, 0.4, 96),
      ...stack([2, 3, 4], 1.5, 0.4, 80),
      { ...ev(1, 2, 0.4, 104), octave: -1 },
      ...stack([2, 3, 4], 2.5, 0.4, 84),
      ev(1, 3, 0.4, 96),
      ...stack([3, 4, 5], 3.5, 0.4, 88),
    ],
  },
  {
    // Every eighth, the chord answering itself: the engine room of a great deal
    // of rock and gospel piano.
    name: 'DRIVE',
    lengthBeats: 4,
    events: Array.from({ length: 8 }, (_, i) =>
      stack(i % 2 === 0 ? [1, 2, 3] : [3, 4, 5], i * 0.5, 0.4, i % 2 === 0 ? 100 : 82)
    ).flat(),
  },
  {
    // The bass walking in quarters while the chord answers off the beat.
    name: 'WALKING',
    lengthBeats: 4,
    events: [
      ...[0, 1, 2, 3].map(b => ({ ...ev(1, b, 0.85, b === 0 ? 104 : 92), octave: -1 })),
      ...stack([3, 4], 0.5, 0.4, 78),
      ...stack([2, 5], 1.5, 0.4, 74),
      ...stack([3, 4], 2.5, 0.4, 78),
      ...stack([2, 3, 5], 3.5, 0.4, 84),
    ],
  },
  {
    // Long chord under a bass that moves once in the middle: the plainest useful
    // accompaniment there is.
    name: 'HYMN',
    lengthBeats: 4,
    events: [
      { ...ev(1, 0, 1.9, 100), octave: -1 },
      ...stack([2, 3, 4, 5], 0, 3.9, 82),
      { ...ev(1, 2, 1.9, 92), octave: -1 },
    ],
  },
  {
    // Sixteenths on one voice with the chord punctuating: a shuffle feel.
    name: 'SHUFFLE',
    lengthBeats: 4,
    events: [0, 1, 2, 3].flatMap(b => [
      ev(1, b, 0.3, b === 0 ? 104 : 92),
      ev(3, b + 0.66, 0.28, 78),
      ...(b % 2 === 1 ? stack([2, 4, 5], b + 0.33, 0.28, 84) : []),
    ]),
  },
  {
    // The chord held while a single voice moves above it, a countermelody
    // rather than a rhythm.
    name: 'COUNTER',
    lengthBeats: 4,
    events: [
      ...stack([1, 2, 3], 0, 3.9, 84),
      ev(5, 0.5, 0.45, 96),
      { ...ev(4, 1.25, 0.45, 88), semitones: 2 },
      ev(5, 2, 0.45, 94),
      { ...ev(5, 2.75, 0.45, 90), octave: 1 },
      ev(4, 3.5, 0.45, 86),
    ],
  },
  {
    // Two chords a bar, both anticipated: a reggae-leaning skank on the off.
    name: 'SKANK',
    category: 'guitar',
    lengthBeats: 4,
    events: [
      ...stack([2, 3, 4, 5], 0.5, 0.25, 96),
      ...stack([2, 3, 4, 5], 1.5, 0.25, 88),
      ...stack([2, 3, 4, 5], 2.5, 0.25, 96),
      ...stack([2, 3, 4, 5], 3.5, 0.25, 88),
      { ...ev(1, 0, 0.9, 104), octave: -1 },
      { ...ev(1, 2, 0.9, 98), octave: -1 },
    ],
  },
  {
    // Slow, wide and unhurried: two entries a bar with everything ringing.
    name: 'AMBIENT',
    lengthBeats: 8,
    events: [
      { ...ev(1, 0, 7.8, 76), octave: -1 },
      ...stack([2, 3], 0.5, 7, 68),
      { ...ev(4, 2, 5.5, 74), octave: 1 },
      { ...ev(5, 4, 3.8, 80), octave: 1 },
      ev(3, 6, 1.8, 66),
    ],
  },

  // ---- More constructed --------------------------------------------------
  {
    // Five hits spread over sixteen: the rhythm never lands where the last cycle
    // did until the whole thing comes round.
    name: 'EUCLID 5',
    category: 'shapes',
    lengthBeats: 4,
    events: euclid(5, 16).flatMap((hit, i) =>
      hit ? stack([((i % 5) + 1)], i * 0.25, 0.24, i === 0 ? 106 : 84) : []
    ),
  },
  {
    name: 'EUCLID 7',
    category: 'shapes',
    lengthBeats: 4,
    events: euclid(7, 16).flatMap((hit, i) =>
      hit ? stack(i % 3 === 0 ? [1, 3] : [((i % 5) + 1)], i * 0.25, 0.24, i === 0 ? 104 : 82) : []
    ),
  },
  {
    // Voices paired off in a widening span, so the chord opens out from the
    // middle to its edges and closes again.
    name: 'MIRROR',
    category: 'shapes',
    lengthBeats: 4,
    events: [[3], [2, 4], [1, 5], [2, 4], [3], [2, 4], [1, 5], [2, 4]].flatMap(
      (group, i) => stack(group, i * 0.5, 0.45, i % 4 === 0 ? 100 : 82)
    ),
  },
  // ---- Held chord with a part moving over it -----------------------------
  // The shape most real parts take: the middle of the chord sustains while the
  // bass and the top move. Measured across a library of written parts, the
  // middle voices hold about two thirds of the time while the lowest voice is
  // the most rhythmically active of all — the opposite of the obvious guess —
  // and single notes make up about half of everything played.
  {
    // Bass walking under a chord that never restates itself.
    name: 'PEDAL BASS',
    lengthBeats: 4,
    events: [
      hold(2, 0, 84), hold(3, 0, 82), hold(4, 0, 80),
      { ...ev(1, 0, 0.45, 104), octave: -1 },
      { ...ev(1, 1.5, 0.45, 92), octave: -1 },
      { ...ev(1, 2.5, 0.45, 96), octave: -1 },
      { ...ev(1, 3.5, 0.45, 88), octave: -1 },
    ],
  },
  {
    // The chord held, a single voice picking out a line above it.
    name: 'PEDAL TOP',
    lengthBeats: 4,
    events: [
      hold(1, 0, 88), hold(2, 0, 80), hold(3, 0, 78),
      ev(5, 0.5, 0.4, 100),
      ev(4, 1.25, 0.4, 88),
      ev(5, 2, 0.4, 96),
      { ...ev(5, 2.75, 0.4, 92), octave: 1 },
      ev(4, 3.5, 0.4, 86),
    ],
  },
  {
    // Both ends moving around a sustained middle.
    name: 'PEDAL BOTH',
    lengthBeats: 4,
    events: [
      hold(2, 0, 80), hold(3, 0, 78),
      { ...ev(1, 0, 0.4, 102), octave: -1 },
      ev(5, 0.75, 0.35, 94),
      { ...ev(1, 1.5, 0.4, 90), octave: -1 },
      ev(4, 2.25, 0.35, 88),
      { ...ev(1, 2.5, 0.4, 96), octave: -1 },
      ev(5, 3.25, 0.35, 92),
    ],
  },
  {
    // Almost nothing but a held chord, touched once a bar.
    name: 'PEDAL SLOW',
    lengthBeats: 8,
    events: [
      hold(1, 0, 86, -1), hold(2, 0, 78), hold(3, 0, 76), hold(4, 0, 74),
      ev(5, 2, 1.5, 88),
      ev(5, 5.5, 1.2, 82),
    ],
  },
  {
    // Sixteenth movement on one voice over a held chord: an ostinato.
    name: 'OSTINATO',
    lengthBeats: 4,
    events: [
      hold(1, 0, 86, -1), hold(2, 0, 76), hold(4, 0, 74),
      ...[0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]
        .map((b, i) => ev(i % 4 === 0 ? 5 : 3, b, 0.22, i % 4 === 0 ? 96 : 74)),
    ],
  },
  {
    // Single notes, one at a time, over a sustained root: the sparsest way to
    // keep a chord moving.
    name: 'TRICKLE',
    lengthBeats: 4,
    events: [
      hold(1, 0, 84, -1),
      ev(3, 0.5, 0.4, 92),
      ev(5, 1.25, 0.4, 86),
      ev(4, 2.25, 0.4, 90),
      ev(2, 3, 0.4, 80),
      { ...ev(5, 3.5, 0.4, 88), octave: 1 },
    ],
  },
  {
    // Held chord, answered by a two-note figure that pushes the beat.
    name: 'ANSWER',
    lengthBeats: 4,
    events: [
      hold(1, 0, 88, -1), hold(3, 0, 78),
      ...stack([4, 5], 1.75, 0.4, 96),
      ...stack([2, 4], 2.75, 0.4, 84),
      ...stack([4, 5], 3.75, 0.4, 92),
    ],
  },
  {
    // The bass alone under a chord that arrives late and stays.
    name: 'LATE PAD',
    lengthBeats: 4,
    events: [
      { ...ev(1, 0, 0.5, 104), octave: -1 },
      { ...ev(1, 2, 0.5, 92), octave: -1 },
      hold(2, 0.5, 74), hold(3, 0.5, 76), hold(4, 0.5, 78), hold(5, 0.5, 72),
    ],
  },
  {
    // A three-step figure over a four-beat cycle, so it lands somewhere new each
    // bar and only comes home every third one.
    name: 'THREE OVER',
    category: 'shapes',
    lengthBeats: 4,
    events: Array.from({ length: 6 }, (_, i) => {
      const voice = [1, 3, 5][i % 3];
      const event = ev(voice, i * 0.666, 0.6, i % 3 === 0 ? 102 : 82);
      return i % 3 === 2 ? { ...event, octave: 1 } : event;
    }),
  },
];

/**
 * A pattern made on the spot. Left to itself pure randomness gives an
 * undifferentiated clatter, so this is given the same things a written pattern
 * has: a grid to land on, a bass that mostly keeps the downbeat, a leaning
 * towards fewer voices off the beat, and accents on the beat.
 */
export interface RandomOptions {
  seed?: number;
  /** 0-100: how much of the grid is filled. */
  density?: number;
  /** 0-100: how often voices sound together rather than alone. */
  overlap?: number;
}

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
    // Density sets the general fill; the beat still earns more than the spaces
    // between, which is what keeps a random rhythm from turning into a wall.
    const chance = i === 0 ? 1 : Math.min(1, density * (onBeat ? 1.5 : 0.85));
    if (rnd() > chance) continue;

    const start = i * grid;
    const velocity = Math.round((onBeat ? 88 : 72) + rnd() * 30);
    // Overlap decides how readily voices stack. At zero the pattern is a single
    // line; at full it leans on block chords.
    const maxVoices = 1 + Math.round(overlap * 4);
    const count = rnd() < overlap ? 1 + Math.floor(rnd() * maxVoices) : 1;
    const chosen = new Set<number>();
    if (i === 0) chosen.add(1);
    let guard = 0;
    while (chosen.size < Math.min(5, count) && guard++ < 24) chosen.add(1 + Math.floor(rnd() * 5));

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
