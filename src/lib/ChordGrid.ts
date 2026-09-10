/**
 * CHORD GRID — a chord button board, after the Neoharp.
 *
 * Twelve columns, one per root, and a row for each quality, so a chord is one
 * press at a fixed place rather than something to be assembled. The columns run
 * in fifths by default because that is what the Neoharp does and it is the
 * reason the thing plays well: neighbouring columns share most of their notes,
 * so a progression is a short walk rather than a jump across the board.
 *
 * The qualities are given as symbols and parsed by the app's own parser rather
 * than written out as intervals here. A grid that disagreed with the text field
 * or the chord builder about what m7b5 means would be a second opinion nobody
 * asked for.
 */

import { parseChordSymbol } from './ChordSymbol';
import { scaleFor } from './ChordColour';

export interface ChordRow {
  /** What the button says. */
  label: string;
  /** Appended to the root to make a symbol the parser reads. */
  suffix: string;
}

/**
 * The Neoharp's three rows, and the ones asked for on top of them. Order runs
 * from plain to coloured, so the top of the board is where most playing
 * happens and the tensions are together at the bottom.
 */
export const CHORD_ROWS: ChordRow[] = [
  { label: 'MAJ', suffix: '' },
  { label: 'MIN', suffix: 'm' },
  { label: '7', suffix: '7' },
  { label: 'MAJ7', suffix: 'maj7' },
  { label: 'MIN7', suffix: 'm7' },
  { label: 'MIN9', suffix: 'm9' },
  { label: 'M7♭5', suffix: 'm7b5' },
  { label: '7♭9', suffix: '7b9' },
  { label: '7♯9', suffix: '7#9' },
  { label: 'ALT', suffix: 'alt7' },
  { label: 'AUG', suffix: 'aug' },
  { label: 'DIM7', suffix: 'dim7' },
];

export type RootOrder = 'fifths' | 'chromatic';

/**
 * Pitch classes in the Neoharp's order — G♭ D♭ A♭ E♭ B♭ F C G D A E B — which
 * is the circle of fifths with C sat near the middle.
 */
export const FIFTHS_CLASSES = [6, 1, 8, 3, 10, 5, 0, 7, 2, 9, 4, 11];
export const CHROMATIC_CLASSES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * How each root is written. Fifths order is spelled the way the circle spells
 * it — flats on the way down from C, sharps on the way up — because that is
 * what the chords are actually called there. Chromatic order has no such
 * argument to make and uses sharps throughout.
 */
const FIFTHS_NAMES: Record<number, string> = {
  6: 'G♭', 1: 'D♭', 8: 'A♭', 3: 'E♭', 10: 'B♭', 5: 'F',
  0: 'C', 7: 'G', 2: 'D', 9: 'A', 4: 'E', 11: 'B',
};
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** Plain ASCII for the parser, which does not read musical accidentals. */
const ASCII_NAMES: Record<number, string> = {
  0: 'C', 1: 'Db', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F',
  6: 'Gb', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B',
};

export function rootClasses(order: RootOrder): number[] {
  return order === 'fifths' ? [...FIFTHS_CLASSES] : [...CHROMATIC_CLASSES];
}

export function rootName(pitchClass: number, order: RootOrder): string {
  const c = ((pitchClass % 12) + 12) % 12;
  return order === 'fifths' ? (FIFTHS_NAMES[c] ?? SHARP_NAMES[c]) : SHARP_NAMES[c];
}

export interface GridCell {
  rootClass: number;
  row: number;
  column: number;
  /** ASCII, as the parser and the memory pads spell it. */
  symbol: string;
  /** With proper accidentals, for the button. */
  display: string;
  /** Semitones from the root, from the app's own parser. */
  intervals: number[];
  /** The MIDI note the chord is built from. */
  rootPitch: number;
}

export interface GridSpec {
  order: RootOrder;
  rows: ChordRow[];
  /** The octave the roots are built in; the engine's register moves it after. */
  baseOctave: number;
}

/**
 * Every button on the board.
 *
 * A quality whose symbol the parser will not read is left out rather than
 * guessed at — a button that looked like a chord and played nothing would be
 * worse than one that is not there.
 */
export function buildChordGrid(spec: GridSpec): GridCell[] {
  const classes = rootClasses(spec.order);
  const cells: GridCell[] = [];

  spec.rows.forEach((row, rowIndex) => {
    classes.forEach((rootClass, column) => {
      const symbol = `${ASCII_NAMES[rootClass]}${row.suffix}`;
      const parsed = parseChordSymbol(symbol);
      if (!parsed) return;
      cells.push({
        rootClass,
        row: rowIndex,
        column,
        symbol,
        display: `${rootName(rootClass, spec.order)}${row.label === 'MAJ' ? '' : row.label}`,
        intervals: parsed.intervals,
        rootPitch: Math.max(0, Math.min(127, 12 * spec.baseOctave + rootClass)),
      });
    });
  });

  return cells;
}

/** Which button a finger is over, or null when it is off the board. */
export function cellAt(
  x: number, y: number, width: number, height: number,
  columns: number, rows: number,
): { column: number; row: number } | null {
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const column = Math.floor((x / width) * columns);
  const row = Math.floor((y / height) * rows);
  if (column < 0 || column >= columns || row < 0 || row >= rows) return null;
  return { column, row };
}

/** What crossing onto another button does. Sending controllers is separate. */
export type SlideMode = 'off' | 'glide';
export type SlideAction =
  | { do: 'start'; cell: GridCell }
  /** Same key, new chord: the engine re-voices what is held and glides to it. */
  | { do: 'update'; cell: GridCell }
  | { do: 'stop'; cell: GridCell };

/**
 * What to send when a finger slides from one button to another, in order.
 *
 * The ordering is the whole substance of the two slide modes and it is easy to
 * get subtly wrong, so it lives here where it can be tested rather than inside
 * a pointer handler.
 *
 * RESTRIKE stops the old chord and strikes the new one. GLIDE starts the new
 * chord *first*, because that overlap is what the glide engine reads as one
 * chord becoming another and bends the voices across. The exception is two
 * buttons in the same column: the engine keys a held chord by its root, so the
 * new chord has already replaced the old one there and a note-off would kill
 * what was just started rather than what it was meant to end.
 */
export function slideActions(from: GridCell, to: GridCell, mode: SlideMode): SlideAction[] {
  if (from === to || (from.column === to.column && from.row === to.row)) return [];
  if (mode === 'glide') {
    // Down a column the root does not change, and the engine keys a held chord
    // by its root — so this is not two chords overlapping but one chord being
    // re-stated. That is what the engine's update path is for, and it glides
    // the voices across exactly as it does when a modifier changes under a
    // held key. Sending it as a fresh note-on instead only restruck it.
    return from.rootPitch === to.rootPitch
      ? [{ do: 'update', cell: to }]
      : [{ do: 'start', cell: to }, { do: 'stop', cell: from }];
  }
  return [{ do: 'stop', cell: from }, { do: 'start', cell: to }];
}

/**
 * The pitch classes of a chord's underlying scale.
 *
 * The same chord-scale relationship the strum pad and WALK use, so a chord
 * highlighted here is one the rest of the app agrees carries those notes.
 */
export function scaleClassesOf(cell: GridCell): Set<number> {
  const relative = new Set(cell.intervals.map(i => ((i % 12) + 12) % 12));
  const scale = scaleFor(relative);
  const out = new Set<number>();
  for (const step of scale) out.add(((step + cell.rootClass) % 12 + 12) % 12);
  // A chord always carries its own notes, whatever the scale says about them.
  for (const i of relative) out.add(((i + cell.rootClass) % 12 + 12) % 12);
  return out;
}

/**
 * Whether a chord can hold every one of the given notes — the question RNDM
 * asks when it looks for a progression that keeps a melody note under it.
 * With nothing chosen, nothing is highlighted rather than everything: an
 * unasked question has no answer.
 */
export function cellHoldsNotes(cell: GridCell, notes: number[]): boolean {
  if (notes.length === 0) return false;
  const scale = scaleClassesOf(cell);
  return notes.every(n => scale.has(((n % 12) + 12) % 12));
}

/**
 * The chords most recently played, oldest first.
 *
 * Kept so a progression found by playing can be moved onto the memory pads
 * without writing it down. Playing order is what is kept, because that is the
 * progression — the same chord returning later in it is a step of its own, not
 * a duplicate to be tidied away.
 *
 * The exception is the chord that has just sounded: pressing it again, or
 * sliding off it and back, is one step being played twice rather than two
 * steps, and would otherwise eat the history a press at a time.
 */
export function rememberPlayed(history: GridCell[], cell: GridCell, limit = 8): GridCell[] {
  const last = history[history.length - 1];
  if (last && last.column === cell.column && last.row === cell.row) return history;
  const next = [...history, cell];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** Where a button sits in the history, 1-based, or 0 if it is not in it. */
export function playedPosition(history: GridCell[], column: number, row: number): number {
  for (let i = 0; i < history.length; i++) {
    if (history[i].column === column && history[i].row === row) return i + 1;
  }
  return 0;
}

/** A memory pad, as the text field and the chord builder write one. */
export interface GridSlot {
  rootPitch: number;
  baseType: number;
  ext_m7: boolean;
  ext_M7: boolean;
  ext_6: boolean;
  ext_9: boolean;
  symbol: string;
  chordIntervals: number[];
}

/**
 * A progression played on the grid, as eight memory pads.
 *
 * Written as a symbol and its intervals rather than as frozen notes, which is
 * what the text field and the chord builder produce: a pad made that way still
 * answers to the register, the inversion and the voicing disk, where a literal
 * voicing would sit exactly where the grid happened to play it and ignore all
 * three.
 *
 * Always eight, because that is how many pads there are — a shorter
 * progression empties the rest rather than leaving whatever was there before,
 * which would read as part of what was just played.
 */
export function gridCellsToSlots(cells: GridCell[], padCount = 8): Array<GridSlot | null> {
  return Array.from({ length: padCount }, (_, i) => {
    const cell = cells[i];
    if (!cell) return null;
    return {
      rootPitch: cell.rootPitch,
      baseType: -1,
      ext_m7: false, ext_M7: false, ext_6: false, ext_9: false,
      symbol: cell.symbol,
      chordIntervals: cell.intervals,
    };
  });
}
