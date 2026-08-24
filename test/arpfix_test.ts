import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const mk = (over: any = {}) => {
  const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, ...over });
  e.onOutputNote = () => {};
  return e;
};
const classes = (e: OrchidEngine) => [...new Set(e.getArpeggioPitches().map(p => p % 12))].sort((a, b) => a - b);

(async () => {
  console.log('\n=== The arpeggio follows the chord, not the colour on it ===');
  {
    for (const colour of [0, 1, 2, 3, 4]) {
      const e = mk({ chordColor: colour, chordMaxNotes: 8 });
      e.setModifiers(0, false, false, false, false);
      e.handleMidi(60, 100, true);
      check(`colour ${colour} still arpeggiates the triad`,
        JSON.stringify(classes(e)) === JSON.stringify([0, 4, 7]), JSON.stringify(classes(e)));
    }
  }
  {
    // A written extension is part of the chord and stays.
    const e = mk({ chordColor: 0, chordMaxNotes: 8 });
    e.setModifiers(0, false, true, false, true); // M7 + 9
    e.handleMidi(60, 100, true);
    check('written extensions are kept', classes(e).length > 3, JSON.stringify(classes(e)));
  }

  console.log('\n=== The pad works while a pattern runs ===');
  {
    const e = mk({ patternEnabled: true });
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(80);
    check('it has the chord to play over', JSON.stringify(classes(e)) === JSON.stringify([0, 4, 7]), JSON.stringify(classes(e)));
    check('and a sequence to run', e.getArpeggioSequence().length > 0, `${e.getArpeggioSequence().length}`);
    e.panic();
    await sleep(60);
  }
  {
    const e = mk({ patternEnabled: true });
    check('nothing held means nothing to play', e.getArpeggioPitches().length === 0);
  }

  console.log('\n=== Held chords still combine ===');
  {
    const e = mk();
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    await sleep(40);
    check('both chords are represented', classes(e).length >= 5, JSON.stringify(classes(e)));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
