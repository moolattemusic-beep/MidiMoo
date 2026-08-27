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
  // A minor triad under a major seventh. RNDM writes it this way; so do most
  // lead sheets, in one spelling or another.
  ['minMaj7', [0, 3, 7, 11]],
  ['mMaj7', [0, 3, 7, 11]],
  ['mM7', [0, 3, 7, 11]],
  // An altered dominant: no fifth, and the tensions that give it its name.
  ['alt7', [0, 4, 10, 15, 20]],
  ['7alt', [0, 4, 10, 15, 20]],
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

  // Alterations written without parentheses, e.g. C7b9 — and more than one of
  // them, e.g. Cmin7b5b13, which is peeled from the end a degree at a time.
  // Order does not matter: they end up in a set of intervals either way.
  for (;;) {
    const peeled = rest.replace(/([#b])(5|6|9|11|13)$/, (_, acc: string, deg: string) => {
      alterations.push(acc + deg);
      return '';
    });
    if (peeled === rest) break;
    rest = peeled;
  }

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

// ---------------------------------------------------------------------------
// The reference shown beside the text field.
//
// Generated from the tables above rather than written out beside them, so it
// cannot quietly stop describing what the parser actually accepts.
// ---------------------------------------------------------------------------

/** What a set of intervals sounds like, spelled from C. */
export function notesFromC(intervals: number[]): string {
  return intervals.map(i => NOTE_NAMES[i % 12]).join(' ');
}

export interface SymbolReferenceEntry {
  /** Every spelling that parses to this chord, shortest first. */
  spellings: string[];
  intervals: number[];
  /** The chord written on C, so the entry can be read rather than decoded. */
  notes: string;
}

/** Every chord the parser knows, with its synonyms collected together. */
export function chordSymbolReference(): SymbolReferenceEntry[] {
  const byShape = new Map<string, SymbolReferenceEntry>();
  for (const [name, intervals] of QUALITIES) {
    const key = intervals.join(',');
    const spelling = name === '' ? '(nothing)' : name;
    const found = byShape.get(key);
    if (found) found.spellings.push(spelling);
    else byShape.set(key, { spellings: [spelling], intervals, notes: notesFromC(intervals) });
  }
  for (const entry of byShape.values()) {
    entry.spellings.sort((a, b) => a.length - b.length || a.localeCompare(b));
  }
  return [...byShape.values()].sort((a, b) => a.intervals.length - b.intervals.length
    || a.intervals[1] - b.intervals[1]);
}

/** Every alteration the parser accepts, with the interval it adds. */
export function alterationReference(): Array<{ spelling: string; semitones: number }> {
  return Object.entries(ALTERATIONS)
    .map(([spelling, semitones]) => ({ spelling, semitones }))
    .sort((a, b) => a.semitones - b.semitones || a.spelling.localeCompare(b.spelling));
}

/**
 * Name a chord from the notes themselves.
 *
 * Every pitch class is tried as the root and the intervals that follow are
 * looked up in the same table the parser reads, so a name that comes back here
 * is a name the parser will accept — which is the only kind worth producing.
 * Where two roots both fit, the bass wins: a voicing someone played is far more
 * often in root position than not.
 */
export function nameChordFromPitches(pitches: number[]): string | null {
  if (pitches.length === 0) return null;
  const sorted = [...pitches].sort((a, b) => a - b);
  const bass = ((sorted[0] % 12) + 12) % 12;
  const classes = new Set(sorted.map(p => ((p % 12) + 12) % 12));

  let best: { root: number; name: string; missing: number } | null = null;
  for (let root = 0; root < 12; root++) {
    const relative = new Set([...classes].map(pc => ((pc - root) % 12 + 12) % 12));
    for (const [name, intervals] of QUALITIES) {
      const wanted = new Set(intervals.map(i => i % 12));
      // Every note of the chord has to be accounted for; a shape that leaves
      // one out is a different chord, not this one loosely played.
      let extra = false;
      for (const pc of relative) if (!wanted.has(pc)) { extra = true; break; }
      if (extra) continue;
      let missing = 0;
      for (const pc of wanted) if (!relative.has(pc)) missing++;
      // A name that has to invent two notes is not describing what was played.
      if (missing > 1) continue;
      const better = !best || missing < best.missing
        || (missing === best.missing && root === bass && best.root !== bass);
      if (better) best = { root, name, missing };
    }
  }
  if (!best) return null;
  const spelled = NOTE_NAMES[best.root] + (best.name === '' ? 'maj' : best.name);
  // Only offer it if it reads back as what was played.
  return parseChordSymbol(spelled) ? spelled : null;
}
