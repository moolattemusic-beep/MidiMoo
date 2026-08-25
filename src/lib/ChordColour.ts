/**
 * Which tensions a chord may take, and in what order.
 *
 * The quality is read off the chord itself — its third and its seventh — rather
 * than off whichever button produced it, so a dominant is a dominant whether it
 * was played by hand, chosen from the pads or handed over by the key.
 *
 * Each quality carries an order as well as a set. The colour control walks that
 * order, so unticking the ninth on a dominant moves the sharp ninth up a place
 * rather than leaving a hole. The order is the one these tensions are usually
 * added in; the matrix decides only which of them are available.
 */

export type ChordQuality = 'major' | 'minor' | 'dominant' | 'dim' | 'sus';

export interface Tension {
  id: string;
  label: string;
  /** Semitones above the root, in the octave it is usually voiced in. */
  interval: number;
}

export const TENSIONS: Tension[] = [
  { id: 'b7', label: 'b7', interval: 10 },
  { id: 'maj7', label: 'maj7', interval: 11 },
  { id: '6', label: '6', interval: 9 },
  { id: 'b9', label: 'b9', interval: 13 },
  { id: '9', label: '9', interval: 14 },
  { id: '#9', label: '#9', interval: 15 },
  { id: '11', label: '11', interval: 17 },
  { id: '#11', label: '#11', interval: 18 },
  { id: 'b13', label: 'b13', interval: 20 },
  { id: '13', label: '13', interval: 21 },
];

export const QUALITIES: Array<{ id: ChordQuality; label: string; hint: string }> = [
  { id: 'major', label: 'MAJOR', hint: 'major third, no flat seventh' },
  { id: 'minor', label: 'MINOR', hint: 'minor third' },
  { id: 'dominant', label: 'DOM', hint: 'major third with a flat seventh' },
  { id: 'dim', label: 'DIM', hint: 'minor third with a flat fifth' },
  { id: 'sus', label: 'SUS', hint: 'no third at all' },
];

/**
 * The order each quality takes its tensions in, and which are on to begin with.
 * A natural eleventh sits a semitone above a major third and clouds it, so major
 * and dominant reach for the raised one and reach for it last; a minor chord has
 * no such quarrel and takes its eleventh early.
 */
export const COLOUR_ORDER: Record<ChordQuality, string[]> = {
  major: ['maj7', '9', '13', '#11', '6', '11', 'b9', '#9', 'b13', 'b7'],
  minor: ['b7', '9', '11', '13', 'b13', 'maj7', '6', 'b9', '#9', '#11'],
  dominant: ['b9', '#9', 'b13', '#11', '9', '13', '11', '6', 'maj7', 'b7'],
  dim: ['b7', '11', 'b13', '9', 'b9', '#9', '6', 'maj7', '#11', '13'],
  sus: ['b7', '9', '13', '#11', '11', 'b9', '#9', 'b13', '6', 'maj7'],
};

export const DEFAULT_COLOUR_MATRIX: Record<ChordQuality, string[]> = {
  major: ['maj7', '9', '13', '#11'],
  minor: ['b7', '9', '11', '13'],
  dominant: ['b9', '#9', 'b13', '#11'],
  dim: ['b7', '11', 'b13'],
  sus: ['b7', '9', '13'],
};

export type ColourMatrix = Record<string, string[]>;

export function parseColourMatrix(raw: string | null | undefined): ColourMatrix {
  if (!raw) return { ...DEFAULT_COLOUR_MATRIX };
  try {
    const parsed = JSON.parse(raw);
    const out: ColourMatrix = { ...DEFAULT_COLOUR_MATRIX };
    for (const q of Object.keys(DEFAULT_COLOUR_MATRIX)) {
      if (Array.isArray(parsed[q])) out[q] = parsed[q].filter((id: string) => TENSIONS.some(t => t.id === id));
    }
    return out;
  } catch {
    return { ...DEFAULT_COLOUR_MATRIX };
  }
}

/** The quality of a chord, read off its third and its seventh. */
/**
 * The scale each quality is played over.
 *
 * These are chord-scales in the ordinary sense — the safe reading of the chord
 * rather than the interesting one. Deliberately not RNDM's parent scales: those
 * answer a different question, "which notes can this chord tolerate", and give
 * a minor chord ten notes and a dominant eleven of twelve. Running a pad over
 * that is a chromatic scale, which is the same reason colour tones are kept off
 * the pad.
 *
 * Sus has no third of its own, so it is not given one.
 */
export const CHORD_SCALES: Record<ChordQuality, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],      // Ionian
  minor: [0, 2, 3, 5, 7, 9, 10],      // Dorian
  dominant: [0, 2, 4, 5, 7, 9, 10],   // Mixolydian
  dim: [0, 1, 3, 5, 6, 8, 10],        // Locrian
  sus: [0, 2, 5, 7, 9, 10],           // Mixolydian, minus the third
};

export function qualityOf(pitchClasses: Set<number>): ChordQuality {
  const minorThird = pitchClasses.has(3);
  const majorThird = pitchClasses.has(4);
  const flatSeventh = pitchClasses.has(10);
  const flatFifth = pitchClasses.has(6);

  if (!minorThird && !majorThird) return 'sus';
  if (minorThird && flatFifth && !pitchClasses.has(7)) return 'dim';
  if (majorThird && flatSeventh) return 'dominant';
  if (minorThird) return 'minor';
  return 'major';
}

/**
 * The tensions this quality will take, in the order the colour control walks
 * them: the quality's own order, keeping only what the matrix allows.
 */
export function colourTensionsFor(quality: ChordQuality, matrix: ColourMatrix): Tension[] {
  const allowed = new Set(matrix[quality] ?? DEFAULT_COLOUR_MATRIX[quality]);
  return COLOUR_ORDER[quality]
    .filter(id => allowed.has(id))
    .map(id => TENSIONS.find(t => t.id === id))
    .filter((t): t is Tension => !!t);
}
