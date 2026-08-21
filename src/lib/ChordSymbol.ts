/**
 * Chord symbol parser for pasted progressions.
 *
 * A symbol becomes a root pitch class plus a list of semitone intervals. The
 * intervals are what the engine builds a voicing from, so a pasted chord goes
 * through register, inversion and the voicing disk exactly like a generated
 * one rather than being frozen as fixed pitches.
 *
 *   Cmin(b6) -> { root: 0,  intervals: [0, 3, 7, 8] }
 *   Gb7(#11) -> { root: 6,  intervals: [0, 4, 7, 10, 18] }
 *   Abmaj9   -> { root: 8,  intervals: [0, 4, 7, 11, 14] }
 */

export interface ParsedChord {
  symbol: string;
  root: number; // pitch class, 0 = C
  intervals: number[]; // semitones from the root
}

const ROOTS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

// Longest first: "min7" must win over "min", "maj9" over "maj".
const QUALITIES: Array<[string, number[]]> = [
  ['maj13', [0, 4, 7, 11, 14, 21]],
  ['maj11', [0, 4, 7, 11, 14, 17]],
  ['min11', [0, 3, 7, 10, 14, 17]],
  ['min13', [0, 3, 7, 10, 14, 21]],
  ['maj9', [0, 4, 7, 11, 14]],
  ['maj7', [0, 4, 7, 11]],
  ['min9', [0, 3, 7, 10, 14]],
  ['min7', [0, 3, 7, 10]],
  ['min6', [0, 3, 7, 9]],
  ['dim7', [0, 3, 6, 9]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['maj', [0, 4, 7]],
  ['min', [0, 3, 7]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
  ['sus', [0, 5, 7]],
  ['m11', [0, 3, 7, 10, 14, 17]],
  ['m13', [0, 3, 7, 10, 14, 21]],
  ['m9', [0, 3, 7, 10, 14]],
  ['m7', [0, 3, 7, 10]],
  ['m6', [0, 3, 7, 9]],
  ['13', [0, 4, 7, 10, 14, 21]],
  ['11', [0, 4, 7, 10, 14, 17]],
  ['m', [0, 3, 7]],
  ['-', [0, 3, 7]],
  ['+', [0, 4, 8]],
  ['9', [0, 4, 7, 10, 14]],
  ['7', [0, 4, 7, 10]],
  ['6', [0, 4, 7, 9]],
  ['', [0, 4, 7]], // bare root is a major triad
];

const ALTERATIONS: Record<string, number> = {
  b5: 6, '#5': 8, b6: 8, '6': 9,
  b9: 13, '9': 14, '#9': 15,
  '11': 17, '#11': 18,
  b13: 20, '13': 21,
  b7: 10, '7': 10, maj7: 11, M7: 11,
  '4': 17, '2': 14,
};

/** Alterations replace the natural degree they alter rather than sit beside it. */
const REPLACES: Record<string, number[]> = {
  b5: [7], '#5': [7], '#11': [], b9: [14], '#9': [14], b13: [21], b6: [],
};

export function parseChordSymbol(raw: string): ParsedChord | null {
  const symbol = raw.trim();
  if (!symbol) return null;

  const rootMatch = symbol.match(/^([A-Ga-g])([#b]?)/);
  if (!rootMatch) return null;

  const letter = rootMatch[1].toUpperCase();
  let root = ROOTS[letter];
  if (root === undefined) return null;
  if (rootMatch[2] === '#') root = (root + 1) % 12;
  if (rootMatch[2] === 'b') root = (root + 11) % 12;

  let rest = symbol.slice(rootMatch[0].length);

  // Split the parenthesised alterations off the quality.
  const alterations: string[] = [];
  rest = rest.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    for (const part of inner.split(/[,\s]+/)) {
      if (part.trim()) alterations.push(part.trim());
    }
    return '';
  });

  // Alterations written without parentheses, e.g. C7b9
  rest = rest.replace(/([#b])(5|6|9|11|13)$/, (_, acc: string, deg: string) => {
    alterations.push(acc + deg);
    return '';
  });

  const quality = QUALITIES.find(([name]) => name.toLowerCase() === rest.toLowerCase());
  if (!quality) return null;

  const intervals = [...quality[1]];
  for (const alteration of alterations) {
    const semitone = ALTERATIONS[alteration] ?? ALTERATIONS[alteration.toLowerCase()];
    if (semitone === undefined) return null; // unknown alteration: reject the whole symbol
    for (const gone of REPLACES[alteration] ?? []) {
      const at = intervals.indexOf(gone);
      if (at !== -1) intervals.splice(at, 1);
    }
    if (!intervals.includes(semitone)) intervals.push(semitone);
  }

  intervals.sort((a, b) => a - b);
  return { symbol, root, intervals };
}

/**
 * Parse a whole pasted progression. Symbols are whitespace, comma, or
 * pipe-separated. Returns what parsed and what did not, so the UI can say which
 * symbol it choked on rather than silently dropping it.
 */
/**
 * Split a progression into symbols. Commas separate chords, but they also
 * separate alterations inside parentheses — B7(b13,#9) is one chord, not two —
 * so separators only count at the top level.
 */
function tokenizeProgression(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of text) {
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);

    if (depth === 0 && /[\s,|]/.test(char)) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

export function parseProgression(text: string): { chords: ParsedChord[]; rejected: string[] } {
  const tokens = tokenizeProgression(text);
  const chords: ParsedChord[] = [];
  const rejected: string[] = [];

  for (const token of tokens) {
    const parsed = parseChordSymbol(token);
    if (parsed) chords.push(parsed);
    else rejected.push(token);
  }
  return { chords, rejected };
}

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const pitchClassName = (pc: number) => NOTE_NAMES[((pc % 12) + 12) % 12];
