/**
 * Building a chord symbol by choosing rather than typing.
 *
 * The point of it is that whatever comes out is a symbol the parser already
 * understands — you pick a root, a quality, what it does with its seventh, and
 * any tensions, and the spelling is assembled from tables rather than written
 * by hand. Every combination these tables can produce is parsed by a test, so
 * the builder cannot offer something the instrument would then reject.
 */

export const BUILDER_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export type BuilderQuality = 'maj' | 'min' | 'dom' | 'sus' | 'dim' | 'aug';

export const BUILDER_QUALITIES: Array<{ id: BuilderQuality; label: string }> = [
  { id: 'maj', label: 'MAJ' },
  { id: 'dom', label: 'DOM' },
  { id: 'min', label: 'MIN' },
  { id: 'dim', label: 'DIM' },
  { id: 'sus', label: 'SUS' },
  { id: 'aug', label: 'AUG' },
];

export interface BuilderShape {
  id: string;
  label: string;
  /** The quality spelling this produces, before any tensions. */
  spelling: string;
  /** Anything the shape itself contributes, such as a seventh the spelling has no name for. */
  alterations?: string[];
}

/**
 * What each quality can do with its seventh. A dominant is a seventh chord by
 * definition, so it has only the one; a sus chord is really two chords, and
 * choosing between them belongs here rather than in the ring before it.
 */
export const BUILDER_SHAPES: Record<BuilderQuality, BuilderShape[]> = {
  maj: [
    { id: 'triad', label: 'TRIAD', spelling: 'maj' },
    { id: 'maj7', label: 'MAJ 7', spelling: 'maj7' },
    { id: '6', label: '6TH', spelling: '6' },
  ],
  dom: [
    { id: '7', label: '7TH', spelling: '7' },
  ],
  min: [
    { id: 'triad', label: 'TRIAD', spelling: 'min' },
    { id: 'b7', label: 'b7', spelling: 'min7' },
    { id: 'maj7', label: 'MAJ 7', spelling: 'minMaj7' },
    { id: '6', label: '6TH', spelling: 'min6' },
  ],
  dim: [
    { id: 'triad', label: 'TRIAD', spelling: 'dim' },
    { id: 'dim7', label: 'DIM 7', spelling: 'dim7' },
    { id: 'half', label: 'HALF DIM', spelling: 'm7b5' },
  ],
  sus: [
    { id: 'sus4', label: 'SUS 4', spelling: 'sus4' },
    { id: 'sus2', label: 'SUS 2', spelling: 'sus2' },
    // No spelling of its own that the parser takes, so the seventh is added as
    // a tension — which is the same chord by another route.
    { id: '7sus4', label: '7 SUS 4', spelling: 'sus4', alterations: ['b7'] },
    { id: '7sus2', label: '7 SUS 2', spelling: 'sus2', alterations: ['b7'] },
  ],
  aug: [
    { id: 'triad', label: 'TRIAD', spelling: 'aug' },
    { id: 'maj7', label: 'MAJ 7', spelling: 'maj7#5' },
    { id: 'b7', label: 'b7', spelling: 'aug', alterations: ['b7'] },
  ],
};

/** The tensions offered last, in the order they sit above the chord. */
export const BUILDER_EXTENSIONS = ['b9', '9', '#9', '11', '#11', 'b13', '13'];

/**
 * Assemble the symbol. Tensions are always parenthesised — a single one needs
 * no brackets, but writing them the same way every time is one fewer rule for
 * the builder to get wrong.
 */
export function buildChordSymbol(
  root: string,
  shape: BuilderShape | null,
  extensions: string[] = [],
): string {
  if (!root) return '';
  if (!shape) return root;
  const tensions = [...(shape.alterations ?? []), ...extensions];
  const unique = tensions.filter((t, i) => tensions.indexOf(t) === i);
  return root + shape.spelling + (unique.length ? `(${unique.join(',')})` : '');
}

export type BuilderStage = 'root' | 'quality' | 'shape' | 'extensions';

/** Where a letter typed into the builder lands, given what follows it. */
export function rootFromLetter(letter: string, accidental: '' | '#' | 'b' = ''): string | null {
  const upper = letter.toUpperCase();
  if (!'ABCDEFG'.includes(upper)) return null;
  return upper + accidental;
}

/** The root a played note names, spelled the way the roots ring spells it. */
export function rootFromPitch(pitch: number): string {
  return BUILDER_ROOTS[((pitch % 12) + 12) % 12];
}
