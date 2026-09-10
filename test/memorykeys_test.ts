import {
  MEMORY_PAD_COUNT, START_NOTES, memoryKeyRange, memoryPadKeys, noteLabel, padForKey,
} from '../src/lib/MemoryKeys.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

const isWhite = (pitch: number) => ![1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);

function main() {
  console.log('=== White keys: an octave of naturals, C to C ===');
  {
    const keys = memoryPadKeys(36, true);
    check('eight pads, eight keys', keys.length === MEMORY_PAD_COUNT);
    check('they are C D E F G A B C', keys.join() === '36,38,40,41,43,45,47,48', keys.join());
    check('every one is a white key', keys.every(isWhite), `${keys.filter(k => !isWhite(k))}`);
    // Eight naturals from C reaches the octave, not the seventh — which is what
    // counting to eight on a keyboard means to the hand doing the counting.
    check('the last pad is the octave above the first', keys[7] - keys[0] === 12);
    check('and they are in order', keys.every((k, i) => i === 0 || k > keys[i - 1]));
  }
  {
    // The shape has to be the same wherever it starts, or it would have to be
    // relearned at every octave.
    for (const start of START_NOTES) {
      const keys = memoryPadKeys(start, true);
      check(`from ${noteLabel(start)} they are all white`, keys.every(isWhite));
      check(`and span an octave from ${noteLabel(start)}`, keys[7] - keys[0] === 12);
    }
  }

  console.log('\n=== Chromatic: eight in a row, as it was ===');
  {
    const keys = memoryPadKeys(36, false);
    check('eight semitones from the start', keys.join() === '36,37,38,39,40,41,42,43', keys.join());
    check('which is how it behaved before the toggle existed',
      keys.every((k, i) => k === 36 + i));
  }

  console.log('\n=== Finding the pad for a key ===');
  {
    const white = (p: number) => padForKey(p, 36, true);
    check('C2 is the first pad', white(36) === 0);
    check('D2 the second', white(38) === 1);
    check('B2 the seventh', white(47) === 6);
    check('C3 the eighth', white(48) === 7);

    // Everything else must pass through untouched: a black key inside the span
    // is still a note to be played, not a pad to be swallowed.
    check('C#2 fires no pad', white(37) === null);
    check('nor D#2', white(39) === null);
    check('nor F#2', white(42) === null);
    check('a key below the start fires none', white(35) === null);
    check('nor one above the last', white(50) === null);
    check('nor one far away', white(72) === null);
  }
  {
    const chrom = (p: number) => padForKey(p, 36, false);
    check('chromatic still counts straight up', chrom(36) === 0 && chrom(43) === 7);
    check('and stops at eight', chrom(44) === null);
    check('and does not run backwards', chrom(35) === null);
  }
  {
    // Every pad is reachable and no key fires two of them, whichever layout.
    for (const whiteOnly of [true, false]) {
      const keys = memoryPadKeys(48, whiteOnly);
      const pads = keys.map(k => padForKey(k, 48, whiteOnly));
      check(`${whiteOnly ? 'white' : 'chromatic'}: each key finds its own pad`,
        pads.join() === '0,1,2,3,4,5,6,7', pads.join());
      const hits = new Set<number>();
      for (let p = 0; p < 128; p++) {
        const pad = padForKey(p, 48, whiteOnly);
        if (pad !== null) hits.add(pad);
      }
      check(`${whiteOnly ? 'white' : 'chromatic'}: exactly eight keys do anything`,
        hits.size === 8, `${hits.size}`);
    }
  }

  console.log('\n=== Saying where they are ===');
  {
    check('white keys read C to C', memoryKeyRange(36, true) === 'C2–C3', memoryKeyRange(36, true));
    check('chromatic reads C to G', memoryKeyRange(36, false) === 'C2–G2', memoryKeyRange(36, false));
    check('the starting notes are all C', START_NOTES.every(n => n % 12 === 0));
    check('and are named as a player would', noteLabel(60) === 'C4' && noteLabel(36) === 'C2');
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
