import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const play = async (over: any, script: (e: any) => Promise<void>) => {
  const e = new OrchidEngine({ ...defaultParams, mpeEnabled: true, mpeBendRange: 48, strumEngine: 0, ...over });
  const ons: number[] = [], bends: number[] = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isCC || ev.isExpression) return;
    if (ev.isPitchBend) bends.push(ev.pitchBendValue ?? 0);
    else if (ev.isOn) ons.push(ev.pitch);
  };
  await script(e);
  return { e, ons, bends };
};

// A chord under the pedal must bend into the next one rather than be cut off
// and struck again. Auto-lifting the pedal on a chord change once broke this:
// it released the notes the glide had to move from.
(async () => {
  for (const mode of [0, 1, 2]) {
    console.log(`\n=== Glide mode ${mode} under the sustain pedal ===`);
    const { ons, bends } = await play({ mpeGlideMode: mode, mpeGlideTimeMs: 120 }, async (e) => {
      e.handleControlChange(64, 127);
      e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
      await sleep(80);
      e.handleMidi(60, 0, false, false, false, false, true, []);
      await sleep(40);
      e.handleMidi(62, 100, true, false, false, false, true, [62, 65, 69]);
      await sleep(300);
      e.handleMidi(62, 0, false, false, false, false, true, []);
      e.handleControlChange(64, 0);
      await sleep(120);
    });
    check('the first chord sounded', [60, 64, 67].every(p => ons.includes(p)), JSON.stringify(ons));
    check('the second chord was NOT struck again', ![62, 65, 69].some(p => ons.includes(p)), JSON.stringify(ons));
    check('it glided instead', bends.length > 20 && Math.max(...bends) >= 1, `${bends.length} bends, max ${Math.max(...bends)}`);
  }

  console.log('\n=== Without MPE the pedal still lifts on a chord change ===');
  {
    const { ons } = await play({ mpeEnabled: false }, async (e) => {
      e.handleControlChange(64, 127);
      e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
      await sleep(60);
      e.handleMidi(60, 0, false, false, false, false, true, []);
      await sleep(40);
      e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
      await sleep(120);
    });
    check('the new chord is struck', [65, 69, 72].every(p => ons.includes(p)), JSON.stringify(ons));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
