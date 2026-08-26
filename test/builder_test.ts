import {
  BUILDER_EXTENSIONS, BUILDER_QUALITIES, BUILDER_ROOTS, BUILDER_SHAPES,
  BuilderQuality, buildChordSymbol, rootFromLetter, rootFromPitch,
} from '../src/lib/ChordBuilder.ts';
import { parseChordSymbol } from '../src/lib/ChordSymbol.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

/**
 * The builder exists so that what comes out is understood. That is not a hope
 * about the tables, it is a property of them — so every combination they can
 * produce is parsed here, not a sample.
 */
console.log('\n=== Everything it can build is understood ===');
{
  const unreadable: string[] = [];
  let built = 0;
  for (const root of BUILDER_ROOTS) {
    for (const { id: quality } of BUILDER_QUALITIES) {
      for (const shape of BUILDER_SHAPES[quality as BuilderQuality]) {
        // No tensions, then each on its own, then every pair — which covers
        // every way a tension can meet a shape.
        const sets: string[][] = [[], ...BUILDER_EXTENSIONS.map(e => [e])];
        for (let i = 0; i < BUILDER_EXTENSIONS.length; i++) {
          for (let j = i + 1; j < BUILDER_EXTENSIONS.length; j++) {
            sets.push([BUILDER_EXTENSIONS[i], BUILDER_EXTENSIONS[j]]);
          }
        }
        for (const extensions of sets) {
          const symbol = buildChordSymbol(root, shape, extensions);
          built++;
          if (!parseChordSymbol(symbol)) unreadable.push(symbol);
        }
      }
    }
  }
  check(`all ${built} combinations parse`, unreadable.length === 0,
    [...new Set(unreadable)].slice(0, 6).join(' '));
}
{
  // And every tension at once, which is the worst the builder allows.
  const unreadable: string[] = [];
  for (const root of BUILDER_ROOTS) {
    for (const { id: quality } of BUILDER_QUALITIES) {
      for (const shape of BUILDER_SHAPES[quality as BuilderQuality]) {
        const symbol = buildChordSymbol(root, shape, BUILDER_EXTENSIONS);
        if (!parseChordSymbol(symbol)) unreadable.push(symbol);
      }
    }
  }
  check('so does every tension at once', unreadable.length === 0, unreadable.slice(0, 4).join(' '));
}

console.log('\n=== The shapes are the chords they claim ===');
{
  const notes = (symbol: string) => parseChordSymbol(symbol)!.intervals;
  check('a major triad', notes(buildChordSymbol('C', BUILDER_SHAPES.maj[0])).join() === '0,4,7', '');
  check('a major seventh', notes(buildChordSymbol('C', BUILDER_SHAPES.maj[1])).join() === '0,4,7,11', '');
  check('a dominant seventh', notes(buildChordSymbol('C', BUILDER_SHAPES.dom[0])).join() === '0,4,7,10', '');
  check('a minor seventh', notes(buildChordSymbol('C', BUILDER_SHAPES.min[1])).join() === '0,3,7,10', '');
  check('a minor with a major seventh', notes(buildChordSymbol('C', BUILDER_SHAPES.min[2])).join() === '0,3,7,11', '');
  check('a diminished seventh', notes(buildChordSymbol('C', BUILDER_SHAPES.dim[1])).join() === '0,3,6,9', '');
  check('a half diminished', notes(buildChordSymbol('C', BUILDER_SHAPES.dim[2])).join() === '0,3,6,10', '');
  // A seventh the spelling has no name for, added as a tension instead.
  check('a seventh over sus four', notes(buildChordSymbol('C', BUILDER_SHAPES.sus[2])).join() === '0,5,7,10',
    `${notes(buildChordSymbol('C', BUILDER_SHAPES.sus[2]))}`);
  check('a seventh over an augmented triad',
    notes(buildChordSymbol('C', BUILDER_SHAPES.aug[2])).join() === '0,4,8,10',
    `${notes(buildChordSymbol('C', BUILDER_SHAPES.aug[2]))}`);
  check('a sus chord is given no third',
    BUILDER_SHAPES.sus.every(s => { const i = notes(buildChordSymbol('C', s)); return !i.includes(3) && !i.includes(4); }), '');
}

console.log('\n=== Assembling the symbol ===');
{
  check('a root on its own is the root', buildChordSymbol('F#', null) === 'F#', buildChordSymbol('F#', null));
  check('nothing chosen is nothing', buildChordSymbol('', null) === '', '');
  check('tensions are bracketed',
    buildChordSymbol('C', BUILDER_SHAPES.dom[0], ['b9', '#11']) === 'C7(b9,#11)',
    buildChordSymbol('C', BUILDER_SHAPES.dom[0], ['b9', '#11']));
  // The shape's own seventh must not be written twice if it is also picked.
  check('a tension the shape already added is not repeated',
    buildChordSymbol('C', BUILDER_SHAPES.sus[2], ['b7']) === 'Csus4(b7)',
    buildChordSymbol('C', BUILDER_SHAPES.sus[2], ['b7']));
}

console.log('\n=== Naming a root ===');
{
  check('a letter names a root', rootFromLetter('c') === 'C', '');
  check('with an accidental', rootFromLetter('f', '#') === 'F#', '');
  check('and a flat', rootFromLetter('B', 'b') === 'Bb', '');
  check('anything else names nothing', rootFromLetter('h') === null && rootFromLetter('2') === null, '');
  check('a played note names its own root', rootFromPitch(60) === 'C' && rootFromPitch(66) === 'Gb', '');
  check('in any octave', rootFromPitch(37) === 'Db' && rootFromPitch(109) === 'Db', '');
  check('every root the ring offers parses',
    BUILDER_ROOTS.every(r => !!parseChordSymbol(r + 'maj7')), '');
  check('and every letter a keyboard can name does too',
    'ABCDEFG'.split('').every(l => ['', '#', 'b'].every(a => !!parseChordSymbol(rootFromLetter(l, a as any)! + 'maj7'))), '');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
