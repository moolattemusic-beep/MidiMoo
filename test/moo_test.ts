import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

type Ev = { kind: string; pitch: number; ch?: number; bend?: number };

function makeEngine(over: Partial<typeof defaultParams> = {}) {
  const engine = new OrchidEngine({
    ...defaultParams,
    mpeEnabled: true,
    mpeGlideMode: 3,
    keyboardMapping: 3,
    mpeMaxVoices: 5,
    mpeChordWindowMs: 40,
    mpeGlideTimeMs: 100,
    ...over,
  });
  const events: Ev[] = [];
  engine.onOutputNote = (e: any) => {
    if (e.isExpression) return;
    if (e.isPitchBend) events.push({ kind: e.pitchBendValue === 0 ? 'BEND_RESET' : 'BEND', pitch: e.pitch, ch: e.mpeChannel, bend: e.pitchBendValue });
    else if (e.isOn) events.push({ kind: 'ON', pitch: e.pitch, ch: e.mpeChannel });
    else events.push({ kind: 'OFF', pitch: e.pitch, ch: e.mpeChannel });
  };
  return { engine, events };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

// Where each voice ended up sounding (channel -> final pitch)
function voicePitches(engine: any): number[] {
  return engine.mooVoices.map((v: any) => Math.round(v.targetPitch)).sort((a: number, b: number) => a - b);
}
const ons = (e: Ev[]) => e.filter(x => x.kind === 'ON').length;
const offs = (e: Ev[]) => e.filter(x => x.kind === 'OFF').length;
const bends = (e: Ev[]) => e.filter(x => x.kind === 'BEND').length;

async function chord(engine: any, pitches: number[], vel = 100) {
  for (const p of pitches) engine.handleMidi(p, vel, true);
}

async function main() {
  console.log('\n=== 1. Voice pool fills up, then steals ===');
  {
    const { engine } = makeEngine({ mpeMaxVoices: 3 });
    engine.handleControlChange(64, 127); // sustain down
    for (const p of [60, 64, 67]) engine.handleMidi(p, 100, true);
    await sleep(80);
    check('pool filled to 3', (engine as any).mooVoices.length === 3, `n=${(engine as any).mooVoices.length}`);
    engine.handleMidi(69, 100, true);
    await sleep(80);
    check('still 3 voices after 4th note', (engine as any).mooVoices.length === 3, `n=${(engine as any).mooVoices.length}`);
  }

  console.log('\n=== 2. Single note at max steals NEAREST voice (glide, no retrigger) ===');
  {
    const { engine, events } = makeEngine({ mpeMaxVoices: 3 });
    engine.handleControlChange(64, 127);
    for (const p of [60, 64, 67]) engine.handleMidi(p, 100, true);
    await sleep(100);
    events.length = 0;
    engine.handleMidi(68, 100, true); // nearest is 67
    await sleep(150);
    check('no new note-on (voice was bent)', ons(events) === 0, `ons=${ons(events)}`);
    check('glided', bends(events) > 0, `bends=${bends(events)}`);
    check('voice moved 67 -> 68', voicePitches(engine).includes(68), `${voicePitches(engine)}`);
  }

  console.log('\n=== 3. Released key (under sustain) is stolen first ===');
  {
    const { engine } = makeEngine({ mpeMaxVoices: 3 });
    engine.handleControlChange(64, 127);
    for (const p of [60, 64, 67]) engine.handleMidi(p, 100, true);
    await sleep(100);
    engine.handleMidi(60, 0, false); // lift 60 -> expendable, still ringing
    await sleep(10);
    engine.handleMidi(68, 100, true); // nearest would be 67, but 60 was released
    await sleep(150);
    const p = voicePitches(engine);
    check('released voice took the new pitch', p.includes(68), `${p}`);
    check('nearest voice 67 left alone', p.includes(67), `${p}`);
    check('60 no longer sounding', !p.includes(60), `${p}`);
  }

  console.log('\n=== 4. Chord gesture re-voices everything (4 -> 4) ===');
  {
    const { engine } = makeEngine({ mpeMaxVoices: 5 });
    engine.handleControlChange(64, 127);
    await chord(engine, [60, 64, 67, 71]); // Cmaj7
    await sleep(150);
    await chord(engine, [62, 65, 69, 72]); // Dm7
    await sleep(200);
    check('4 voices still', (engine as any).mooVoices.length === 4, `n=${(engine as any).mooVoices.length}`);
    check('landed on new chord', JSON.stringify(voicePitches(engine)) === JSON.stringify([62, 65, 69, 72]), `${voicePitches(engine)}`);
  }

  console.log('\n=== 5. SPLIT: chord A (4 notes) -> chord B (5 notes) ===');
  {
    const { engine, events } = makeEngine({ mpeMaxVoices: 5 });
    engine.handleControlChange(64, 127);
    await chord(engine, [60, 64, 67, 71]);
    await sleep(150);
    events.length = 0;
    await chord(engine, [62, 65, 69, 72, 76]);
    await sleep(250);
    check('grew to 5 voices', (engine as any).mooVoices.length === 5, `n=${(engine as any).mooVoices.length}`);
    check('exactly one new voice born (split)', ons(events) === 1, `ons=${ons(events)}`);
    check('nothing was released', offs(events) === 0, `offs=${offs(events)}`);
    check('landed on chord B', JSON.stringify(voicePitches(engine)) === JSON.stringify([62, 65, 69, 72, 76]), `${voicePitches(engine)}`);
  }

  console.log('\n=== 6. MERGE: chord A (5 notes) -> chord B (4 notes) ===');
  {
    const { engine, events } = makeEngine({ mpeMaxVoices: 5 });
    engine.handleControlChange(64, 127);
    await chord(engine, [60, 64, 67, 71, 74]);
    await sleep(150);
    events.length = 0;
    await chord(engine, [62, 65, 69, 72]);
    await sleep(250);
    check('still 5 voices (one doubled)', (engine as any).mooVoices.length === 5, `n=${(engine as any).mooVoices.length}`);
    check('no voice released on merge', offs(events) === 0, `offs=${offs(events)}`);
    const uniq = Array.from(new Set(voicePitches(engine))).sort((a, b) => a - b);
    check('all voices sit on chord B pitches', JSON.stringify(uniq) === JSON.stringify([62, 65, 69, 72]), `${voicePitches(engine)}`);
  }

  console.log('\n=== 7. Voice leading is monotone (no crossing) ===');
  {
    const { engine } = makeEngine({ mpeMaxVoices: 5 });
    engine.handleControlChange(64, 127);
    await chord(engine, [60, 64, 67]);
    await sleep(150);
    await chord(engine, [61, 65, 68]);
    await sleep(250);
    const sorted = (engine as any).mooVoices
      .slice()
      .sort((a: any, b: any) => a.basePitch - b.basePitch)
      .map((v: any) => Math.round(v.targetPitch));
    const isMonotone = sorted.every((v: number, i: number) => i === 0 || v >= sorted[i - 1]);
    check('voices keep their order', isMonotone, `${sorted}`);
  }

  console.log('\n=== 8. Sustain up releases the held chord ===');
  {
    const { engine, events } = makeEngine({ mpeMaxVoices: 5 });
    engine.handleControlChange(64, 127);
    await chord(engine, [60, 64, 67]);
    await sleep(150);
    for (const p of [60, 64, 67]) engine.handleMidi(p, 0, false);
    await sleep(20);
    check('still ringing under pedal', (engine as any).mooVoices.length === 3, `n=${(engine as any).mooVoices.length}`);
    events.length = 0;
    engine.handleControlChange(64, 0); // pedal up
    await sleep(50);
    check('all voices released', (engine as any).mooVoices.length === 0, `n=${(engine as any).mooVoices.length}`);
    check('note-offs sent', offs(events) === 3, `offs=${offs(events)}`);
  }

  console.log('\n=== 9. No pedal: releasing a key ends its note ===');
  {
    const { engine, events } = makeEngine({ mpeMaxVoices: 5 });
    engine.handleMidi(60, 100, true);
    await sleep(60);
    events.length = 0;
    engine.handleMidi(60, 0, false);
    await sleep(20);
    check('voice released on key up', (engine as any).mooVoices.length === 0, `n=${(engine as any).mooVoices.length}`);
    check('note-off sent', offs(events) === 1, `offs=${offs(events)}`);
  }

  console.log('\n=== 10. First note ever attacks cleanly (no swoop) ===');
  {
    const { engine, events } = makeEngine();
    engine.handleMidi(60, 100, true);
    await sleep(60);
    const on = events.find(e => e.kind === 'ON');
    check('note-on at the played pitch', on?.pitch === 60, `${on?.pitch}`);
    check('no glide from nowhere', bends(events) === 0, `bends=${bends(events)}`);
  }

  console.log('\n=== 11. maxVoices=1 -> everything glides, mono ===');
  {
    const { engine, events } = makeEngine({ mpeMaxVoices: 1 });
    engine.handleControlChange(64, 127);
    engine.handleMidi(60, 100, true);
    await sleep(80);
    events.length = 0;
    engine.handleMidi(67, 100, true);
    await sleep(150);
    check('still one voice', (engine as any).mooVoices.length === 1, `n=${(engine as any).mooVoices.length}`);
    check('glided, no retrigger', ons(events) === 0 && bends(events) > 0, `ons=${ons(events)} bends=${bends(events)}`);
  }

  console.log('\n=== 12. PANIC clears the pool ===');
  {
    const { engine } = makeEngine();
    engine.handleControlChange(64, 127);
    await chord(engine, [60, 64, 67]);
    await sleep(150);
    engine.panic();
    check('pool cleared', (engine as any).mooVoices.length === 0, `n=${(engine as any).mooVoices.length}`);
  }

  console.log('\n=== 13. Re-targeting mid-glide does not strand a voice ===');
  {
    const { engine } = makeEngine({ mpeMaxVoices: 1, mpeGlideTimeMs: 400 });
    engine.handleControlChange(64, 127);
    engine.handleMidi(60, 100, true);
    await sleep(50);
    engine.handleMidi(72, 100, true);  // start a long glide
    await sleep(60);                    // interrupt it partway
    engine.handleMidi(64, 100, true);
    await sleep(500);
    const v = (engine as any).mooVoices[0];
    check('voice arrives at final target', Math.round(v.currentPitch) === 64, `at ${v.currentPitch}`);
  }

  console.log('\n=== 14. Strum plate mirror stays in sync ===');
  {
    const { engine } = makeEngine();
    engine.handleControlChange(64, 127);
    await chord(engine, [60, 64, 67]);
    await sleep(150);
    const mem = (engine as any).activePitchesMemory;
    const mirrored = Object.keys(mem).filter(k => mem[k]?.length > 0).length;
    check('mirror has the sounding keys', mirrored === 3, `keys=${mirrored}`);
    engine.handleControlChange(64, 0);
    for (const p of [60, 64, 67]) engine.handleMidi(p, 0, false);
    await sleep(50);
    const left = Object.keys(mem).filter(k => mem[k]?.length > 0).length;
    check('mirror emptied after release', left === 0, `keys=${left}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
