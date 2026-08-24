import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const run = async (over: any, mods: (e: any) => void) => {
  const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, chordRegisterStart: 60, ...over });
  const ons: number[] = [];
  e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
  mods(e);
  await sleep(40);
  return [...new Set(ons)].sort((a, b) => a - b);
};
const classes = (a: number[]) => [...new Set(a.map(p => ((p % 12) + 12) % 12))].sort((x, y) => x - y);

(async () => {
  // Every way a chord can reach the output, inverted each way.
  const paths: Array<[string, any, (e: any) => void]> = [
    ['a built chord', {}, (e) => { e.setModifiers(0, false, false, false, false); e.handleMidi(60, 100, true); }],
    ['a played-library voicing', { voicingPlayed: true, chordMaxNotes: 5 },
      (e) => { e.setModifiers(1, true, false, false, false); e.handleMidi(60, 100, true); }],
    ['a memory pad following the register', { memoryFollowRegister: true },
      (e) => e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67])],
    ['a memory pad pinned to its notes', { memoryFollowRegister: false },
      (e) => e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67])],
  ];

  for (const [label, over, mods] of paths) {
    console.log(`\n=== ${label} ===`);
    const root = await run({ ...over, chordInversion: 0 }, mods);
    const up = await run({ ...over, chordInversion: 1 }, mods);
    const up2 = await run({ ...over, chordInversion: 2 }, mods);
    const down = await run({ ...over, chordInversion: -1 }, mods);

    check('inverting up moves it up', up[0] > root[0], `${JSON.stringify(root)} -> ${JSON.stringify(up)}`);
    check('twice moves it further', up2[0] > up[0], `${JSON.stringify(up)} -> ${JSON.stringify(up2)}`);
    // On a wide voicing the top note dropped an octave can still land above the
    // existing bottom, so what says it inverted down is that the top came down.
    check('inverting down brings the top down', down[down.length - 1] < root[root.length - 1],
      `${JSON.stringify(root)} -> ${JSON.stringify(down)}`);
    check('no note is lost', up.length === root.length && down.length === root.length,
      `${root.length} / ${up.length} / ${down.length}`);
    check('it is still the same chord',
      JSON.stringify(classes(up)) === JSON.stringify(classes(root)) &&
      JSON.stringify(classes(down)) === JSON.stringify(classes(root)),
      `${JSON.stringify(classes(root))} vs ${JSON.stringify(classes(up))} / ${JSON.stringify(classes(down))}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
