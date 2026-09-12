/**
 * A memory pad's release ends the chord that pad started, and nothing else.
 *
 * A pad is filed under its chord's root, so two pads share one key whenever
 * their chords share a root — Cmaj and Cmin, or any two preset pads on the same
 * bass note, which is 213 of the 221 bundled presets. Pressing the second pad
 * takes the key over; the first pad's release then arrives a moment later, and
 * acting on it cut the new chord short. Under the pedal it was worse: the stale
 * release marked the new chord as let go while its pad was still held.
 */
import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Pad = { index: number; key: number; intervals: number[] };

// Two pads on one key, as Cmaj and Cmin sit on a set, and one off on its own.
const A: Pad = { index: 0, key: 60, intervals: [0, 4, 7] };
const B: Pad = { index: 1, key: 60, intervals: [0, 3, 7] };
const FAR: Pad = { index: 2, key: 65, intervals: [0, 4, 7] };

function rig(over: Record<string, unknown> = {}) {
  const engine = new OrchidEngine({
    ...defaultParams,
    mpeEnabled: false, strumEngine: 0, autoBassRegister: 0, patternEnabled: false,
    ...over,
  } as any);
  const events: Array<{ on: boolean; pitch: number }> = [];
  engine.onOutputNote = (e: any) => {
    if (e.isCC || e.isExpression || e.isPitchBend) return;
    events.push({ on: !!e.isOn && e.velocity > 0, pitch: e.pitch });
  };

  const mark = () => events.length;
  const since = (at: number) => events.slice(at);
  /**
   * What is ringing right now: a pitch whose last word was a note-on. Counting
   * ons against offs would answer a different question, since two keys holding
   * the same note deliberately send two note-ons and one note-off — the last
   * key to let go owes it, so the note is not cut from under the other one.
   */
  const sounding = () => {
    const last = new Map<number, boolean>();
    for (const e of events) last.set(e.pitch, e.on);
    return new Set([...last].filter(([, on]) => on).map(([p]) => p));
  };
  /** Press a pad exactly as the pads do, and hand back what it sounded. */
  const press = (pad: Pad) => {
    const at = mark();
    engine.handleMidi(pad.key, 100, true, false, false, false, true, undefined, pad.intervals, pad.index);
    return since(at).filter(e => e.on).map(e => e.pitch);
  };
  const release = (pad: Pad) =>
    engine.handleMidi(pad.key, 0, false, false, false, false, true, undefined, pad.intervals, pad.index);
  const pedal = (down: boolean) => engine.handleControlChange(64, down ? 127 : 0);
  const stillSounding = (notes: number[]) => notes.every(p => sounding().has(p));

  return { engine, events, mark, since, sounding, press, release, pedal, stillSounding };
}

async function main() {
  console.log('\n=== The glitch: a pad let go after the next one was pressed ===');
  {
    const r = rig();
    r.press(A);
    const second = r.press(B);
    const at = r.mark();
    r.release(A); // the tiny overlap: A let go just after B was pressed
    check('the new chord is not cut short', r.since(at).filter(e => !e.on).length === 0,
      JSON.stringify(r.since(at)));
    check('every note of it is still sounding', r.stillSounding(second), `${second} vs ${[...r.sounding()]}`);
    r.release(B);
    check('and letting go of it does end it', r.sounding().size === 0, `${[...r.sounding()]}`);
  }

  console.log('\n=== The same, with the sustain pedal down ===');
  {
    const r = rig();
    r.pedal(true);
    r.press(A);
    const second = r.press(B);
    const at = r.mark();
    r.release(A);
    check('the pedal does not take the stale release for the new chord',
      r.since(at).filter(e => !e.on).length === 0, JSON.stringify(r.since(at)));
    r.press(FAR); // a new chord over a held pedal flushes what the pedal holds
    check('and the new chord is still held, not flushed with the old one',
      r.stillSounding(second), `${second} vs ${[...r.sounding()]}`);
    r.release(B); r.release(FAR); r.pedal(false);
    check('the pedal still ends everything when it lifts', r.sounding().size === 0, `${[...r.sounding()]}`);
  }

  console.log('\n=== The same, gliding under MPE ===');
  {
    const r = rig({ mpeEnabled: true, mpeGlideMode: 1, mpeGraceMs: 300 });
    r.press(A);
    const second = r.press(B);
    const at = r.mark();
    r.release(A);
    await sleep(400); // longer than the grace window the stale release would start
    check('the glided chord is not silenced by the grace timer',
      r.since(at).filter(e => !e.on).length === 0, JSON.stringify(r.since(at)));
    check('it is all still sounding', r.stillSounding(second), `${second} vs ${[...r.sounding()]}`);
  }

  console.log('\n=== The on-screen pads: switch away, then the finger lifts ===');
  {
    // Pressing a pad on screen releases the others first, so A is let go twice:
    // once by the switch, and again when the finger actually leaves it.
    const r = rig();
    r.press(A);
    r.release(A);
    const second = r.press(B);
    const at = r.mark();
    r.release(A); // the late pointer-up
    check('the late release passes over the pad that took the key',
      r.since(at).filter(e => !e.on).length === 0, JSON.stringify(r.since(at)));
    check('the chord is intact', r.stillSounding(second), `${second} vs ${[...r.sounding()]}`);
  }

  console.log('\n=== What must not change ===');
  {
    const r = rig();
    const first = r.press(A);
    const far = r.press(FAR);
    const at = r.mark();
    r.release(A);
    check('a pad on its own key still ends when it is let go',
      first.some(p => r.since(at).some(e => !e.on && e.pitch === p)), JSON.stringify(r.since(at)));
    check('and the other pad plays on', r.stillSounding(far), `${far} vs ${[...r.sounding()]}`);
    r.release(FAR);
    check('nothing is left hanging', r.sounding().size === 0, `${[...r.sounding()]}`);
  }
  {
    // The chord grid and the keyboard never name a pad, and are untouched.
    const r = rig();
    r.engine.handleMidi(60, 100, true, false, false, false, true, undefined, A.intervals);
    const at = r.mark();
    r.engine.handleMidi(60, 0, false, false, false, false, true, undefined, A.intervals);
    check('a chord played without a pad still ends on its release',
      r.since(at).filter(e => !e.on).length > 0 && r.sounding().size === 0, JSON.stringify(r.since(at)));
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
