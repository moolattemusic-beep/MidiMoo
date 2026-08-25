import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * A glide is a bend on a note RANGE has already folded, so it has to answer to
 * the same window the note did. What matters is where each voice ends up
 * sounding — the note number that went out, plus where its bend left it.
 */
const land = async (over: any, keyA: number, a: number[], keyB: number, b: number[]) => {
  const e = new OrchidEngine({
    ...defaultParams, mpeEnabled: true, mpeGlideMode: 1, mpeGlideTimeMs: 30,
    autoBassRegister: 0, voicingPlayed: false, ...over,
  });
  const sent = new Map<number, number>();
  const bend = new Map<number, number>();
  e.onOutputNote = (ev: any) => {
    if (ev.isCC) return;
    if (ev.isPitchBend) { bend.set(ev.mpeChannel, ev.pitchBendValue ?? 0); return; }
    if (ev.isOn) sent.set(ev.mpeChannel, ev.pitch);
  };
  e.handleMidi(keyA, 100, true, false, false, false, true, a, undefined);
  await sleep(110);
  e.handleMidi(keyA, 0, false, false, false, false, true, a, undefined);
  await sleep(20);
  e.handleMidi(keyB, 100, true, false, false, false, true, b, undefined);
  await sleep(260);
  const sounding = [...sent.entries()]
    .map(([ch, pitch]) => Math.round((pitch + (bend.get(ch) ?? 0)) * 100) / 100)
    .sort((x, y) => x - y);
  e.panic();
  return sounding;
};

/**
 * Where a chord sounds when it is simply played, with no glide involved. This
 * is what a glide to the same chord should arrive at — the register, voicing
 * and range controls all have their say either way, so anything else means the
 * glide took a voice somewhere the instrument would not otherwise put it.
 */
const fresh = async (over: any, key: number, pitches: number[]) => {
  const e = new OrchidEngine({
    ...defaultParams, mpeEnabled: true, mpeGlideMode: 0,
    autoBassRegister: 0, voicingPlayed: false, ...over,
  });
  const out: number[] = [];
  e.onOutputNote = (ev: any) => { if (!ev.isCC && !ev.isPitchBend && ev.isOn) out.push(ev.pitch); };
  e.handleMidi(key, 100, true, false, false, false, true, pitches, undefined);
  await sleep(120);
  e.panic();
  return out.sort((a, b) => a - b);
};

/** Where the same chord would sound if it were simply played. */
const folded = (pitches: number[], low: number, high: number) =>
  pitches.map(p => {
    let q = p;
    while (q < low) q += 12;
    while (q > high) q -= 12;
    return q >= low && q <= high ? q : p;
  }).sort((a, b) => a - b);

(async () => {
  console.log('\n=== A glide stays inside the range ===');
  {
    const LOW = 60, HIGH = 72;
    // 74 is above the window, so a played chord would sound it at 62. Gliding
    // there used to bend past the edge to 74 instead.
    const got = await land({ outputRangeLow: LOW, outputRangeHigh: HIGH }, 60, [60, 64, 67], 62, [62, 66, 74]);
    check('nothing lands above the range', got.every(p => p <= HIGH + 0.01), `${got}`);
    check('nothing lands below it either', got.every(p => p >= LOW - 0.01), `${got}`);
    check('and it lands where a played chord would',
      got.join() === folded([62, 66, 74], LOW, HIGH).join(), `${got} vs ${folded([62, 66, 74], LOW, HIGH)}`);
  }
  {
    const LOW = 60, HIGH = 72;
    // The other way: a target below the window.
    const got = await land({ outputRangeLow: LOW, outputRangeHigh: HIGH }, 65, [65, 69, 72], 53, [53, 57, 60]);
    check('a target under the range is folded up, not bent down',
      got.every(p => p >= LOW - 0.01 && p <= HIGH + 0.01), `${got}`);
    check('matching a played chord', got.join() === folded([53, 57, 60], LOW, HIGH).join(),
      `${got} vs ${folded([53, 57, 60], LOW, HIGH)}`);
  }
  {
    // The window the instrument was found in, which is where this was audible.
    const LOW = 104, HIGH = 127;
    const got = await land({ outputRangeLow: LOW, outputRangeHigh: HIGH }, 60, [60, 64, 67], 62, [62, 65, 69]);
    check('a narrow high window glides correctly',
      got.join() === folded([62, 65, 69], LOW, HIGH).join(), `${got} vs ${folded([62, 65, 69], LOW, HIGH)}`);
  }

  console.log('\n=== With room to move, nothing changes ===');
  {
    // The fix must be invisible when no folding is involved, which is most of
    // the time — the glide is the feature this instrument is built around.
    const wide = { outputRangeLow: 0, outputRangeHigh: 127 };
    const got = await land(wide, 60, [60, 64, 67], 62, [62, 65, 69]);
    check('an unfolded glide lands where the chord would be played',
      got.join() === (await fresh(wide, 62, [62, 65, 69])).join(), `${got}`);
  }
  {
    const usual = { outputRangeLow: 24, outputRangeHigh: 96 };
    const got = await land(usual, 60, [60, 64, 67], 55, [55, 59, 62]);
    check('gliding down arrives at the played chord',
      got.join() === (await fresh(usual, 55, [55, 59, 62])).join(),
      `${got} vs ${await fresh(usual, 55, [55, 59, 62])}`);
  }
  {
    const usual = { outputRangeLow: 24, outputRangeHigh: 96 };
    const got = await land(usual, 60, [60, 64, 67], 72, [72, 76, 79]);
    check('and gliding up does too',
      got.join() === (await fresh(usual, 72, [72, 76, 79])).join(),
      `${got} vs ${await fresh(usual, 72, [72, 76, 79])}`);
  }
  {
    // Several changes in a row, each of which could have drifted an octave.
    const LOW = 60, HIGH = 72;
    const e = new OrchidEngine({
      ...defaultParams, mpeEnabled: true, mpeGlideMode: 1, mpeGlideTimeMs: 20,
      autoBassRegister: 0, voicingPlayed: false, outputRangeLow: LOW, outputRangeHigh: HIGH,
    });
    const sent = new Map<number, number>(), bend = new Map<number, number>();
    e.onOutputNote = (ev: any) => {
      if (ev.isCC) return;
      if (ev.isPitchBend) { bend.set(ev.mpeChannel, ev.pitchBendValue ?? 0); return; }
      if (ev.isOn) sent.set(ev.mpeChannel, ev.pitch);
    };
    const steps: Array<[number, number[]]> = [
      [60, [60, 64, 67]], [62, [62, 66, 74]], [64, [64, 68, 76]], [55, [55, 59, 50]], [60, [60, 64, 67]],
    ];
    let previous: number | null = null;
    for (const [key, pitches] of steps) {
      if (previous !== null) { e.handleMidi(previous, 0, false, false, false, false, true, undefined, undefined); await sleep(15); }
      e.handleMidi(key, 100, true, false, false, false, true, pitches, undefined);
      previous = key;
      await sleep(120);
    }
    await sleep(120);
    const sounding = [...sent.entries()].map(([ch, p]) => p + (bend.get(ch) ?? 0));
    check('five changes later everything is still in the window',
      sounding.every(p => p >= LOW - 0.01 && p <= HIGH + 0.01), `${sounding.map(x => x.toFixed(1))}`);
    e.panic();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
