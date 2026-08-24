import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const ONE_NOTE = JSON.stringify({
  name: 'T', lengthBeats: 4,
  events: [{ voice: 1, start: 0, length: 96, velocity: 100 }], // one beat
});

const measure = async (release: number) => {
  const e = new OrchidEngine({ ...defaultParams, patternEnabled: true, patternBpm: 120, patternCustom: ONE_NOTE, patternRelease: release });
  let on = 0, off = 0;
  e.onOutputNote = (ev: any) => {
    if (ev.isPitchBend || ev.isCC) return;
    if (ev.isOn) on = Date.now(); else if (!off) off = Date.now();
  };
  e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
  await sleep(1400);
  e.panic();
  await sleep(60);
  return off && on ? off - on : -1;
};

(async () => {
  console.log('\n=== Release scales how long a note rings ===');
  {
    const half = await measure(50);
    const full = await measure(100);
    const long = await measure(200);
    // One beat at 120bpm is 500ms.
    check('100% is about the written length', Math.abs(full - 500) < 90, `${full}ms`);
    check('50% is about half', Math.abs(half - 250) < 90, `${half}ms`);
    check('200% is about double', Math.abs(long - 1000) < 140, `${long}ms`);
    check('they are ordered', half < full && full < long, `${half} < ${full} < ${long}`);
  }

  console.log('\n=== The pedal is lifted for a moment on a chord change ===');
  {
    const e = new OrchidEngine({ ...defaultParams, patternEnabled: true, patternBpm: 120, patternCustom: ONE_NOTE });
    const ccs: Array<[number, number]> = [];
    e.onOutputNote = (ev: any) => { if (ev.isCC) ccs.push([ev.ccNumber, ev.ccValue]); };
    e.handleControlChange(64, 127);
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(120);
    ccs.length = 0;
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    const immediate = ccs.filter(([cc, v]) => cc === 64 && v === 0).length;
    check('the pedal is released at once', immediate === 1, JSON.stringify(ccs));
    await sleep(60);
    const back = ccs.filter(([cc, v]) => cc === 64 && v === 127).length;
    check('and put back down', back === 1, JSON.stringify(ccs));
    e.panic();
    await sleep(60);
  }

  console.log('\n=== Re-voicing the same chord does not interrupt the pedal ===');
  {
    const e = new OrchidEngine({ ...defaultParams, patternEnabled: true, patternBpm: 120, patternCustom: ONE_NOTE });
    const ccs: Array<[number, number]> = [];
    e.onOutputNote = (ev: any) => { if (ev.isCC) ccs.push([ev.ccNumber, ev.ccValue]); };
    e.handleControlChange(64, 127);
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(120);
    ccs.length = 0;
    e.updateRegister(72); // the register slider, not a new chord
    await sleep(80);
    check('no pedal lift from the slider', ccs.filter(([cc]) => cc === 64).length === 0, JSON.stringify(ccs));
    e.panic();
    await sleep(60);
  }

  console.log('\n=== With patterns off the pedal is untouched ===');
  {
    const e = new OrchidEngine({ ...defaultParams, patternEnabled: false, mpeEnabled: true });
    const ccs: Array<[number, number]> = [];
    e.onOutputNote = (ev: any) => { if (ev.isCC) ccs.push([ev.ccNumber, ev.ccValue]); };
    e.handleControlChange(64, 127);
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(60);
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    await sleep(80);
    check('glide is left alone', ccs.filter(([cc]) => cc === 64).length === 0, JSON.stringify(ccs));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
