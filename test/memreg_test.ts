import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log('  PASS ', name); }
  else { fail++; console.log('  FAIL ', name, detail); }
};

const mk = (over: any = {}) => {
  const params = { ...defaultParams, ...over };
  const e = new OrchidEngine(params);
  const on: number[] = [];
  e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) on.push(ev.pitch); };
  return { e, on, params };
};

// C3 E3 G3 B3
const SAVED = [48, 52, 55, 59];
// The strum engine spreads a chord over time, so the notes arrive across
// several timer ticks rather than all at once.
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const play = async (start: number, over: any = {}) => {
  const { e, on } = mk({ chordRegisterStart: start, strumEngine: 0, ...over });
  e.handleMidi(48, 100, true, false, false, false, true, SAVED);
  await sleep(120);
  return on.slice().sort((a, b) => a - b);
};

(async () => {
console.log('\n=== Saved voicing walks its inversions with CHORD START ===');
const p48 = await play(48);
check('at the saved register, unchanged', JSON.stringify(p48) === JSON.stringify([48, 52, 55, 59]), JSON.stringify(p48));
const p52 = await play(52);
check('start on E3 gives first inversion', JSON.stringify(p52) === JSON.stringify([52, 55, 59, 60]), JSON.stringify(p52));
const p55 = await play(55);
check('start on G3 gives second inversion', JSON.stringify(p55) === JSON.stringify([55, 59, 60, 64]), JSON.stringify(p55));
const p60 = await play(60);
check('start an octave up moves the whole voicing', JSON.stringify(p60) === JSON.stringify([60, 64, 67, 71]), JSON.stringify(p60));

console.log('\n=== Content is preserved, never thinned ===');
{
  let allFour = true;
  for (const start of [48, 50, 52, 55, 58, 60, 64]) {
    const out = await play(start);
    if (out.length !== 4) { allFour = false; check(`four notes at start ${start}`, false, JSON.stringify(out)); }
  }
  check('always four notes, whatever the register', allFour);
  const classes = (a: number[]) => [...new Set(a.map(n => n % 12))].sort((x, y) => x - y);
  let sameClasses = true;
  for (const st of [48, 52, 55, 60]) {
    if (JSON.stringify(classes(await play(st))) !== JSON.stringify(classes(SAVED))) sameClasses = false;
  }
  check('same pitch classes throughout', sameClasses);
}

console.log('\n=== A wide voicing keeps its spread above the start ===');
{
  const wide = [36, 55, 64, 75]; // spanning three octaves
  const { e, on } = mk({ chordRegisterStart: 48, strumEngine: 0 });
  e.handleMidi(36, 100, true, false, false, false, true, wide);
  await sleep(120);
  const out = on.slice().sort((a, b) => a - b);
  check('only the note below the start moved', JSON.stringify(out) === JSON.stringify([48, 55, 64, 75]), JSON.stringify(out));
}

console.log('\n=== Frozen when the toggle is off ===');
const frozen = await play(64, { memoryFollowRegister: false });
check('exact notes kept', JSON.stringify(frozen) === JSON.stringify(SAVED), JSON.stringify(frozen));

console.log('\n=== Dragging the slider re-voices a held chord ===');
{
  const { e, on } = mk({ chordRegisterStart: 48, strumEngine: 0 });
  e.handleMidi(48, 100, true, false, false, false, true, SAVED);
  await sleep(120);
  on.length = 0;
  e.params = { ...e.params, chordRegisterStart: 55 };
  (e as any).recalculateActiveChords();
  check('new inversion notes sounded while held', on.includes(60) && on.includes(64), JSON.stringify(on));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(0);
})();
