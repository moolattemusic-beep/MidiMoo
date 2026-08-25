/**
 * RNDM — the chord generator from moodsoundcollection.com/pages/rndm, ported.
 *
 * The idea it is built on: you name the notes you want every chord to contain,
 * and it finds chords that can hold them. A note is only accepted if it belongs
 * to the parent scale the chord implies, and only if it lands on a degree you
 * have allowed — so the same common note can be a ninth in one chord and a
 * third in the next, and you decide which of those you will accept.
 *
 * The logic is the original's, function for function. What has changed is
 * spelled out where it happens: a dead parameter made live, and the DOM lifted
 * out so this is callable rather than clickable.
 */

export type ChordTypeGroup = 'major' | 'minor' | 'dominant' | 'diminished' | 'sus' | 'exotic';

export const NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_VALUES: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export const CHORD_TYPE_GROUPS: Array<{ id: ChordTypeGroup; label: string }> = [
  { id: 'major', label: 'MAJOR' },
  { id: 'minor', label: 'MINOR' },
  { id: 'dominant', label: 'DOM' },
  { id: 'diminished', label: 'DIM' },
  { id: 'sus', label: 'SUS' },
  { id: 'exotic', label: 'EXOTIC' },
];

export const CHORD_TYPE_MAP: Record<ChordTypeGroup, string[]> = {
  major: ['maj', 'maj7', 'maj9'],
  minor: ['min', 'min7', 'min9'],
  dominant: ['7', '9'],
  diminished: ['dim', 'dim7', 'm7b5'],
  sus: ['sus2', 'sus4'],
  exotic: ['minMaj7', 'min7b9', 'maj7#5', '7#11', '7b13', 'min7b5b13', 'alt7'],
};

/** What each degree is called, for the roles a common note is allowed to take. */
export const NOTE_ROLES = [
  'ROOT', 'b2', '9', 'b3', '3', '11', '#11', '5', 'b13', '13', 'b7', '7',
];

const DARK = ['min', 'min7', 'min9', 'dim', 'dim7', 'm7b5', 'sus2', 'minMaj7', 'min7b9', 'alt7'];
const BRIGHT = ['maj', 'maj7', 'maj9', 'sus4', '7', '9', 'maj7#5', '7#11'];

const rootOf = (chord: string): string => chord.match(/^([A-G][b#]?)/)?.[0] ?? '';

/** Mood tilts the pool without narrowing it: the other colours stay reachable. */
export function getQualitiesForMood(enabledTypes: ChordTypeGroup[], mood: number): string[] {
  let all: string[] = [];
  enabledTypes.forEach(group => { if (CHORD_TYPE_MAP[group]) all.push(...CHORD_TYPE_MAP[group]); });
  if (all.length === 0) all = ['maj', 'min'];

  let weighted = [...all];
  if (mood < 5) {
    const dark = all.filter(c => DARK.includes(c));
    if (dark.length > 0) weighted = [...dark, ...dark, ...all];
  } else if (mood > 5) {
    const bright = all.filter(c => BRIGHT.includes(c));
    if (bright.length > 0) weighted = [...bright, ...bright, ...all];
  }
  return weighted;
}

/**
 * The scale a chord implies, which is what decides whether a common note can
 * live in it. Minor and dominant are given wide patterns on purpose — those
 * chords will carry almost anything — while major is kept to its own scale.
 */
export function getParentScaleNotes(root: string, chordType: string): string[] {
  const rootValue = NOTE_VALUES[root];
  if (rootValue === undefined) return [];
  let pattern: number[];

  if (['maj', 'maj7', 'maj9', 'sus2'].includes(chordType) || chordType.includes('maj')) {
    pattern = [0, 2, 4, 6, 7, 9, 11];
  } else if (['min', 'min7', 'min9'].includes(chordType)) {
    pattern = [0, 1, 2, 3, 5, 7, 8, 9, 10, 11];
  } else if (['7', '9', '13', 'alt7'].includes(chordType)) {
    pattern = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  } else if (['dim', 'dim7', 'm7b5'].includes(chordType)) {
    pattern = [0, 1, 3, 5, 6, 8, 10];
  } else if (['sus4'].includes(chordType)) {
    pattern = [0, 2, 5, 7, 9, 10];
  } else {
    pattern = [0, 2, 4, 5, 7, 9, 11];
  }
  return pattern.map(step => NOTES[(rootValue + step) % 12]);
}

/**
 * The notes a chord is taken to contain once the tensions a player would add
 * are counted — which is how two chords that share no written note can still
 * share a common one.
 */
export function getImpliedJazzTones(chordName: string): string[] {
  const root = rootOf(chordName);
  const rootValue = NOTE_VALUES[root];
  if (rootValue === undefined) return [];
  const lower = chordName.toLowerCase();

  const intervals = [0];
  if (lower.includes('dim') || lower.includes('m7b5')) {
    intervals.push(3, 6);
    if (lower.includes('dim7')) intervals.push(9); else intervals.push(10);
    intervals.push(5);
  } else if (lower.includes('min') || lower.includes('m7') || lower.includes('m9')) {
    intervals.push(3, 7);
    if (lower.includes('maj7')) intervals.push(11); else intervals.push(10);
    intervals.push(2, 5, 9, 8);
  } else if ((lower.includes('7') || lower.includes('9') || lower.includes('11') || lower.includes('13')) && !lower.includes('maj')) {
    intervals.push(4, 7, 10);
    intervals.push(2, 9);
  } else {
    if (lower.includes('sus4')) intervals.push(5, 7);
    else if (lower.includes('sus2')) intervals.push(2, 7);
    else intervals.push(4, 7);
    intervals.push(11);
    intervals.push(2, 6, 9);
  }
  return [...new Set(intervals)].map(i => NOTES[(rootValue + i) % 12]);
}

/** Whether every common note falls on a degree the player has allowed. */
export function checkFunction(root: string, commonNotes: string[], allowedFunctions: number[]): boolean {
  const rootValue = NOTE_VALUES[root];
  for (const note of commonNotes) {
    const interval = (NOTE_VALUES[note] - rootValue + 12) % 12;
    if (!allowedFunctions.includes(interval)) return false;
  }
  return true;
}

/**
 * Name the chord after what the common notes actually do in it. A ninth that
 * happens to be flat should say so, rather than leaving the player to work out
 * why the chord sounds like that.
 */
export function smartRename(root: string, type: string, commonNotes: string[]): string {
  if (!commonNotes || commonNotes.length === 0) return root + type;
  const rootValue = NOTE_VALUES[root];
  let tensions: string[] = [];

  commonNotes.forEach(note => {
    const interval = (NOTE_VALUES[note] - rootValue + 12) % 12;
    if (type.includes('min') && !type.includes('Maj')) {
      if (interval === 1) tensions.push('b9');
      if (interval === 8) tensions.push('b6');
      if (interval === 9 && !type.includes('9')) tensions.push('6');
      if (interval === 11) tensions.push('maj7');
    } else if (type.includes('maj')) {
      if (interval === 6) tensions.push('#11');
    } else if (type === '7' || type === '9') {
      if (interval === 1) tensions.push('b9');
      if (interval === 3) tensions.push('#9');
      if (interval === 6) tensions.push('#11');
      if (interval === 8) tensions.push('b13');
    }
  });

  tensions = [...new Set(tensions)];
  if (tensions.length === 0) return root + type;

  let newType = type;
  // A flat or sharp ninth is the ninth: the chord cannot be both.
  if (tensions.includes('b9') || tensions.includes('#9')) {
    if (newType === '9') newType = '7';
  }
  if (tensions.includes('maj7')) {
    newType = 'minMaj7';
    tensions = tensions.filter(t => t !== 'maj7');
    if (tensions.length === 0) return root + newType;
  }
  return root + newType + '(' + tensions.join(',') + ')';
}

/** Combinations that name themselves into a contradiction. */
export function isForbidden(name: string): boolean {
  if (name.includes('minMaj7') && name.includes('b6')) return true;
  if (name.includes('min9') && name.includes('b9')) return true;
  return false;
}

/** Every chord that can hold the given common notes on an allowed degree. */
function buildPool(
  commonNotes: string[],
  qualities: string[],
  allowedFunctions: number[],
): string[] {
  const pool: string[] = [];
  if (commonNotes.length === 0) {
    for (const root of NOTES) for (const quality of qualities) pool.push(root + quality);
    return pool;
  }
  for (const root of NOTES) {
    for (const quality of qualities) {
      const scale = getParentScaleNotes(root, quality);
      if (!commonNotes.every(note => scale.includes(note))) continue;
      if (!checkFunction(root, commonNotes, allowedFunctions)) continue;
      const named = smartRename(root, quality, commonNotes);
      if (!isForbidden(named)) pool.push(named);
    }
  }
  return pool;
}

export interface RndmOptions {
  count: number;
  commonNotes: string[];
  mood: number;
  allowRepeats: boolean;
  types: ChordTypeGroup[];
  allowedFunctions: number[];
  /** Injectable so a test can ask for the same progression twice. */
  random?: () => number;
}

export interface RndmResult {
  chords: string[];
  commonNotes: string[];
  /** True when nothing satisfied the constraints and the fallback ran. */
  fallback?: boolean;
}

export function generateProgression(options: RndmOptions): RndmResult {
  const { count, commonNotes, mood, allowRepeats, types, allowedFunctions } = options;
  const random = options.random ?? Math.random;
  const qualities = getQualitiesForMood(types, mood);
  const pool = buildPool(commonNotes, qualities, allowedFunctions);

  if (pool.length === 0) {
    return { chords: Array(count).fill('Cmaj'), commonNotes, fallback: true };
  }

  const chords: string[] = [];
  const usedRoots = new Set<string>();
  for (let i = 0; i < count; i++) {
    // ALLOW REPEATED ROOTS was passed to the original and never read, so the
    // checkbox did nothing. It does now — which is plainly what it was for, and
    // matters here because eight pads want more roots than twelve notes and a
    // narrow common-note set can comfortably provide.
    if (allowRepeats) {
      chords.push(pool[Math.floor(random() * pool.length)]);
      continue;
    }
    let picked: string | null = null;
    for (let attempt = 0; attempt < 50 && !picked; attempt++) {
      const candidate = pool[Math.floor(random() * pool.length)];
      const root = rootOf(candidate);
      if (usedRoots.has(root)) continue;
      usedRoots.add(root);
      picked = candidate;
    }
    chords.push(picked ?? pool[Math.floor(random() * pool.length)]);
  }
  return { chords, commonNotes };
}

/** One replacement chord, avoiding the roots the progression already uses. */
export function generateSingleChord(
  commonNotes: string[],
  mood: number,
  types: ChordTypeGroup[],
  currentProgression: string[],
  allowedFunctions: number[],
  random: () => number = Math.random,
): string {
  const qualities = getQualitiesForMood(types, mood);
  const pool = buildPool(commonNotes, qualities, allowedFunctions);
  if (pool.length === 0) return NOTES[Math.floor(random() * 12)] + qualities[0];

  const takenRoots = currentProgression.map(rootOf);
  const fresh = pool.filter(chord => !takenRoots.includes(rootOf(chord)));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(random() * from.length)];
}

/** The notes every chord in the set turns out to share, tensions included. */
export function getAllCommonChordTones(chords: string[]): string[] {
  if (!chords || chords.length === 0) return [];
  const perChord = chords.map(getImpliedJazzTones);
  return perChord[0].filter(note => perChord.every(tones => tones.includes(note)));
}

/**
 * The chord as the instrument should play it, common notes included.
 *
 * Selection only asks that a common note *fits* — that it belongs to the scale
 * the chord implies and lands on a degree you allow — not that the chord states
 * it. About a third of the time it does not: D is the eleventh of A9 and simply
 * is not in the chord. The original settles this when it writes MIDI, adding
 * any missing common note above the voicing, and that is the point of the whole
 * exercise — the notes are meant to be heard running through every chord.
 *
 * So they are added here too, an octave above the root, which is where the
 * original puts them relative to its own.
 */
export function chordIntervalsWithCommonNotes(
  rootPitchClass: number,
  intervals: number[],
  commonNotes: string[],
): number[] {
  const out = [...intervals];
  const sounding = new Set(out.map(i => (rootPitchClass + i) % 12));
  for (const note of commonNotes) {
    const value = NOTE_VALUES[note];
    if (value === undefined) continue;
    const pitchClass = value % 12;
    if (sounding.has(pitchClass)) continue;
    // An octave up, so it sits over the chord rather than inside it.
    out.push(((value - rootPitchClass + 12) % 12) + 12);
    sounding.add(pitchClass);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/**
 * The notes a set of chords all have in common.
 *
 * A chord saved as a voicing is read as the notes it actually contains. Only a
 * chord that is nothing but a symbol is read as the tones that symbol implies,
 * since there is nothing else to go on — and that reading is deliberately
 * generous, counting tensions a player would add. Applying it to a written-out
 * voicing would describe a chord more open than the one on the pad, which is
 * why a preset is read as itself.
 */
export function sharedNotes(chords: Array<{ voicing?: number[]; symbol?: string }>): string[] {
  const perChord = chords
    .map(chord => {
      if (chord.voicing?.length) {
        return [...new Set(chord.voicing.map(pitch => NOTES[((pitch % 12) + 12) % 12]))];
      }
      return chord.symbol ? getImpliedJazzTones(chord.symbol) : [];
    })
    .filter(notes => notes.length > 0);

  if (perChord.length < 2) return [];
  return perChord[0].filter(note => perChord.every(notes => notes.includes(note)));
}

/** Move a chord symbol, leaving everything after the root alone. */
export function transposeSymbol(chord: string, semitones: number): string {
  if (semitones === 0) return chord;
  const root = rootOf(chord);
  const index = NOTES.indexOf(root);
  if (index === -1) return chord;
  return NOTES[(index + semitones + 12) % 12] + chord.slice(root.length);
}
