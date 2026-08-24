import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

type Ev = { kind: string; pitch: number; ch?: number; bend?: number };

function makeEngine(over: Partial<typeof defaultParams>) {
  const engine = new OrchidEngine({ ...defaultParams, mpeEnabled: true, ...over });
  const events: Ev[] = [];
  engine.onOutputNote = (e: any) => {
    // emitNoteOn also fires an expression event and a reset pitch-bend of 0;
    // neither is a glide, so they must not be counted as one.
    if (e.isExpression) events.push({ kind: 'EXPR', pitch: e.pitch, ch: e.mpeChannel });
    else if (e.isPitchBend) events.push({ kind: e.pitchBendValue === 0 ? 'BEND_RESET' : 'BEND', pitch: e.pitch, ch: e.mpeChannel, bend: e.pitchBendValue });
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

const bends = (e: Ev[]) => e.filter(x => x.kind === 'BEND').length;
const ons = (e: Ev[]) => e.filter(x => x.kind === 'ON').length;
const offs = (e: Ev[]) => e.filter(x => x.kind === 'OFF').length;

// keyboardMapping: 0=Classic, 2=Key Mode, 3=Free
async function main() {
  console.log('\n=== 1. LEGATO (mode 0): detached presses should NOT glide ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 0, keyboardMapping: 0 });
    engine.handleMidi(60, 100, true);
    engine.handleMidi(60, 0, false);
    events.length = 0;
    engine.handleMidi(64, 100, true);
    await sleep(220); // glide steps arrive on timers now
    check('no glide on detached press', bends(events) === 0, `bends=${bends(events)}`);
    check('fresh notes triggered', ons(events) > 0, `ons=${ons(events)}`);
  }

  console.log('\n=== 2. LEGATO (mode 0): overlapping presses SHOULD glide ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 0, keyboardMapping: 0 });
    engine.handleMidi(60, 100, true);
    events.length = 0;
    engine.handleMidi(64, 100, true); // press while 60 still held
    await sleep(220); // glide steps arrive on timers now
    check('glide on overlap', bends(events) > 0, `bends=${bends(events)}`);
  }

  console.log('\n=== 3. GRACE (mode 1): detached press within window SHOULD glide ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 1, mpeGraceMs: 300, keyboardMapping: 0 });
    engine.handleMidi(60, 100, true);
    engine.handleMidi(60, 0, false);
    check('release does not silence notes yet', offs(events) === 0, `offs=${offs(events)}`);
    events.length = 0;
    await sleep(50);
    engine.handleMidi(64, 100, true);
    await sleep(220); // glide steps arrive on timers now
    check('glide within grace window', bends(events) > 0, `bends=${bends(events)}`);
  }

  console.log('\n=== 4. GRACE (mode 1): press AFTER window should NOT glide ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 1, mpeGraceMs: 100, keyboardMapping: 0 });
    engine.handleMidi(60, 100, true);
    engine.handleMidi(60, 0, false);
    await sleep(250);
    check('notes released after grace expires', offs(events) > 0, `offs=${offs(events)}`);
    events.length = 0;
    engine.handleMidi(64, 100, true);
    await sleep(220); // glide steps arrive on timers now
    check('no glide after window', bends(events) === 0, `bends=${bends(events)}`);
  }

  console.log('\n=== 5. HOLD (mode 2): glides no matter how long the gap ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 2, keyboardMapping: 0 });
    engine.handleMidi(60, 100, true);
    engine.handleMidi(60, 0, false);
    await sleep(400);
    check('notes still ringing', offs(events) === 0, `offs=${offs(events)}`);
    events.length = 0;
    engine.handleMidi(64, 100, true);
    await sleep(220); // glide steps arrive on timers now
    check('glide after long gap', bends(events) > 0, `bends=${bends(events)}`);
  }

  console.log('\n=== 6. MEMORY PADS sharing a root (Cmaj -> Cmin), GRACE ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 1, mpeGraceMs: 500, keyboardMapping: 0 });
    engine.manualBaseType = 0; // major
    engine.handleMidi(60, 100, true, false, false, false, true);
    engine.handleMidi(60, 0, false, false, false, false, true);
    events.length = 0;
    engine.manualBaseType = 1; // minor, same root pitch
    engine.handleMidi(60, 100, true, false, false, false, true);
    await sleep(220); // glide steps arrive on timers now
    check('same-root pad change glides', bends(events) > 0, `bends=${bends(events)}`);
  }

  console.log('\n=== 7. KEY MODE root changes, GRACE ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 1, mpeGraceMs: 500, keyboardMapping: 2 });
    engine.handleMidi(60, 100, true);
    engine.handleMidi(60, 0, false);
    events.length = 0;
    engine.handleMidi(67, 100, true); // different root
    await sleep(220); // glide steps arrive on timers now
    check('key mode root change glides', bends(events) > 0, `bends=${bends(events)}`);
  }

  console.log('\n=== 8. FREE MODE, GRACE: consistent glide without pedal ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 1, mpeGraceMs: 500, keyboardMapping: 3 });
    engine.handleMidi(60, 100, true);
    engine.handleMidi(60, 0, false);
    events.length = 0;
    engine.handleMidi(64, 100, true);
    await sleep(220); // glide steps arrive on timers now
    check('free mode glides with no pedal', bends(events) > 0, `bends=${bends(events)}`);
  }

  console.log('\n=== 9. FREE MODE stays polyphonic (held keys not stolen) ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 1, mpeGraceMs: 500, keyboardMapping: 3 });
    engine.handleMidi(60, 100, true);
    events.length = 0;
    engine.handleMidi(64, 100, true); // 60 still physically held
    check('held note not stolen -> new note attacks', ons(events) > 0, `ons=${ons(events)}`);
    await sleep(220); // glide steps arrive on timers now
    check('no glide from a held key', bends(events) === 0, `bends=${bends(events)}`);
  }

  console.log('\n=== 10. Stale grace timer must not kill a re-pressed key ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 1, mpeGraceMs: 100, keyboardMapping: 0 });
    engine.handleMidi(60, 100, true);
    engine.handleMidi(60, 0, false);   // starts 100ms grace timer
    await sleep(30);
    engine.handleMidi(60, 100, true);  // re-press same key before it expires
    events.length = 0;
    await sleep(250);                  // old timer would have fired by now
    check('re-pressed key still sounding', offs(events) === 0, `offs=${offs(events)} (stale timer killed it)`);
  }

  console.log('\n=== 11. Free mode: stale timer must not kill re-pressed key ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 1, mpeGraceMs: 100, keyboardMapping: 3 });
    engine.handleMidi(60, 100, true);
    engine.handleMidi(60, 0, false);
    await sleep(30);
    engine.handleMidi(60, 100, true);
    events.length = 0;
    await sleep(250);
    check('re-pressed free-mode key still sounding', offs(events) === 0, `offs=${offs(events)}`);
  }

  console.log('\n=== 12. flushGlideCarry releases held notes (mode switch) ===');
  {
    const { engine, events } = makeEngine({ mpeGlideMode: 2, keyboardMapping: 0 });
    engine.handleMidi(60, 100, true);
    engine.handleMidi(60, 0, false);
    events.length = 0;
    engine.flushGlideCarry();
    check('carried notes released on flush', offs(events) > 0, `offs=${offs(events)}`);
  }

  console.log('\n=== 13. MPE OFF: no carry, behaves as before ===');
  {
    const { engine, events } = makeEngine({ mpeEnabled: false, mpeGlideMode: 2, keyboardMapping: 0 });
    engine.handleMidi(60, 100, true);
    events.length = 0;
    engine.handleMidi(60, 0, false);
    check('notes released immediately when MPE off', offs(events) > 0, `offs=${offs(events)}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
