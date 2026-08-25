import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const LOW = 48, HIGH = 72;

/**
 * RANGE is the last thing that happens to a note number, so nothing should
 * leave the instrument outside it — whatever produced the note, and whatever
 * the register, inversion or voicing controls were doing beforehand.
 */
const rig = (over: any = {}) => {
  const e = new OrchidEngine({
    ...defaultParams, outputRangeLow: LOW, outputRangeHigh: HIGH,
    mpeEnabled: false, ...over,
  });
  const out: number[] = [];
  e.onOutputNote = (ev: any) => { if (!ev.isPitchBend && !ev.isCC) out.push(ev.pitch); };
  return { e, out };
};
const outside = (notes: number[]) => notes.filter(p => p < LOW || p > HIGH);

(async () => {
  console.log('\n=== Nothing leaves the range ===');
  {
    const { e, out } = rig({ autoBassRegister: 1, chordRegisterStart: 84 });
    e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7, 11]);
    await sleep(120);
    e.handleMidi(60, 0, false, false, false, false, true, undefined, [0, 4, 7, 11]);
    await sleep(80);
    check('a chord placed high is folded in', out.length > 0 && outside(out).length === 0, `${outside(out)}`);
  }
  {
    // The bass has its own register, well below the window.
    const { e, out } = rig({ autoBassRegister: 1 });
    e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7]);
    await sleep(120);
    check('the bass is folded in too', outside(out).length === 0, `${outside(out)}`);
    e.panic();
  }
  {
    const { e, out } = rig({ arpeggioNoteLengthMs: 40 });
    for (const pitch of [30, 40, 90, 100, 120]) { e.handleArpeggioNoteOn(pitch, 100); await sleep(25); }
    await sleep(150);
    check('arpeggio notes are folded in', out.length > 0 && outside(out).length === 0, `${outside(out)}`);
    e.panic();
  }
  {
    const { e, out } = rig({
      patternEnabled: true, patternBpm: 240, chordRegisterStart: 84,
      patternCustom: JSON.stringify({ name: 'T', lengthBeats: 1, events: [
        { voice: 1, start: 0, length: 12, velocity: 100 }, { voice: 3, start: 12, length: 12, velocity: 90 }] }),
      patternOctaves: 3,
    });
    e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7, 11]);
    await sleep(400);
    e.handleMidi(60, 0, false, false, false, false, true, undefined, [0, 4, 7, 11]);
    await sleep(150);
    check('pattern notes are folded in', out.length > 0 && outside(out).length === 0, `${outside(out)}`);
    e.panic();
  }
  {
    // A range narrower than an octave cannot be folded into, so it is left
    // alone rather than clamping every note onto one pitch.
    const { e, out } = rig({ outputRangeLow: 60, outputRangeHigh: 66 });
    e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7]);
    await sleep(120);
    check('a range under an octave is ignored rather than obeyed badly',
      out.length > 0 && out.some(p => p > 66), `${out}`);
    e.panic();
  }

  console.log('\n=== A folded note is still released ===');
  {
    // Folding happens on the way in and the way out; if the two disagreed the
    // note-off would name a pitch nothing is playing and the note would hang.
    const { e, out } = rig({ chordRegisterStart: 84, autoBassRegister: 1 });
    const on: number[] = [], off: number[] = [];
    e.onOutputNote = (ev: any) => { if (!ev.isPitchBend && !ev.isCC) (ev.isOn ? on : off).push(ev.pitch); };
    e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7, 11]);
    await sleep(120);
    e.handleMidi(60, 0, false, false, false, false, true, undefined, [0, 4, 7, 11]);
    await sleep(120);
    check('every folded note gets a note-off at the same pitch',
      on.every(p => off.includes(p)), `on ${on} off ${off}`);
  }
  {
    // Moving the range while a chord is held must not strand the old pitches.
    const { e } = rig({ chordRegisterStart: 72 });
    const on: number[] = [], off: number[] = [];
    e.onOutputNote = (ev: any) => { if (!ev.isPitchBend && !ev.isCC) (ev.isOn ? on : off).push(ev.pitch); };
    e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7]);
    await sleep(100);
    e.params = { ...e.params, outputRangeLow: 24, outputRangeHigh: 48 };
    e.handleMidi(60, 0, false, false, false, false, true, undefined, [0, 4, 7]);
    await sleep(150);
    const stuck = [...new Set(on)].filter(p => !off.includes(p));
    check('moving the range mid-chord leaves nothing sounding', stuck.length === 0, `${stuck}`);
    e.panic();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
