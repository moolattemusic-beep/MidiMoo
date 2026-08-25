import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * The member channels are a pool of fourteen. Anything that takes one and does
 * not give it back is invisible until the pool runs dry, at which point every
 * note lands on the same channel, expression stops working, and only a restart
 * clears it. So each of these plays something, gets rid of it however that
 * scenario gets rid of things, and asks for the pool back.
 */
const held = (engine: any) => engine.mpeChannelsAllocated.filter(Boolean).length;
const rig = (over: any = {}) => {
  const e = new OrchidEngine({ ...defaultParams, mpeEnabled: true, mpeGlideMode: 0, ...over });
  e.onOutputNote = () => {};
  return e;
};
const press = (e: any, root: number, v: number[]) => e.handleMidi(root, 100, true, false, false, false, true, v, undefined);
const lift = (e: any, root: number, v: number[]) => e.handleMidi(root, 0, false, false, false, false, true, v, undefined);

(async () => {
  console.log('\n=== Panic gives the channels back ===');
  {
    const e = rig({ autoBassRegister: 1 });
    press(e, 60, [60, 64, 67]);
    await sleep(80);
    check('a held chord is using channels', held(e) > 0, `${held(e)}`);
    e.panic();
    await sleep(60);
    check('panic returns every one of them', held(e) === 0, `${held(e)}`);
  }
  {
    // The failure was cumulative, which is why it looked intermittent: each
    // panic stranded a few until one day there were none left.
    const e = rig({ autoBassRegister: 1 });
    for (let round = 0; round < 8; round++) {
      press(e, 60 + round, [60 + round, 64 + round, 67 + round]);
      await sleep(35);
      e.panic();
      await sleep(35);
    }
    check('eight panics in a row strand nothing', held(e) === 0, `${held(e)}`);
    press(e, 72, [72, 76, 79]);
    await sleep(80);
    check('and MPE still hands out separate channels afterwards', held(e) >= 3, `${held(e)}`);
    e.panic();
  }

  console.log('\n=== Ordinary playing gives them back too ===');
  {
    const e = rig({ autoBassRegister: 1 });
    for (let round = 0; round < 6; round++) {
      press(e, 60, [60, 64, 67]);
      await sleep(40);
      lift(e, 60, [60, 64, 67]);
      await sleep(40);
    }
    check('six chords on and off leave nothing held', held(e) === 0, `${held(e)}`);
    e.panic();
  }
  {
    // Overlapping chords, released in the other order.
    const e = rig();
    press(e, 60, [60, 64, 67]);
    await sleep(40);
    press(e, 57, [57, 60, 64]);
    await sleep(40);
    lift(e, 60, [60, 64, 67]);
    await sleep(40);
    lift(e, 57, [57, 60, 64]);
    await sleep(80);
    check('overlapping chords give theirs back', held(e) === 0, `${held(e)}`);
    e.panic();
  }
  {
    // Glide parks a released chord; flushing it must not keep the channels.
    const e = rig({ mpeGlideMode: 1, mpeGraceMs: 60 });
    press(e, 60, [60, 64, 67]);
    await sleep(40);
    lift(e, 60, [60, 64, 67]);
    await sleep(250);
    check('a carried chord releases its channels when the grace runs out', held(e) === 0, `${held(e)}`);
    e.panic();
  }
  {
    const e = rig({ mpeGlideMode: 2 });
    press(e, 60, [60, 64, 67]);
    await sleep(40);
    lift(e, 60, [60, 64, 67]);
    await sleep(60);
    e.flushGlideCarry();
    await sleep(60);
    check('and flushing a held carry does the same', held(e) === 0, `${held(e)}`);
    e.panic();
  }
  {
    // Turning MPE off mid-chord: the notes go, so the channels should follow.
    const e = rig();
    press(e, 60, [60, 64, 67]);
    await sleep(60);
    e.params = { ...e.params, mpeEnabled: false };
    e.flushGlideCarry();
    lift(e, 60, [60, 64, 67]);
    await sleep(80);
    check('switching MPE off mid-chord strands nothing', held(e) === 0, `${held(e)}`);
    e.panic();
  }
  {
    // A pattern holds its own notes and its own bass.
    const e = rig({
      autoBassRegister: 1, patternEnabled: true, patternBpm: 240,
      patternCustom: JSON.stringify({ name: 'T', lengthBeats: 1, events: [{ voice: 1, start: 0, length: 12, velocity: 100 }] }),
    });
    press(e, 60, [60, 64, 67]);
    await sleep(300);
    lift(e, 60, [60, 64, 67]);
    await sleep(250);
    check('a pattern gives its channels back', held(e) === 0, `${held(e)}`);
    e.panic();
  }
  {
    // The arpeggio takes from the top of the pool.
    const e = rig({ arpeggioNoteLengthMs: 30 });
    for (let i = 0; i < 6; i++) {
      e.handleArpeggioNoteOn(72 + i, 100);
      await sleep(20);
      e.handleArpeggioNoteOff(72 + i);
      await sleep(20);
    }
    await sleep(120);
    check('the arpeggio gives its channels back', held(e) === 0, `${held(e)}`);
    e.panic();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
