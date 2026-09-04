import {
  CHORD_ROWS, buildChordGrid, cellAt, rootClasses, rootName, slideActions,
} from '../src/lib/ChordGrid.ts';
import { parseChordSymbol } from '../src/lib/ChordSymbol.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

const spec = { order: 'fifths' as const, rows: CHORD_ROWS, baseOctave: 4 };

function main() {
  console.log('=== Every button on the board is a chord the app can read ===');
  {
    // The grid is only as good as its symbols: one the parser will not take
    // would be a button that looks like a chord and plays silence.
    const missing: string[] = [];
    for (const row of CHORD_ROWS) {
      for (const name of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']) {
        if (!parseChordSymbol(`${name}${row.suffix}`)) missing.push(`${name}${row.suffix}`);
      }
    }
    check('every root against every quality parses', missing.length === 0, `${missing.slice(0, 8)}`);

    const grid = buildChordGrid(spec);
    check('so the board is full', grid.length === CHORD_ROWS.length * 12, `${grid.length}`);
    check('no cell is left without notes', grid.every(c => c.intervals.length >= 3));
  }

  console.log('\n=== The qualities are the ones asked for ===');
  {
    const at = (label: string) => {
      const rowIndex = CHORD_ROWS.findIndex(r => r.label === label);
      return buildChordGrid(spec).find(c => c.row === rowIndex && c.rootClass === 0)!;
    };
    check('MAJ is a major triad', at('MAJ').intervals.join() === '0,4,7', at('MAJ').intervals.join());
    check('MIN is a minor triad', at('MIN').intervals.join() === '0,3,7', at('MIN').intervals.join());
    check('7 is a dominant seventh', at('7').intervals.join() === '0,4,7,10', at('7').intervals.join());
    check('MAJ7 is a major seventh', at('MAJ7').intervals.join() === '0,4,7,11', at('MAJ7').intervals.join());
    check('MIN9 has the ninth', at('MIN9').intervals.includes(14), at('MIN9').intervals.join());

    const halfDim = at('M7♭5').intervals;
    check('half-diminished is a minor seventh with a flat fifth',
      halfDim.includes(3) && halfDim.includes(6) && halfDim.includes(10) && !halfDim.includes(7),
      halfDim.join());

    const b9 = at('7♭9').intervals;
    check('7b9 states the flat ninth and not the natural one',
      b9.includes(13) && !b9.includes(14), b9.join());
    const s9 = at('7♯9').intervals;
    check('7#9 states the sharp ninth and not the natural one',
      s9.includes(15) && !s9.includes(14), s9.join());

    check('ALT is the altered dominant', at('ALT').intervals.join() === '0,4,10,15,20', at('ALT').intervals.join());
    check('AUG has the raised fifth', at('AUG').intervals.join() === '0,4,8', at('AUG').intervals.join());
    check('DIM7 is the fully diminished seventh', at('DIM7').intervals.join() === '0,3,6,9', at('DIM7').intervals.join());
  }

  console.log('\n=== Columns run in fifths, as the Neoharp has them ===');
  {
    const order = rootClasses('fifths');
    check('twelve roots, each once', new Set(order).size === 12 && order.length === 12);
    check('it starts at G flat and reaches B',
      rootName(order[0], 'fifths') === 'G♭' && rootName(order[11], 'fifths') === 'B',
      `${order.map(o => rootName(o, 'fifths')).join(' ')}`);
    check('C sits where the Neoharp puts it',
      rootName(order[6], 'fifths') === 'C', `${rootName(order[6], 'fifths')}`);

    let allFifths = true;
    for (let i = 1; i < order.length; i++) {
      if (((order[i] - order[i - 1]) % 12 + 12) % 12 !== 7) allFifths = false;
    }
    check('every step right is a fifth up', allFifths,
      `${order.map(o => rootName(o, 'fifths')).join(' ')}`);
    // Which is the point: neighbouring columns share notes, so a progression
    // is a short walk instead of a jump.
    const grid = buildChordGrid(spec);
    const cMaj = grid.find(c => c.rootClass === 0 && c.row === 0)!;
    const gMaj = grid.find(c => c.rootClass === 7 && c.row === 0)!;
    check('and neighbouring majors share two notes',
      cMaj.column + 1 === gMaj.column
      && new Set(cMaj.intervals.map(i => (i + cMaj.rootClass) % 12))
        .size === 3, `${cMaj.column} ${gMaj.column}`);
  }
  {
    const chrom = rootClasses('chromatic');
    check('chromatic order is semitone by semitone',
      chrom.every((c, i) => c === i), `${chrom}`);
    check('and is named with sharps', rootName(1, 'chromatic') === 'C♯');
  }

  console.log('\n=== Roots are real MIDI notes ===');
  {
    const grid = buildChordGrid(spec);
    check('every root is in range', grid.every(c => c.rootPitch >= 0 && c.rootPitch <= 127));
    const c = grid.find(x => x.rootClass === 0)!;
    check('the octave setting places them', c.rootPitch === 48, `${c.rootPitch}`);
    const low = buildChordGrid({ ...spec, baseOctave: 2 }).find(x => x.rootClass === 0)!;
    check('and moving the octave moves them', low.rootPitch === 24, `${low.rootPitch}`);
  }

  console.log('\n=== Finding the button under a finger ===');
  {
    const hit = (x: number, y: number) => cellAt(x, y, 1200, 600, 12, 12);
    check('top left is the first button', JSON.stringify(hit(5, 5)) === '{"column":0,"row":0}');
    check('bottom right is the last', JSON.stringify(hit(1195, 595)) === '{"column":11,"row":11}');
    check('the middle lands where it should', JSON.stringify(hit(650, 320)) === '{"column":6,"row":6}');
    check('off the left is nothing', hit(-1, 10) === null);
    check('off the bottom is nothing', hit(10, 601) === null);
    check('the far edge is not a thirteenth column', hit(1200, 300) === null);
  }

  console.log('\n=== Sliding from one button to another ===');
  {
    const grid = buildChordGrid(spec);
    const cell = (rootClass: number, label: string) =>
      grid.find(c => c.rootClass === rootClass && CHORD_ROWS[c.row].label === label)!;
    const cMaj = cell(0, 'MAJ');
    const gMaj = cell(7, 'MAJ');
    const cMin = cell(0, 'MIN');
    const brief = (a: ReturnType<typeof slideActions>) =>
      a.map(x => `${x.do}:${x.cell.symbol}`).join(' ');

    check('restrike stops the old chord before striking the new',
      brief(slideActions(cMaj, gMaj, 'off')) === 'stop:C start:G',
      brief(slideActions(cMaj, gMaj, 'off')));

    // The overlap is the whole mechanism: the glide engine reads two chords
    // sounding at once as one becoming the other, and bends the voices across.
    check('glide starts the new chord before releasing the old',
      brief(slideActions(cMaj, gMaj, 'glide')) === 'start:G stop:C',
      brief(slideActions(cMaj, gMaj, 'glide')));

    // Down a column the root does not change, and the engine keys a held chord
    // by its root — so the note-off would kill the chord just started.
    check('gliding within a column does not release, which would kill it',
      brief(slideActions(cMaj, cMin, 'glide')) === 'start:Cm',
      brief(slideActions(cMaj, cMin, 'glide')));
    check('but restriking within a column still releases first',
      brief(slideActions(cMaj, cMin, 'off')) === 'stop:C start:Cm',
      brief(slideActions(cMaj, cMin, 'off')));

    check('the timbre mode never changes chord', slideActions(cMaj, gMaj, 'cc74').length === 0);
    check('and sliding nowhere does nothing', slideActions(cMaj, cMaj, 'glide').length === 0);
  }

  console.log('\n=== Naming ===');
  {
    const grid = buildChordGrid(spec);
    const ebm9 = grid.find(c => c.rootClass === 3 && CHORD_ROWS[c.row].label === 'MIN9')!;
    check('a button is spelled as a player would write it',
      ebm9.display === 'E♭MIN9', ebm9.display);
    check('while the symbol stays readable by the parser',
      ebm9.symbol === 'Ebm9' && !!parseChordSymbol(ebm9.symbol), ebm9.symbol);
    const cMaj = grid.find(c => c.rootClass === 0 && CHORD_ROWS[c.row].label === 'MAJ')!;
    check('a plain major is just its letter', cMaj.display === 'C', cMaj.display);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
