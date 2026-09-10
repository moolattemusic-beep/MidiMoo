import {
  CHORD_ROWS, buildChordGrid, cellAt, cellHoldsNotes, gridCellsToSlots, playedPosition,
  rememberPlayed, rootClasses, rootName, scaleClassesOf, slideActions,
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
    // Down a column the root does not change, so this is not two chords
    // overlapping but one being re-stated — which is the engine's update path,
    // and it glides. Sent as a fresh note-on it only restruck.
    check('gliding within a column re-states the held chord instead',
      brief(slideActions(cMaj, cMin, 'glide')) === 'update:Cm',
      brief(slideActions(cMaj, cMin, 'glide')));
    check('and never leaves a stray release to kill it',
      !slideActions(cMaj, cMin, 'glide').some(a => a.do === 'stop'));
    check('but restriking within a column still releases first',
      brief(slideActions(cMaj, cMin, 'off')) === 'stop:C start:Cm',
      brief(slideActions(cMaj, cMin, 'off')));

    check('and sliding nowhere does nothing', slideActions(cMaj, cMaj, 'glide').length === 0);
    // Sending controllers is no longer a third slide setting but something
    // that runs alongside them, so gliding and CC are not alternatives.
    check('gliding is available whatever the axes are doing',
      slideActions(cMaj, gMaj, 'glide').length === 2
      && slideActions(cMaj, cMin, 'glide').length === 1);
  }

  console.log('\n=== Chords that can hold a chosen note ===');
  {
    const grid = buildChordGrid(spec);
    const cell = (rootClass: number, label: string) =>
      grid.find(c => c.rootClass === rootClass && CHORD_ROWS[c.row].label === label)!;

    // A chord always carries its own notes, whatever its scale says.
    const cMaj = cell(0, 'MAJ');
    check('a chord holds its own notes',
      [0, 4, 7].every(n => scaleClassesOf(cMaj).has(n)), [...scaleClassesOf(cMaj)].join());
    check('C major holds E', cellHoldsNotes(cMaj, [4]));
    check('C major does not hold E flat', !cellHoldsNotes(cMaj, [3]));

    const cMin = cell(0, 'MIN');
    check('C minor holds E flat', cellHoldsNotes(cMin, [3]));
    check('and not the natural third', !cellHoldsNotes(cMin, [4]));

    check('every note asked for has to be there, not just one',
      cellHoldsNotes(cMaj, [0, 4, 7]) && !cellHoldsNotes(cMaj, [4, 3]));

    // The point of the thing: which chords could carry a melody note.
    const holdsG = grid.filter(c => cellHoldsNotes(c, [7]));
    check('plenty of chords can hold a G under a melody',
      holdsG.length > 20 && holdsG.length < grid.length,
      `${holdsG.length} of ${grid.length}`);
    check('and G major is among them',
      holdsG.some(c => c.rootClass === 7 && CHORD_ROWS[c.row].label === 'MAJ'));

    check('asking for nothing highlights nothing', !cellHoldsNotes(cMaj, []));
    check('an impossible pair holds nowhere',
      grid.filter(c => cellHoldsNotes(c, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).length === 0);
  }

  console.log('\n=== Remembering what was played ===');
  {
    const grid = buildChordGrid(spec);
    const cell = (rootClass: number, label: string) =>
      grid.find(c => c.rootClass === rootClass && CHORD_ROWS[c.row].label === label)!;
    const C = cell(0, 'MAJ'), G = cell(7, 'MAJ'), Am = cell(9, 'MIN'), F = cell(5, 'MAJ');
    const names = (h: ReturnType<typeof rememberPlayed>) => h.map(c => c.symbol).join(' ');

    let h: typeof grid = [];
    for (const c of [C, G, Am, F]) h = rememberPlayed(h, c);
    check('it keeps them in playing order', names(h) === 'C G Am F', names(h));

    // The same chord coming round again is a step of the progression, not a
    // duplicate: I-V-I is three chords, not two.
    h = rememberPlayed(h, C);
    check('a chord returning later is kept', names(h) === 'C G Am F C', names(h));

    // But pressing the one already sounding, or sliding off it and back, is
    // one step played twice — that would eat the history a press at a time.
    h = rememberPlayed(h, C);
    check('and pressing the same one again is not a new step',
      names(h) === 'C G Am F C', names(h));
  }
  {
    const grid = buildChordGrid(spec);
    const eight = grid.slice(0, 10);
    let h: typeof grid = [];
    for (const c of eight) h = rememberPlayed(h, c);
    check('it holds at eight, one per pad', h.length === 8, `${h.length}`);
    check('and it is the last eight that are kept',
      h[0].symbol === eight[2].symbol && h[7].symbol === eight[9].symbol,
      `${h[0].symbol}..${h[7].symbol}`);
  }
  {
    const grid = buildChordGrid(spec);
    const C = grid.find(c => c.rootClass === 0 && c.row === 0)!;
    const G = grid.find(c => c.rootClass === 7 && c.row === 0)!;
    const h = rememberPlayed(rememberPlayed([], C), G);
    check('a button knows where it will land', playedPosition(h, C.column, C.row) === 1);
    check('and so does the next', playedPosition(h, G.column, G.row) === 2);
    check('one never played is nowhere', playedPosition(h, 3, 5) === 0);
    // The first time it was played is the pad it goes to; a later repeat does
    // not move it.
    const withRepeat = rememberPlayed(h, C);
    check('a repeat is numbered where it first landed',
      playedPosition(withRepeat, C.column, C.row) === 1, `${playedPosition(withRepeat, C.column, C.row)}`);
  }

  console.log('\n=== Loading a progression onto the pads ===');
  {
    const grid = buildChordGrid(spec);
    const cell = (rootClass: number, label: string) =>
      grid.find(c => c.rootClass === rootClass && CHORD_ROWS[c.row].label === label)!;
    const played = [cell(2, 'MIN7'), cell(7, '7'), cell(0, 'MAJ7')];
    const slots = gridCellsToSlots(played);

    check('there is a pad for every pad', slots.length === 8);
    check('the progression lands in the order it was played',
      slots.slice(0, 3).map(s => s!.symbol).join(' ') === 'Dm7 G7 Cmaj7',
      slots.slice(0, 3).map(s => s!.symbol).join(' '));
    // Anything left over has to be cleared, or the pads beyond the progression
    // would still hold whatever was there and read as part of it.
    check('and the pads beyond it are emptied', slots.slice(3).every(s => s === null));

    // Intervals rather than frozen notes: a pad written this way still answers
    // to the register, the inversion and the voicing disk.
    check('each pad carries its intervals', slots[0]!.chordIntervals.join() === '0,3,7,10',
      slots[0]!.chordIntervals.join());
    check('and a symbol the rest of the app can read',
      slots.slice(0, 3).every(s => !!parseChordSymbol(s!.symbol)));
    check('with no chord modifier stuck on',
      slots.slice(0, 3).every(s => s!.baseType === -1 && !s!.ext_m7 && !s!.ext_M7 && !s!.ext_6 && !s!.ext_9));
    check('and the root it was played at', slots[1]!.rootPitch === cell(7, '7').rootPitch);
  }
  {
    check('nothing played empties every pad',
      gridCellsToSlots([]).every(s => s === null));
    const grid = buildChordGrid(spec);
    check('more than eight fills eight and no more',
      gridCellsToSlots(grid.slice(0, 20)).length === 8);
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
