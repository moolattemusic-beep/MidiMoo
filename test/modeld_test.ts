import { ModelD, defaultModelDParams } from '../src/lib/ModelD.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

type Ev = { on: boolean; pitch: number; velocity: number; delay: number };

/**
 * A rig with a clock the test drives by hand, so an arp that runs at 40ms can
 * be stepped through in no time at all and the assertions are about ordering
 * rather than about whether the machine kept up.
 */
function rig(overrides: Partial<typeof defaultModelDParams> = {}) {
  let t = 1000;
  const rolls: number[] = [];
  const out: Ev[] = [];
  const m = new ModelD(() => t, () => (rolls.length ? rolls.shift()! : 0.5));
  m.params = { ...defaultModelDParams, ...overrides };
  m.onNoteOn = (pitch, velocity, delay) => out.push({ on: true, pitch, velocity, delay });
  m.onNoteOff = (pitch, delay) => out.push({ on: false, pitch, velocity: 0, delay });
  return {
    m, out, rolls,
    advance: (ms: number) => { t += ms; },
    now: () => t,
    ons: () => out.filter(e => e.on),
    offs: () => out.filter(e => !e.on),
    clear: () => { out.length = 0; },
  };
}

function main() {
  console.log('=== Mono: the last note played is the one that sounds ===');
  {
    const r = rig({ arpOn: false });
    r.m.noteOn(60, 100);
    check('first note sounds', r.ons().length === 1 && r.ons()[0].pitch === 60);

    r.clear();
    r.m.noteOn(64, 100);
    check('the new note takes over', r.ons().length === 1 && r.ons()[0].pitch === 64);
    check('the old one is stopped', r.offs().some(e => e.pitch === 60));

    r.clear();
    r.m.noteOff(64);
    check('releasing falls back to what is still held', r.ons().length === 1 && r.ons()[0].pitch === 60,
      `${JSON.stringify(r.ons())}`);

    r.clear();
    r.m.noteOff(60);
    check('nothing held, nothing sounding', r.ons().length === 0 && r.offs().some(e => e.pitch === 60));
  }

  console.log('\n=== The retrigger gap ===');
  {
    const r = rig({ arpOn: false, gapMs: 12 });
    r.m.noteOn(60, 100);
    r.clear();
    r.m.noteOn(67, 100);
    const on = r.ons()[0];
    check('the new note waits out the gap', on.pitch === 67 && on.delay === 12, `delay ${on.delay}`);
    const immediate = r.offs().find(e => e.delay === 0);
    const trailing = r.offs().find(e => e.delay > 0);
    check('the old note stops at once', !!immediate && immediate.pitch === 60);
    check('and again after the gap, in case the first was missed',
      !!trailing && trailing.pitch === 60 && trailing.delay === 14, `${JSON.stringify(trailing)}`);
  }

  console.log('\n=== Buffer overflow keeps the bass ===');
  {
    const r = rig({ arpOn: false, maxNotes: 3, lowestNotePriority: true });
    [48, 60, 64, 67].forEach(p => r.m.noteOn(p, 100));
    check('buffer capped', r.m.heldCount === 3, `${r.m.heldCount}`);

    // 48 is the lowest and must survive; the drop falls on the first note that
    // is not it, which is 60.
    r.clear();
    r.m.noteOff(67); r.m.noteOff(64);
    check('the bass is still there to fall back to',
      r.ons().some(e => e.pitch === 48), `${JSON.stringify(r.ons())}`);
  }
  {
    const r = rig({ arpOn: false, maxNotes: 2, lowestNotePriority: false });
    [48, 60, 64].forEach(p => r.m.noteOn(p, 100));
    r.clear();
    r.m.noteOff(64);
    check('without the priority the oldest goes instead',
      r.ons().some(e => e.pitch === 60), `${JSON.stringify(r.ons())}`);
  }

  console.log('\n=== Arp: two notes or more cycle ===');
  {
    const r = rig({ arpOn: true, baseArpSpeedMs: 40, gapMs: 0, curveEnabled: false });
    r.m.noteOn(60, 100);
    r.m.noteOn(64, 100);
    r.m.noteOn(67, 100);
    r.clear();

    const heard: number[] = [];
    for (let i = 0; i < 6; i++) { r.m.tick(); r.advance(40); }
    for (const e of r.ons()) heard.push(e.pitch);
    check('it cycles the held notes in order', heard.length === 6, `${heard}`);
    check('and repeats them', heard.slice(0, 3).join() === heard.slice(3, 6).join(), `${heard}`);
    check('every note in the chord is heard',
      [60, 64, 67].every(p => heard.includes(p)), `${heard}`);
  }
  {
    const r = rig({ arpOn: true, baseArpSpeedMs: 40, curveEnabled: false });
    r.m.noteOn(60, 100);
    r.m.noteOn(64, 100);
    r.clear();
    r.m.tick();
    check('nothing before the interval is up', r.ons().length === 1, 'first is due immediately');
    r.clear();
    r.advance(20); r.m.tick();
    check('a tick too early plays nothing', r.ons().length === 0);
    r.advance(20); r.m.tick();
    check('and one on time plays', r.ons().length === 1);
  }
  {
    const r = rig({ arpOn: true, curveEnabled: false });
    r.m.noteOn(60, 100); r.m.noteOn(64, 100);
    r.advance(40); r.m.tick();
    r.clear();
    r.m.noteOff(64);
    check('down to one note it stops arpeggiating and holds',
      r.ons().length === 1 && r.ons()[0].pitch === 60, `${JSON.stringify(r.ons())}`);
  }

  console.log('\n=== Curve ===');
  {
    const r = rig({ arpOn: true, baseArpSpeedMs: 100, curveEnabled: true, arpCurveAmount: 100, curveDelayMs: 0, gapMs: 0 });
    r.m.noteOn(60, 100); r.m.noteOn(64, 100);
    const gaps: number[] = [];
    let last = r.now();
    for (let i = 0; i < 400; i++) {
      const before = r.ons().length;
      r.m.tick();
      if (r.ons().length > before) { gaps.push(r.now() - last); last = r.now(); }
      r.advance(2);
    }
    // Each step multiplies the interval by 0.9, so later notes come sooner.
    // gaps[0] is 0 — the first note of a chord is due immediately.
    check('the arp accelerates', gaps.length > 6 && gaps[gaps.length - 1] < gaps[1],
      `${gaps.slice(0, 6)} … ${gaps.slice(-3)}`);
    check('and bottoms out rather than running away',
      gaps[gaps.length - 1] >= 10, `${gaps[gaps.length - 1]}`);
  }
  {
    const r = rig({ arpOn: true, baseArpSpeedMs: 100, curveEnabled: true, arpCurveAmount: -100, curveDelayMs: 0 });
    r.m.noteOn(60, 100); r.m.noteOn(64, 100);
    for (let i = 0; i < 200; i++) { r.m.tick(); r.advance(20); }
    check('a negative amount slows it instead', (r.m as any).dynamicSpeedMs > 100,
      `${(r.m as any).dynamicSpeedMs}`);
  }
  {
    const r = rig({ arpOn: true, baseArpSpeedMs: 100, curveEnabled: true, arpCurveAmount: 100, curveDelayMs: 0, foldbackEnabled: true });
    r.m.noteOn(60, 100); r.m.noteOn(64, 100);
    for (let i = 0; i < 60; i++) { r.m.tick(); r.advance(10); }
    const speed = (r.m as any).dynamicSpeedMs;
    check('foldback turns it round at the floor rather than pinning it',
      speed >= 25, `${speed}`);
  }
  {
    const r = rig({ arpOn: true, baseArpSpeedMs: 100, curveEnabled: true, arpCurveAmount: 100, curveDelayMs: 5000 });
    r.m.noteOn(60, 100); r.m.noteOn(64, 100);
    for (let i = 0; i < 10; i++) { r.m.tick(); r.advance(100); }
    check('the delay holds the speed steady until it has passed',
      (r.m as any).dynamicSpeedMs === 100, `${(r.m as any).dynamicSpeedMs}`);
  }
  {
    const r = rig({ arpOn: true, baseArpSpeedMs: 100, curveEnabled: true, arpCurveAmount: 100, curveDelayMs: 0 });
    r.m.noteOn(60, 100); r.m.noteOn(64, 100);
    for (let i = 0; i < 30; i++) { r.m.tick(); r.advance(50); }
    const fast = (r.m as any).dynamicSpeedMs;
    r.m.noteOn(67, 100);
    check('a new note resets the curve to the base speed',
      (r.m as any).dynamicSpeedMs === 100, `was ${fast}, now ${(r.m as any).dynamicSpeedMs}`);
  }

  console.log('\n=== Lowest note bias ===');
  {
    const r = rig({ arpOn: true, lowestNoteBiasEnabled: true, lowestNoteProb: 100, curveEnabled: false, gapMs: 0 });
    r.m.noteOn(48, 100); r.m.noteOn(60, 100); r.m.noteOn(64, 100);
    r.clear();
    for (let i = 0; i < 5; i++) { r.m.tick(); r.advance(40); }
    check('at 100% every note is the lowest',
      r.ons().length > 0 && r.ons().every(e => e.pitch === 48), `${r.ons().map(e => e.pitch)}`);
  }
  {
    // The bug this port fixes: at full bias the same pitch comes round twice,
    // and the original's trailing safety note-off landed 2ms after the note-on
    // that followed it, choking the note.
    const r = rig({ arpOn: true, lowestNoteBiasEnabled: true, lowestNoteProb: 100, curveEnabled: false, gapMs: 10, baseArpSpeedMs: 60 });
    r.m.noteOn(48, 100); r.m.noteOn(60, 100);
    r.clear();
    r.m.tick(); r.advance(60);
    r.m.tick();
    const on = r.ons().find(e => e.pitch === 48);
    const choking = r.offs().find(e => e.pitch === 48 && e.delay > 0 && on && e.delay > on.delay);
    check('a repeated note is not cut off by its own safety note-off',
      !choking, `${JSON.stringify(r.out)}`);
  }
  {
    const r = rig({ arpOn: true, lowestNoteBiasEnabled: true, lowestNoteProb: 0, curveEnabled: false, gapMs: 0 });
    r.m.noteOn(48, 100); r.m.noteOn(60, 100); r.m.noteOn(64, 100);
    r.clear();
    for (let i = 0; i < 6; i++) { r.m.tick(); r.advance(40); }
    check('at 0% the bass is never picked',
      r.ons().length > 0 && r.ons().every(e => e.pitch !== 48), `${r.ons().map(e => e.pitch)}`);
  }

  console.log('\n=== Housekeeping ===');
  {
    const r = rig({ arpOn: false });
    r.m.noteOn(60, 100);
    r.clear();
    r.m.reset();
    check('reset releases what was sounding', r.offs().some(e => e.pitch === 60));
    check('and forgets the buffer', r.m.heldCount === 0);
    check('and nothing is sounding', r.m.isSounding === false);
  }
  {
    const r = rig({ arpOn: false });
    r.m.noteOn(60, 100);
    r.m.noteOn(60, 90);
    check('a repeated pitch does not enter the buffer twice', r.m.heldCount === 1, `${r.m.heldCount}`);
  }
  {
    const r = rig({ arpOn: false });
    r.m.noteOff(60);
    check('a note-off for something never held is ignored', r.out.length === 0);
  }
  {
    const r = rig({ arpOn: false });
    r.m.noteOn(60, 100, 0, 7);
    check('the sounding channel is remembered for pitch bend routing',
      r.m.soundingOnChannel === 7, `${r.m.soundingOnChannel}`);
  }
  {
    const r = rig({ arpOn: false, maxNotes: 1 });
    [60, 64, 67].forEach(p => r.m.noteOn(p, 100));
    check('a buffer of one still works', r.m.heldCount === 1);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
