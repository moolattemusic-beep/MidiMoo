/**
 * Voicings taken from how these chords are actually played.
 *
 * Every shape here was lifted from a library of written progressions — 233
 * presets, some six and a half thousand chords — by working out each chord's
 * root and quality and then recording where the notes sat relative to that root.
 * What they show is that a played voicing is nothing like a stack of thirds in
 * one octave: the median spans about two octaves, the seventh is as likely to
 * sit below the third as above it, and the bass is frequently not the root at
 * all.
 *
 * Intervals are semitones from the root. The first is not always zero — a shape
 * beginning at 7 is one whose lowest sounding note is the fifth, which is how
 * an inversion is written here. Weight is how often that exact shape turned up,
 * so the commonest way of playing a chord ranks first.
 */

export type VoicingQuality =
  | 'maj' | 'min' | 'dom' | 'maj7' | 'min7' | 'sus' | 'halfdim' | 'dim';

export interface Voicing {
  quality: VoicingQuality;
  /** Semitones from the root, low to high. */
  intervals: number[];
  /** How often this exact shape appeared in the source library. */
  weight: number;
}

export const VOICINGS: Voicing[] = [
  // ---- maj7 --------------------------------------------------------
  { quality: 'maj7', intervals: [0, 11, 14, 16, 19], weight: 51 },
  { quality: 'maj7', intervals: [2, 12, 16, 19, 23], weight: 42 },
  { quality: 'maj7', intervals: [0, 14, 16, 19, 23], weight: 37 },
  { quality: 'maj7', intervals: [0, 12, 16, 19, 23], weight: 35 },
  { quality: 'maj7', intervals: [0, 16, 19, 23], weight: 30 },
  { quality: 'maj7', intervals: [0, 16, 19, 23, 26], weight: 28 },
  { quality: 'maj7', intervals: [0, 7, 11, 14, 16, 19], weight: 28 },
  { quality: 'maj7', intervals: [0, 11, 16, 19], weight: 27 },
  { quality: 'maj7', intervals: [0, 7, 11, 14, 16], weight: 26 },
  { quality: 'maj7', intervals: [0, 4, 7, 11], weight: 24 },
  { quality: 'maj7', intervals: [0, 7, 11, 16], weight: 20 },
  { quality: 'maj7', intervals: [0, 11, 14, 16, 19, 23], weight: 18 },
  { quality: 'maj7', intervals: [2, 12, 16, 19, 23, 26], weight: 17 },
  { quality: 'maj7', intervals: [0, 19, 23, 28], weight: 14 },
  { quality: 'maj7', intervals: [7, 11, 12, 16], weight: 12 },
  { quality: 'maj7', intervals: [0, 12, 14, 16, 19, 23], weight: 12 },

  // ---- min7 --------------------------------------------------------
  { quality: 'min7', intervals: [0, 10, 15, 19], weight: 72 },
  { quality: 'min7', intervals: [0, 10, 14, 15, 19], weight: 69 },
  { quality: 'min7', intervals: [0, 15, 19, 22, 26], weight: 67 },
  { quality: 'min7', intervals: [0, 3, 7, 10, 14], weight: 56 },
  { quality: 'min7', intervals: [0, 14, 15, 19, 22], weight: 40 },
  { quality: 'min7', intervals: [0, 12, 15, 19, 22], weight: 40 },
  { quality: 'min7', intervals: [0, 7, 10, 15], weight: 36 },
  { quality: 'min7', intervals: [0, 15, 19, 22], weight: 29 },
  { quality: 'min7', intervals: [0, 10, 14, 15, 19, 22], weight: 27 },
  { quality: 'min7', intervals: [0, 7, 10, 14, 15, 19], weight: 26 },
  { quality: 'min7', intervals: [0, 3, 7, 10, 14, 17], weight: 25 },
  { quality: 'min7', intervals: [0, 7, 10, 15, 19], weight: 25 },
  { quality: 'min7', intervals: [0, 12, 15, 19, 22, 26], weight: 22 },
  { quality: 'min7', intervals: [0, 3, 7, 10], weight: 20 },
  { quality: 'min7', intervals: [0, 15, 17, 19, 22, 26], weight: 20 },
  { quality: 'min7', intervals: [0, 19, 22, 27], weight: 19 },

  // ---- dom ---------------------------------------------------------
  { quality: 'dom', intervals: [0, 16, 20, 22, 27], weight: 13 },
  { quality: 'dom', intervals: [0, 10, 14, 16, 21], weight: 12 },
  { quality: 'dom', intervals: [0, 10, 14, 16, 19], weight: 9 },
  { quality: 'dom', intervals: [0, 4, 10, 12], weight: 8 },
  { quality: 'dom', intervals: [0, 10, 13, 16, 19], weight: 8 },
  { quality: 'dom', intervals: [0, 4, 8, 10, 15], weight: 8 },
  { quality: 'dom', intervals: [0, 4, 10, 15], weight: 8 },
  { quality: 'dom', intervals: [10, 24, 26, 28, 33], weight: 8 },
  { quality: 'dom', intervals: [0, 10, 16, 20], weight: 7 },
  { quality: 'dom', intervals: [0, 16, 22, 24], weight: 7 },
  { quality: 'dom', intervals: [0, 4, 10, 13], weight: 7 },
  { quality: 'dom', intervals: [0, 4, 10, 15, 20, 24], weight: 7 },
  { quality: 'dom', intervals: [0, 16, 19, 22], weight: 6 },
  { quality: 'dom', intervals: [9, 16, 19, 22, 24, 28], weight: 6 },
  { quality: 'dom', intervals: [0, 4, 10, 14, 18, 21], weight: 5 },
  { quality: 'dom', intervals: [0, 12, 16, 20, 22, 27], weight: 5 },

  // ---- maj ---------------------------------------------------------
  { quality: 'maj', intervals: [0, 12, 16, 19], weight: 17 },
  { quality: 'maj', intervals: [0, 7, 12, 16], weight: 15 },
  { quality: 'maj', intervals: [0, 16, 19, 24], weight: 12 },
  { quality: 'maj', intervals: [0, 19, 24, 28], weight: 7 },
  { quality: 'maj', intervals: [0, 7, 12, 16, 19, 24], weight: 7 },
  { quality: 'maj', intervals: [2, 16, 19, 24], weight: 6 },
  { quality: 'maj', intervals: [0, 7, 16, 24], weight: 6 },
  { quality: 'maj', intervals: [0, 7, 12, 14, 16], weight: 6 },
  { quality: 'maj', intervals: [0, 12, 16, 19, 24], weight: 6 },
  { quality: 'maj', intervals: [0, 7, 9, 12, 16], weight: 6 },
  { quality: 'maj', intervals: [0, 12, 14, 16, 19], weight: 5 },
  { quality: 'maj', intervals: [0, 7, 16, 19, 24], weight: 5 },
  { quality: 'maj', intervals: [0, 7, 14, 16, 21], weight: 5 },
  { quality: 'maj', intervals: [0, 7, 16, 21, 26, 30], weight: 4 },
  { quality: 'maj', intervals: [0, 12, 14, 16, 19, 21], weight: 4 },
  { quality: 'maj', intervals: [0, 12, 16, 19, 24, 28], weight: 4 },

  // ---- min ---------------------------------------------------------
  { quality: 'min', intervals: [0, 15, 19, 24], weight: 17 },
  { quality: 'min', intervals: [0, 7, 12, 15, 19], weight: 13 },
  { quality: 'min', intervals: [0, 12, 15, 19], weight: 11 },
  { quality: 'min', intervals: [3, 19, 24, 26, 31], weight: 10 },
  { quality: 'min', intervals: [0, 7, 12, 15], weight: 10 },
  { quality: 'min', intervals: [0, 7, 15, 19, 24], weight: 9 },
  { quality: 'min', intervals: [0, 3, 7, 12], weight: 8 },
  { quality: 'min', intervals: [0, 7, 14, 15, 19], weight: 8 },
  { quality: 'min', intervals: [0, 7, 12, 15, 19, 24], weight: 8 },
  { quality: 'min', intervals: [3, 15, 19, 24], weight: 7 },
  { quality: 'min', intervals: [3, 19, 24, 26, 29], weight: 7 },
  { quality: 'min', intervals: [0, 7, 14, 15], weight: 7 },
  { quality: 'min', intervals: [0, 12, 15, 19, 24], weight: 6 },
  { quality: 'min', intervals: [0, 7, 12, 14, 15, 19], weight: 4 },
  { quality: 'min', intervals: [5, 12, 17, 19, 24, 27], weight: 4 },
  { quality: 'min', intervals: [3, 15, 19, 24, 26, 29], weight: 4 },

  // ---- sus ---------------------------------------------------------
  { quality: 'sus', intervals: [0, 7, 10, 14, 17], weight: 36 },
  { quality: 'sus', intervals: [7, 17, 21, 24], weight: 29 },
  { quality: 'sus', intervals: [9, 19, 24, 29], weight: 14 },
  { quality: 'sus', intervals: [0, 19, 22, 26, 29], weight: 12 },
  { quality: 'sus', intervals: [0, 17, 19, 22, 26], weight: 12 },
  { quality: 'sus', intervals: [0, 12, 17, 19, 22, 26], weight: 12 },
  { quality: 'sus', intervals: [7, 17, 22, 24], weight: 10 },
  { quality: 'sus', intervals: [0, 5, 7, 10, 14], weight: 9 },
  { quality: 'sus', intervals: [7, 21, 22, 24, 29], weight: 8 },
  { quality: 'sus', intervals: [7, 17, 21, 22, 24, 29], weight: 8 },
  { quality: 'sus', intervals: [0, 14, 19, 22, 29], weight: 8 },
  { quality: 'sus', intervals: [0, 10, 14, 17, 19, 24], weight: 7 },
  { quality: 'sus', intervals: [9, 17, 19, 24], weight: 7 },
  { quality: 'sus', intervals: [0, 5, 7, 9], weight: 7 },
  { quality: 'sus', intervals: [7, 12, 17, 21], weight: 6 },
  { quality: 'sus', intervals: [5, 9, 10, 12, 17, 19], weight: 5 },

  // ---- halfdim -----------------------------------------------------
  { quality: 'halfdim', intervals: [0, 10, 15, 18], weight: 11 },
  { quality: 'halfdim', intervals: [6, 22, 24, 27, 32], weight: 8 },
  { quality: 'halfdim', intervals: [0, 22, 27, 30], weight: 4 },
  { quality: 'halfdim', intervals: [0, 6, 10, 15], weight: 3 },
  { quality: 'halfdim', intervals: [0, 18, 22, 27], weight: 3 },
  { quality: 'halfdim', intervals: [0, 6, 10, 15, 18], weight: 3 },
  { quality: 'halfdim', intervals: [0, 3, 6, 10], weight: 2 },
  { quality: 'halfdim', intervals: [6, 12, 15, 18, 22, 26], weight: 2 },
  { quality: 'halfdim', intervals: [3, 12, 17, 18, 22, 26], weight: 2 },
  { quality: 'halfdim', intervals: [6, 22, 24, 27, 29], weight: 2 },
  { quality: 'halfdim', intervals: [0, 18, 22, 24, 27], weight: 2 },
  { quality: 'halfdim', intervals: [6, 10, 15, 20, 24], weight: 2 },
  { quality: 'halfdim', intervals: [3, 12, 14, 17, 18, 22], weight: 2 },
  { quality: 'halfdim', intervals: [6, 24, 27, 29, 34], weight: 2 },
  { quality: 'halfdim', intervals: [0, 10, 15, 18, 22, 24], weight: 1 },
  { quality: 'halfdim', intervals: [0, 10, 18, 22, 24, 27], weight: 1 },

  // ---- dim ---------------------------------------------------------
  { quality: 'dim', intervals: [0, 3, 6, 9, 12], weight: 17 },
  { quality: 'dim', intervals: [0, 3, 6, 9], weight: 10 },
  { quality: 'dim', intervals: [0, 6, 9, 15], weight: 9 },
  { quality: 'dim', intervals: [0, 12, 15, 18, 21, 24], weight: 6 },
  { quality: 'dim', intervals: [0, 9, 12, 15, 18], weight: 4 },
  { quality: 'dim', intervals: [0, 6, 9, 12, 15], weight: 4 },
  { quality: 'dim', intervals: [6, 15, 17, 21, 24], weight: 3 },
  { quality: 'dim', intervals: [0, 15, 18, 21, 29], weight: 3 },
  { quality: 'dim', intervals: [0, 6, 9, 12, 15, 17], weight: 3 },
  { quality: 'dim', intervals: [9, 12, 15, 18, 21, 29], weight: 2 },
  { quality: 'dim', intervals: [0, 3, 6, 9, 14], weight: 2 },
  { quality: 'dim', intervals: [0, 9, 15, 18], weight: 2 },
  { quality: 'dim', intervals: [6, 12, 15, 21, 24, 29], weight: 2 },
  { quality: 'dim', intervals: [3, 12, 18, 21, 26, 33], weight: 2 },
  { quality: 'dim', intervals: [0, 6, 9, 12, 15, 18], weight: 2 },
];

/** Every voicing for a quality, commonest first. */
export function voicingsFor(quality: VoicingQuality): Voicing[] {
  return VOICINGS.filter(v => v.quality === quality).sort((a, b) => b.weight - a.weight);
}

/**
 * The best voicing for a quality at a given size. Sizes that do not exist fall
 * back to the nearest, so a request is always answered with something playable.
 */
export function voicingFor(quality: VoicingQuality, noteCount: number, index = 0): Voicing | null {
  const all = voicingsFor(quality);
  if (all.length === 0) return null;
  const exact = all.filter(v => v.intervals.length === noteCount);
  const pool = exact.length ? exact : [...all].sort(
    (a, b) => Math.abs(a.intervals.length - noteCount) - Math.abs(b.intervals.length - noteCount)
  );
  return pool[((index % pool.length) + pool.length) % pool.length];
}

/** How wide a voicing reaches, in semitones. */
export const voicingSpread = (v: Voicing): number =>
  v.intervals[v.intervals.length - 1] - v.intervals[0];

/**
 * The quality a set of pitch classes should be voiced as. Distinguishes a plain
 * triad from a seventh chord, because they are voiced differently: a seventh is
 * usually spread with the seventh low, a triad is not.
 */
export function voicingQualityOf(pitchClasses: Set<number>): VoicingQuality {
  const min3 = pitchClasses.has(3);
  const maj3 = pitchClasses.has(4);
  const flat5 = pitchClasses.has(6);
  const b7 = pitchClasses.has(10);
  const maj7 = pitchClasses.has(11);
  const dim7 = pitchClasses.has(9);

  if (!min3 && !maj3) return 'sus';
  if (min3 && flat5) return b7 ? 'halfdim' : (dim7 ? 'dim' : 'halfdim');
  if (maj3 && b7) return 'dom';
  if (maj3 && maj7) return 'maj7';
  if (min3 && b7) return 'min7';
  if (min3) return 'min';
  return maj7 ? 'maj7' : 'maj';
}

/**
 * Choose a voicing for a chord.
 *
 * Coverage comes first: a shape that states every note the chord asks for beats
 * a wider or more unusual one that leaves a note out, so an extension the player
 * chose is not quietly dropped for the sake of a nicer shape.
 *
 * Among the shapes that cover it, the two axes decide. Spread runs from the
 * closest voicing to the widest; character runs from the way the chord is most
 * often played to the least. That is a more direct pair of choices than naming
 * drop voicings, and it is what the source library actually varies.
 */
export function chooseVoicing(
  quality: VoicingQuality,
  required: Set<number>,
  noteCount: number,
  spread01: number,
  character01: number
): Voicing | null {
  const all = voicingsFor(quality);
  if (all.length === 0) return null;

  const covers = (v: Voicing) => {
    const pcs = new Set(v.intervals.map(i => ((i % 12) + 12) % 12));
    let missing = 0;
    for (const pc of required) if (!pcs.has(pc)) missing++;
    return missing;
  };

  const best = Math.min(...all.map(covers));
  let pool = all.filter(v => covers(v) === best);

  // Prefer the size asked for, but never at the cost of coverage.
  const sized = pool.filter(v => v.intervals.length === noteCount);
  if (sized.length) pool = sized;

  // Spread picks a band of the range; character picks within it.
  const bySpread = [...pool].sort((a, b) => voicingSpread(a) - voicingSpread(b));
  const x = Math.max(0, Math.min(1, spread01));
  const band = Math.max(1, Math.round(bySpread.length * 0.45));
  const centre = Math.round(x * (bySpread.length - 1));
  const from = Math.max(0, Math.min(bySpread.length - band, centre - Math.floor(band / 2)));
  const window = bySpread.slice(from, from + band);

  const byWeight = window.sort((a, b) => b.weight - a.weight);
  const y = Math.max(0, Math.min(1, character01));
  return byWeight[Math.round(y * (byWeight.length - 1))] ?? byWeight[0];
}
