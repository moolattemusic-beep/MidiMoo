import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Ev = { kind: string; pitch: number; ch?: number };
function makeEngine(over: any = {}) {
  const engine: any = new OrchidEngine({ ...defaultParams, mpeEnabled: true, ...over });
  const events: Ev[] = [];
  engine.onOutputNote = (e: any) => {
    if (e.isExpression || e.isPitchBend) return;
    events.push({ kind: e.isOn ? 'ON' : 'OFF', pitch: e.pitch, ch: e.mpeChannel });
  };
  return { engine, events };
}
const offs = (e: Ev[]) => e.filter(x => x.kind === 'OFF').length;

async function main() {
  // ---- REGRESSION: Free MOO selected must not affect the chord modes ----
  for (const [label, mapping] of [['KEY MODE', 2], ['CLASSIC', 0], ['CIRCLE', 1]] as const) {
    console.log(`\n=== Free MOO selected while in ${label} ===`);
    const { engine, events } = makeEngine({ mpeGlideMode: 3, keyboardMapping: mapping });
    engine.handleMidi(60, 100, true);
    await sleep(30);
    events.length = 0;
    engine.handleMidi(60, 0, false);
    await sleep(50);
    check(`${label}: notes release on key up`, offs(events) > 0, `offs=${offs(events)} (stuck notes)`);
    check(`${label}: nothing left ringing`, Object.keys(engine.activePitchesMemory).filter(k => engine.activePitchesMemory[k]?.length).length === 0);
  }

  console.log('\n=== Key mode glide still works (mode 0, overlapping) ===');
  {
    const { engine } = makeEngine({ mpeGlideMode: 0, keyboardMapping: 2 });
    const bends: number[] = [];
    engine.onOutputNote = (e: any) => { if (e.isPitchBend && e.pitchBendValue !== 0) bends.push(e.pitchBendValue); };
    engine.handleMidi(60, 100, true);
    engine.handleMidi(64, 100, true); // overlap
    await sleep(220); // glide steps arrive on timers now
    check('glide fires in key mode', bends.length > 0, `bends=${bends.length}`);
  }

  // ---- REGRESSION: every voice needs its own MIDI note number ----
  console.log('\n=== Free MOO: 3-note chord produces 3 distinct note numbers ===');
  for (const spread of [0, 10, 25, 45]) {
    const { engine, events } = makeEngine({
      mpeGlideMode: 3, keyboardMapping: 3, mpeMaxVoices: 5,
      mpeChordWindowMs: 60, mpeGlideTimeMs: 100,
    });
    engine.handleControlChange(64, 127);
    for (const p of [60, 64, 67]) { engine.handleMidi(p, 100, true); if (spread) await sleep(spread); }
    await sleep(250);
    const notes = events.filter(e => e.kind === 'ON').map(e => e.pitch);
    const uniq = new Set(notes);
    check(`spread ${spread}ms: 3 voices`, engine.mooVoices.length === 3, `n=${engine.mooVoices.length}`);
    check(`spread ${spread}ms: note numbers all distinct`, uniq.size === notes.length, `notes=${notes}`);
    const sounding = engine.mooVoices.map((v: any) => Math.round(v.targetPitch)).sort((a: number, b: number) => a - b);
    check(`spread ${spread}ms: sounds the chord played`, JSON.stringify(sounding) === JSON.stringify([60, 64, 67]), `${sounding}`);
  }

  console.log('\n=== Free MOO: chord from silence attacks cleanly (no swoop) ===');
  {
    const { engine, events } = makeEngine({
      mpeGlideMode: 3, keyboardMapping: 3, mpeMaxVoices: 5, mpeChordWindowMs: 60, mpeGlideTimeMs: 100,
    });
    engine.handleControlChange(64, 127);
    for (const p of [60, 64, 67]) engine.handleMidi(p, 100, true);
    const onPitches = events.filter(e => e.kind === 'ON').map(e => e.pitch).sort((a, b) => a - b);
    check('each note attacks at its own pitch', JSON.stringify(onPitches) === JSON.stringify([60, 64, 67]), `${onPitches}`);
  }

  console.log('\n=== Free MOO: live voices never share a note number ===');
  {
    const { engine } = makeEngine({
      mpeGlideMode: 3, keyboardMapping: 3, mpeMaxVoices: 5, mpeChordWindowMs: 40, mpeGlideTimeMs: 80,
    });
    engine.handleControlChange(64, 127);
    const seq = [[60, 64, 67], [62, 65, 69], [60, 63, 67, 70], [61, 64], [59, 62, 66, 69, 72]];
    for (const ch of seq) {
      for (const p of ch) engine.handleMidi(p, 100, true);
      await sleep(120);
      const bases = engine.mooVoices.map((v: any) => v.basePitch);
      check(`chord ${ch.join(',')}: unique note numbers`, new Set(bases).size === bases.length, `bases=${bases}`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
