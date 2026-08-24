import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const play = (over: any) => {
  // The exact pitches below are those of a built chord, so this pins that path;
  // inverting a played voicing is covered in inv2.
  const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, chordRegisterStart: 60, voicingPlayed: false, ...over });
  const ons: number[] = [];
  e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
  e.setModifiers(0, false, false, false, false);
  e.handleMidi(60, 100, true);
  return [...new Set(ons)].sort((a, b) => a - b);
};

console.log('\n=== Inversion actually inverts ===');
{
  const root = play({ chordInversion: 0 });
  const first = play({ chordInversion: 1 });
  const second = play({ chordInversion: 2 });
  const third = play({ chordInversion: 3 });
  check('root position', JSON.stringify(root) === JSON.stringify([60, 64, 67]), JSON.stringify(root));
  check('first inversion lifts the bottom note', JSON.stringify(first) === JSON.stringify([64, 67, 72]), JSON.stringify(first));
  check('second lifts the next', JSON.stringify(second) === JSON.stringify([67, 72, 76]), JSON.stringify(second));
  check('third carries on up', JSON.stringify(third) === JSON.stringify([72, 76, 79]), JSON.stringify(third));

  // The bug: it used to collapse straight back into one register.
  check('each inversion really is higher than the last',
    first[0] > root[0] && second[0] > first[0] && third[0] > second[0],
    `${root[0]} ${first[0]} ${second[0]} ${third[0]}`);
  check('the pitch classes never change',
    [root, first, second, third].every(a =>
      JSON.stringify([...new Set(a.map(p => p % 12))].sort((x, y) => x - y)) === JSON.stringify([0, 4, 7])),
    JSON.stringify([first, second, third]));
}

console.log('\n=== And downward ===');
{
  const root = play({ chordInversion: 0 });
  const down1 = play({ chordInversion: -1 });
  const down2 = play({ chordInversion: -2 });
  check('it drops the top note', JSON.stringify(down1) === JSON.stringify([55, 60, 64]), JSON.stringify(down1));
  check('and keeps going down', down2[0] < down1[0], `${down1[0]} -> ${down2[0]}`);
  check('still the same chord',
    JSON.stringify([...new Set(down2.map(p => p % 12))].sort((a, b) => a - b)) === JSON.stringify([0, 4, 7]),
    JSON.stringify(down2));
  check('root position is between them', down1[0] < root[0], `${down1[0]} < ${root[0]}`);
}

(async () => {
  console.log('\n=== Continuous keeps the transport running ===');
  {
    const ONE = JSON.stringify({ name: 'T', lengthBeats: 4, events: [{ voice: 1, start: 0, length: 24, velocity: 100 }] });
    const mk = (continuous: boolean) => {
      const e = new OrchidEngine({ ...defaultParams, patternEnabled: true, patternBpm: 240, patternCustom: ONE, patternContinuous: continuous });
      const ons: number[] = [];
      e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
      return { e, ons };
    };

    const on = mk(true);
    on.e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(300);
    on.e.handleMidi(60, 0, false, false, false, false, true, []);
    on.ons.length = 0;
    await sleep(1300); // a cycle here is a second, so wait past one
    check('it plays on after the key is let go', on.ons.length > 0, `${on.ons.length}`);

    // A new chord changes the notes without restarting anything.
    on.ons.length = 0;
    on.e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    on.e.handleMidi(65, 0, false, false, false, false, true, []);
    await sleep(1300);
    check('a new chord changes what it plays', on.ons.some(p => [65, 69, 72].includes(p)), JSON.stringify([...new Set(on.ons)]));
    check('and the old chord is gone', !on.ons.some(p => [64, 67].includes(p)), JSON.stringify([...new Set(on.ons)]));

    on.e.panic();
    await sleep(200);
    on.ons.length = 0;
    await sleep(400);
    check('panic stops it', on.ons.length === 0, `${on.ons.length}`);

    const off = mk(false);
    off.e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(300);
    off.e.handleMidi(60, 0, false, false, false, false, true, []);
    off.ons.length = 0;
    await sleep(1300);
    check('switched off, it stops with the key', off.ons.length === 0, `${off.ons.length}`);
    off.e.panic();
    await sleep(80);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
