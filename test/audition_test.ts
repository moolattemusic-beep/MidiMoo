import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * An audition is a chord being examined rather than played, so the controls
 * that shape playing must not touch it. What comes out should be the notes that
 * were asked for — the same notes whatever the instrument is set to.
 */
const rig = (over: any = {}) => {
  const e = new OrchidEngine({ ...defaultParams, mpeEnabled: false, ...over });
  const on: number[] = [], off: number[] = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isCC || ev.isPitchBend || ev.isExpression) return;
    (ev.isOn ? on : off).push(ev.pitch);
  };
  return { e, on, off };
};

const CHORD = [60, 64, 67, 71];   // Cmaj7 as the builder would name it

(async () => {
  console.log('\n=== It plays what it was given ===');
  {
    const { e, on } = rig();
    e.startAudition(CHORD, 100);
    await sleep(60);
    check('exactly those notes', on.sort((a, b) => a - b).join() === CHORD.join(), `${on}`);
    e.stopAudition();
  }
  {
    // The settings that would rewrite a played chord.
    const settings = [
      ['inversion', { chordInversion: 3 }],
      ['inversion downward', { chordInversion: -2 }],
      ['a moved register', { chordRegisterStart: 84 }],
      ['played voicings', { voicingPlayed: true }],
      ['colour', { chordColor: 100 }],
      ['a voice cap', { chordMaxNotes: 2 }],
      ['the voicing disk', { voicingX: 0.9, voicingY: 0.1 }],
      ['auto bass', { autoBassRegister: 1 }],
      ['a strum', { strumEnabled: true, strumTimeMs: 120 }],
    ] as const;
    for (const [label, over] of settings) {
      const { e, on } = rig(over as any);
      e.startAudition(CHORD, 100);
      await sleep(80);
      check(`${label} does not touch it`, on.sort((a, b) => a - b).join() === CHORD.join(), `${on}`);
      e.stopAudition();
    }
  }

  console.log('\n=== And gives it back ===');
  {
    const { e, on, off } = rig({ chordInversion: 4 });
    e.startAudition(CHORD, 100);
    await sleep(60);
    e.stopAudition();
    await sleep(60);
    check('every note is released', on.every(p => off.includes(p)), `${on} / ${off}`);
    check('and released at the pitch it sounded', off.sort((a, b) => a - b).join() === CHORD.join(), `${off}`);
  }
  {
    // Auditioning one option after another must not stack them up.
    const { e, on, off } = rig();
    e.startAudition([60, 64, 67], 100);
    await sleep(40);
    e.startAudition([62, 65, 69], 100);
    await sleep(40);
    check('starting another releases the first', [60, 64, 67].every(p => off.includes(p)), `${off}`);
    e.stopAudition();
    await sleep(40);
    const stuck = [...new Set(on)].filter(p => on.filter(x => x === p).length !== off.filter(x => x === p).length);
    check('and nothing is left sounding', stuck.length === 0, `${stuck}`);
  }
  {
    // With MPE it takes channels, and must hand them back.
    const { e } = rig({ mpeEnabled: true });
    const held = () => (e as any).mpeChannelsAllocated.filter(Boolean).length;
    e.startAudition(CHORD, 100);
    await sleep(60);
    check('MPE gives it a channel each', held() === CHORD.length, `${held()}`);
    e.stopAudition();
    await sleep(60);
    check('and takes them back', held() === 0, `${held()}`);
  }
  {
    // RANGE is a guarantee about what leaves the instrument, audition included.
    const { e, on } = rig({ outputRangeLow: 60, outputRangeHigh: 72 });
    e.startAudition([36, 40, 43, 96], 100);
    await sleep(60);
    check('nothing leaves the range', on.every(p => p >= 60 && p <= 72), `${on}`);
    e.stopAudition();
  }

  console.log('\n=== It does not disturb what is playing ===');
  {
    const { e, on, off } = rig();
    e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7]);
    await sleep(80);
    const played = [...on];
    off.length = 0;
    e.startAudition([79, 83], 100);
    await sleep(60);
    e.stopAudition();
    await sleep(60);
    check('the chord being held is untouched', played.every(p => !off.includes(p)), `${off}`);
    e.panic();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
