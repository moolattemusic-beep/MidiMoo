import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function mk(over: any = {}) {
  const engine: any = new OrchidEngine({
    ...defaultParams, mpeEnabled: true, mpeGlideMode: 3, keyboardMapping: 3,
    mpeMaxVoices: 5, mpeChordWindowMs: 60, mpeGlideTimeMs: 100, ...over,
  });
  const on: any[] = [], off: any[] = [];
  engine.onOutputNote = (e: any) => {
    if (e.isExpression || e.isPitchBend) return;
    (e.isOn ? on : off).push({ pitch: e.pitch, ch: e.mpeChannel });
  };
  return { engine, on, off };
}
const dangling = (on: any[], off: any[]) => {
  const live = new Map<string, number>();
  for (const n of on) { const k = `${n.ch}:${n.pitch}`; live.set(k, (live.get(k) || 0) + 1); }
  for (const n of off) { const k = `${n.ch}:${n.pitch}`; live.set(k, (live.get(k) || 0) - 1); }
  return [...live.entries()].filter(([, v]) => v > 0);
};

async function main() {
  console.log('\n=== A. Staccato chord gesture: keys released before the window closes ===');
  {
    const { engine, on, off } = mk();
    for (const p of [60, 64, 67]) engine.handleMidi(p, 100, true);
    await sleep(200);
    // play a 2-note chord and let go of it fast (inside the 60ms chord window)
    for (const p of [62, 65]) engine.handleMidi(p, 100, true);
    await sleep(25);
    for (const p of [62, 65]) engine.handleMidi(p, 0, false);
    await sleep(400);
    // release everything still physically down
    for (const p of [60, 64, 67]) engine.handleMidi(p, 0, false);
    await sleep(300);
    check('no voices left in pool', engine.mooVoices.length === 0, `n=${engine.mooVoices.length}`);
    check('every note-on was matched by a note-off', dangling(on, off).length === 0, `hanging=${JSON.stringify(dangling(on, off))}`);
  }

  console.log('\n=== B. Same, with sustain pedal used then lifted ===');
  {
    const { engine, on, off } = mk();
    engine.handleControlChange(64, 127);
    for (const p of [60, 64, 67]) engine.handleMidi(p, 100, true);
    await sleep(200);
    for (const p of [62, 65]) engine.handleMidi(p, 100, true);
    await sleep(25);
    for (const p of [62, 65]) engine.handleMidi(p, 0, false);
    await sleep(400);
    for (const p of [60, 64, 67]) engine.handleMidi(p, 0, false);
    engine.handleControlChange(64, 0);
    await sleep(300);
    check('no voices left in pool', engine.mooVoices.length === 0, `n=${engine.mooVoices.length}`);
    check('every note-on was matched by a note-off', dangling(on, off).length === 0, `hanging=${JSON.stringify(dangling(on, off))}`);
  }

  console.log('\n=== C. How often does a voice borrow a wrong note number? ===');
  {
    const { engine } = mk();
    engine.handleControlChange(64, 127);
    const prog = [[60, 64, 67], [62, 65, 69], [60, 63, 67, 70], [59, 62, 66], [61, 64, 68, 71]];
    let borrowed: any[] = [];
    for (const ch of prog) {
      for (const p of ch) engine.handleMidi(p, 100, true);
      await sleep(200);
      for (const v of engine.mooVoices) {
        if (Math.round(v.targetPitch) !== v.basePitch) {
          borrowed.push({ noteSent: v.basePitch, shouldSound: Math.round(v.targetPitch), offBy: Math.round(v.targetPitch) - v.basePitch });
        }
      }
    }
    console.log('  voices whose MIDI note number != the pitch they should sound:');
    console.log('  ', JSON.stringify(borrowed));
    // Borrowing is the design, not a fault: a synth keyed by pitch kills an
    // existing note of the same number, so a voice takes a free number and the
    // bend makes up the difference. What matters is that the correction stays
    // inside the bend range, or the voice would sound at the wrong pitch.
    const range = engine.params.mpeBendRange ?? 48;
    check('borrowed numbers are corrected within the bend range',
      borrowed.every(b => Math.abs(b.offBy) <= range),
      JSON.stringify(borrowed.filter(b => Math.abs(b.offBy) > range)));
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
}
main();
