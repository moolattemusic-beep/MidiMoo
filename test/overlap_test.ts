import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const same = (a: number[], b: number[]) =>
  [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();

// The engine voices, registers and folds what it is given, so a test cannot
// assume the notes it passed in are the notes that sound. Every assertion here
// is made against what actually came out.
const rig = (over: any = {}) => {
  const e = new OrchidEngine({
    ...defaultParams, mpeEnabled: false, strumEnabled: false, autoBassRegister: 0, ...over,
  });
  const on: number[] = [], off: number[] = [];
  // Ordered, so a test can ask what the last thing to happen to a note was.
  const events: Array<{ pitch: number; isOn: boolean }> = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isPitchBend || ev.isCC) return;
    (ev.isOn ? on : off).push(ev.pitch);
    events.push({ pitch: ev.pitch, isOn: ev.isOn });
  };
  return { e, on, off, events };
};
const press = (e: any, root: number, v: number[]) => e.handleMidi(root, 100, true, false, false, false, true, v, undefined);
const lift = (e: any, root: number, v: number[]) => e.handleMidi(root, 0, false, false, false, false, true, v, undefined);

const C = { root: 60, voicing: [60, 64, 67] };
const Am = { root: 57, voicing: [57, 60, 64] };   // shares tones with C
const F = { root: 65, voicing: [65, 69, 72] };

/** Press a chord and report the notes it put out. */
const playing = async (e: any, on: number[], ch: { root: number; voicing: number[] }) => {
  on.length = 0;
  press(e, ch.root, ch.voicing);
  await sleep(80);
  return [...on];
};

(async () => {
  console.log('\n=== A released chord does not take notes from a held one ===');
  {
    const { e, on, off } = rig();
    const first = await playing(e, on, C);
    const second = await playing(e, on, Am);
    const shared = first.filter(p => second.includes(p));
    check('the two chords do share notes', shared.length > 0, `${first} / ${second}`);

    off.length = 0;
    lift(e, C.root, C.voicing); await sleep(80);
    check('nothing the held chord is sounding is released',
      off.every(p => !second.includes(p)), `released ${off}, held ${second}`);
    check('what only the released chord held does go',
      same(off, first.filter(p => !second.includes(p))), `${off}`);

    lift(e, Am.root, Am.voicing); await sleep(80);
    check('the last chord out releases the shared notes',
      shared.every(p => off.includes(p)), `${off}`);
    e.panic(); await sleep(40);
  }
  {
    // Order must not matter: letting go of the newer chord first is the same
    // question asked the other way round.
    const { e, on, off } = rig();
    const first = await playing(e, on, C);
    const second = await playing(e, on, Am);

    off.length = 0;
    lift(e, Am.root, Am.voicing); await sleep(80);
    check('releasing the newer chord keeps the older one',
      off.every(p => !first.includes(p)), `released ${off}, held ${first}`);

    lift(e, C.root, C.voicing); await sleep(80);
    check('the older one then releases in full',
      first.every(p => off.includes(p)), `${off}`);
    e.panic(); await sleep(40);
  }
  {
    // Chords sharing nothing were never affected; guard that they still are not.
    const { e, on, off } = rig();
    const first = await playing(e, on, C);
    await playing(e, on, F);
    off.length = 0;
    lift(e, C.root, C.voicing); await sleep(80);
    check('disjoint chords release their own notes in full', same(off, first), `${off} vs ${first}`);
    e.panic(); await sleep(40);
  }
  {
    // Three deep, so this tests a count and not a boolean.
    const { e, on, off } = rig();
    const a = await playing(e, on, C);
    const b = await playing(e, on, Am);
    const c = await playing(e, on, F);
    const inAll = a.filter(p => b.includes(p) && c.includes(p));

    off.length = 0;
    lift(e, C.root, C.voicing); await sleep(70);
    check('a note held by all three survives one release',
      inAll.every(p => !off.includes(p)), `${off} / shared ${inAll}`);
    lift(e, Am.root, Am.voicing); await sleep(70);
    check('and survives the second',
      inAll.every(p => !off.includes(p)), `${off} / shared ${inAll}`);
    lift(e, F.root, F.voicing); await sleep(70);
    check('and goes with the third', inAll.every(p => off.includes(p)), `${off}`);
    e.panic(); await sleep(40);
  }

  console.log('\n=== Nothing is left sounding ===');
  {
    const { e, on, off, events } = rig();
    press(e, C.root, C.voicing); await sleep(60);
    press(e, Am.root, Am.voicing); await sleep(60);
    press(e, F.root, F.voicing); await sleep(60);
    lift(e, Am.root, Am.voicing); await sleep(60);
    lift(e, F.root, F.voicing); await sleep(60);
    lift(e, C.root, C.voicing); await sleep(140);
    const stuck = [...new Set(on)].filter(p =>
      events.filter(ev => ev.pitch === p).slice(-1)[0]?.isOn);
    check('no note is left sounding', stuck.length === 0, `${stuck}`);
    check('and every note did get released at least once',
      [...new Set(on)].every(p => off.includes(p)), `${on} / ${off}`);
    e.panic(); await sleep(40);
  }
  {
    // Overlapping and releasing repeatedly must not drift the count and strand
    // a note that nothing is holding any more.
    const { e, on, off, events } = rig();
    for (let i = 0; i < 6; i++) {
      press(e, C.root, C.voicing); await sleep(40);
      press(e, Am.root, Am.voicing); await sleep(40);
      lift(e, C.root, C.voicing); await sleep(40);
      lift(e, Am.root, Am.voicing); await sleep(40);
    }
    await sleep(100);
    const stuck = [...new Set(on)].filter(p =>
      events.filter(ev => ev.pitch === p).slice(-1)[0]?.isOn);
    check('six overlapping presses leave nothing sounding', stuck.length === 0, `${stuck}`);
    e.panic(); await sleep(40);
  }
  {
    // With MPE every note has a channel to itself, so two chords never share a
    // (channel, pitch) and the counting has nothing to do. That is why this
    // only ever went wrong with MPE off.
    const e = new OrchidEngine({ ...defaultParams, mpeEnabled: true, mpeGlideMode: 0, autoBassRegister: 0 });
    const seen: Array<{ pitch: number; ch: number }> = [];
    e.onOutputNote = (ev: any) => {
      if (ev.isPitchBend || ev.isCC || !ev.isOn) return;
      seen.push({ pitch: ev.pitch, ch: ev.mpeChannel });
    };
    press(e, C.root, C.voicing); await sleep(80);
    const firstCount = seen.length;
    press(e, Am.root, Am.voicing); await sleep(80);
    const first = seen.slice(0, firstCount), second = seen.slice(firstCount);
    const collision = first.some(a => second.some(b => a.pitch === b.pitch && a.ch === b.ch));
    check('no two notes share a channel and a pitch', !collision,
      `${JSON.stringify(first)} / ${JSON.stringify(second)}`);
    check('and the channels really are per note',
      new Set(first.map(x => x.ch)).size === first.length, `${first.map(x => x.ch)}`);
    e.panic(); await sleep(40);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
