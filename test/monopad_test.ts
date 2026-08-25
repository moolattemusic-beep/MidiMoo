import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * The pads are one voice. The component decides that — it releases whatever
 * else is playing before it starts the next one — so this checks the engine
 * side of that bargain: handed the handover in that order, nothing is left
 * sounding and the new chord arrives whole.
 */
const rig = () => {
  const e = new OrchidEngine({ ...defaultParams, mpeEnabled: false, autoBassRegister: 0 });
  const on: number[] = [], off: number[] = [];
  const events: Array<{ pitch: number; isOn: boolean }> = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isPitchBend || ev.isCC) return;
    (ev.isOn ? on : off).push(ev.pitch);
    events.push({ pitch: ev.pitch, isOn: ev.isOn });
  };
  return { e, on, off, events };
};
const press = (e: any, root: number, v: number[]) => e.handleMidi(root, 100, true, false, false, false, true, v, undefined);
const lift = (e: any, root: number, v: number[]) => e.handleMidi(root, 0, false, false, false, false, true, v, undefined);

const A = { root: 60, voicing: [60, 64, 67] };
const B = { root: 57, voicing: [57, 60, 64] };   // shares tones with A

(async () => {
  console.log('\n=== One pad hands over to the next ===');
  {
    const { e, on, off, events } = rig();
    press(e, A.root, A.voicing); await sleep(90);
    const first = [...on];
    // What the pad does: let go of the one that is playing, then strike the new one.
    lift(e, A.root, A.voicing);
    press(e, B.root, B.voicing); await sleep(120);
    const second = on.slice(first.length);
    check('the first chord is released', first.every(p => off.includes(p)), `${off}`);
    check('the second chord sounds in full', second.length >= 3, `${second}`);
    // Tones the two share must end up sounding, not released by the handover.
    const shared = first.filter(p => second.includes(p));
    for (const pitch of shared) {
      const last = events.filter(ev => ev.pitch === pitch).slice(-1)[0];
      check(`a shared note (${pitch}) ends up sounding`, last?.isOn === true, JSON.stringify(last));
    }
    lift(e, B.root, B.voicing); await sleep(120);
    const stuck = [...new Set(on)].filter(p => events.filter(ev => ev.pitch === p).slice(-1)[0]?.isOn);
    check('and letting go leaves nothing', stuck.length === 0, `${stuck}`);
    e.panic(); await sleep(40);
  }
  {
    // Running through the pads quickly must not leave a trail behind.
    const { e, on, events } = rig();
    const chords = [A, B, { root: 65, voicing: [65, 69, 72] }, { root: 62, voicing: [62, 65, 69] }];
    let previous: typeof A | null = null;
    for (let round = 0; round < 3; round++) {
      for (const chord of chords) {
        if (previous) lift(e, previous.root, previous.voicing);
        press(e, chord.root, chord.voicing);
        previous = chord;
        await sleep(45);
      }
    }
    if (previous) lift(e, previous.root, previous.voicing);
    await sleep(160);
    const stuck = [...new Set(on)].filter(p => events.filter(ev => ev.pitch === p).slice(-1)[0]?.isOn);
    check('twelve handovers leave nothing sounding', stuck.length === 0, `${stuck}`);
    e.panic(); await sleep(40);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
