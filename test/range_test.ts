import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const mk = (over: any = {}) => new OrchidEngine({ ...defaultParams, strumEngine: 0, ...over });

(async () => {
  console.log('\n=== Notes are folded into the range ===');
  {
    const e = mk({ outputRangeLow: 60, outputRangeHigh: 84 });
    check('a note below is lifted', e.foldToRange(48) === 60, `${e.foldToRange(48)}`);
    check('a long way below, still lifted', e.foldToRange(24) === 60, `${e.foldToRange(24)}`);
    check('a note above is dropped', e.foldToRange(96) === 84, `${e.foldToRange(96)}`);
    check('one inside is left alone', e.foldToRange(72) === 72);
    check('it keeps its name', [24, 36, 48, 96, 108].every(p => e.foldToRange(p) % 12 === p % 12),
      JSON.stringify([24, 36, 48, 96, 108].map(p => e.foldToRange(p))));
    check('everything lands inside', Array.from({ length: 128 }, (_, i) => e.foldToRange(i))
      .every(p => p >= 60 && p <= 84));
  }
  {
    const e = mk({ outputRangeLow: 0, outputRangeHigh: 127 });
    check('a full range changes nothing', Array.from({ length: 128 }, (_, i) => e.foldToRange(i) === i).every(Boolean));
    const narrow = mk({ outputRangeLow: 60, outputRangeHigh: 66 });
    check('a range under an octave is left alone rather than mangled', narrow.foldToRange(24) === 24);
  }

  console.log('\n=== A folded note is still released ===');
  {
    const e = mk({ outputRangeLow: 60, outputRangeHigh: 84 });
    const ons: number[] = [], offs: number[] = [];
    e.onOutputNote = (ev: any) => {
      if (ev.isPitchBend || ev.isCC) return;
      if (ev.isOn) ons.push(ev.pitch); else offs.push(ev.pitch);
    };
    e.handleMidi(48, 100, true, false, false, false, true, [36, 40, 43]); // well below the range
    await sleep(60);
    check('it sounded inside the range', ons.length > 0 && ons.every(p => p >= 60 && p <= 84), JSON.stringify(ons));
    e.handleMidi(48, 0, false, false, false, false, true, []);
    await sleep(60);
    check('and every note was released', ons.length === offs.length, `${ons.length} on / ${offs.length} off`);
    check('released at the same pitches', JSON.stringify([...ons].sort()) === JSON.stringify([...offs].sort()),
      `${JSON.stringify(ons)} vs ${JSON.stringify(offs)}`);
  }

  console.log('\n=== The strum pad remembers the chord ===');
  {
    const e = mk();
    e.onOutputNote = () => {};
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(40);
    const held = [...new Set(e.getArpeggioPitches().map(p => p % 12))].sort();
    e.handleMidi(60, 0, false, false, false, false, true, []);
    await sleep(40);
    const afterRelease = [...new Set(e.getArpeggioPitches().map(p => p % 12))].sort();
    check('it still has the chord after the keys are let go',
      JSON.stringify(afterRelease) === JSON.stringify(held), `${JSON.stringify(held)} -> ${JSON.stringify(afterRelease)}`);
    check('and it is the chord that was played', JSON.stringify(held) === JSON.stringify([0, 4, 7]), JSON.stringify(held));

    // A new chord replaces the memory.
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    await sleep(40);
    e.handleMidi(65, 0, false, false, false, false, true, []);
    await sleep(40);
    const next = [...new Set(e.getArpeggioPitches().map(p => p % 12))].sort((a, b) => a - b);
    check('the newer chord is what is remembered', JSON.stringify(next) === JSON.stringify([0, 5, 9]), JSON.stringify(next));
  }

  console.log('\n=== Free mode follows only what is sounding ===');
  {
    const e = mk({ keyboardMapping: 3 });
    e.onOutputNote = () => {};
    e.handleMidi(60, 100, true);
    e.handleMidi(64, 100, true);
    await sleep(40);
    check('it arpeggiates the held notes', e.getArpeggioPitches().length > 0, `${e.getArpeggioPitches().length}`);
    e.handleMidi(60, 0, false);
    e.handleMidi(64, 0, false);
    await sleep(60);
    check('and falls silent when they are let go', e.getArpeggioPitches().length === 0,
      JSON.stringify([...new Set(e.getArpeggioPitches().map(p => p % 12))]));
  }
  {
    // Under the pedal the notes are still sounding, so the pad still has them.
    const e = mk({ keyboardMapping: 3 });
    e.onOutputNote = () => {};
    e.handleControlChange(64, 127);
    e.handleMidi(60, 100, true);
    e.handleMidi(64, 100, true);
    await sleep(40);
    e.handleMidi(60, 0, false);
    e.handleMidi(64, 0, false);
    await sleep(40);
    check('the pedal keeps them available', e.getArpeggioPitches().length > 0, `${e.getArpeggioPitches().length}`);
    e.handleControlChange(64, 0);
    await sleep(60);
    check('lifting it takes them away', e.getArpeggioPitches().length === 0, `${e.getArpeggioPitches().length}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
