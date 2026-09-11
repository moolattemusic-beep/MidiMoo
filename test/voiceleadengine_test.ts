import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { parseChordSymbol } from '../src/lib/ChordSymbol.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

/** A pad as RNDM and the text field write one. */
const slot = (symbol: string) => {
  const parsed = parseChordSymbol(symbol)!;
  return {
    rootPitch: 60 + parsed.root, baseType: -1,
    ext_m7: false, ext_M7: false, ext_6: false, ext_9: false,
    symbol, chordIntervals: parsed.intervals,
  };
};

// Triads and sevenths mixed, as RNDM writes them. The mix is the point: the
// library can state a triad exactly and voices it wide, while a pasted seventh
// whose library shapes all add a tone is refused and built compactly instead — so
// a progression flips between the two, and that is where the top jumps come from.
const ROW = ['C', 'Am7', 'F', 'G7', 'Em', 'Dm7', 'Am', 'E7'].map(slot);

function rig(overrides: Record<string, unknown> = {}) {
  const e = new OrchidEngine({
    ...defaultParams,
    mpeEnabled: false, strumEngine: 0, autoBassRegister: 0, inversionRepeat: 0,
    chordRegisterStart: 48, outputRangeLow: 24, outputRangeHigh: 108,
    voicingPlayed: true, voiceLeadEnabled: true, voiceLeadScope: 'pads', voiceLeadMode: 'topLine',
    ...overrides,
  } as any);
  e.setPadSlots(ROW);
  const heard: number[] = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isCC || ev.isExpression || ev.isPitchBend) return;
    if (ev.isOn && ev.velocity > 0) heard.push(ev.pitch);
  };
  /** Press a pad as the pad press does, and hand back what it sounded. */
  const press = (index: number, withIndex = true) => {
    heard.length = 0;
    const s = ROW[index];
    e.handleMidi(s.rootPitch, 100, true, false, false, false, true, undefined, s.chordIntervals,
      withIndex ? index : undefined);
    const notes = [...heard].sort((a, b) => a - b);
    e.handleMidi(s.rootPitch, 0, false, false, false, false, true, undefined, s.chordIntervals);
    return notes;
  };
  return { e, press };
}

const top = (v: number[]) => Math.max(...v);
const worstTopJump = (chords: number[][]) =>
  Math.max(...chords.slice(1).map((c, i) => Math.abs(top(c) - top(chords[i]))));

console.log('\n=== The pads, played in order, before and after ===');
{
  const off = rig({ voiceLeadEnabled: false });
  const on = rig();
  const before = ROW.map((_, i) => off.press(i));
  const after = ROW.map((_, i) => on.press(i));
  console.log(`     tops unled ${before.map(top).join(' ')}   worst jump ${worstTopJump(before)}`);
  console.log(`     tops led   ${after.map(top).join(' ')}   worst jump ${worstTopJump(after)}`);
  check('every pad still sounds a chord', after.every(c => c.length >= 3), after.map(c => c.length).join(','));
  check('the led top line never jumps more than a fourth', worstTopJump(after) <= 5, `${worstTopJump(after)}`);
  // The improvement itself is measured across the whole preset library in
  // voiceleadpresets_test; one row can only promise never to make it worse.
  check('and it is never worse than the pads are today', worstTopJump(after) <= Math.max(5, worstTopJump(before)),
    `${worstTopJump(after)} vs ${worstTopJump(before)}`);
  // Placement only: the led pad plays the same chord, just somewhere else.
  const pcs = (v: number[]) => [...new Set(v.map(p => p % 12))].sort((a, b) => a - b).join();
  check('every led pad is the same chord it was', after.every((c, i) => pcs(c) === pcs(before[i])));
}

console.log('\n=== A pad always sounds the same ===');
{
  const { press } = rig();
  ROW.forEach((_, i) => press(i));
  const first = press(4).join();
  press(1); press(6);
  check('pressing a pad again, after others, gives the same voicing', press(4).join() === first, first);
}

console.log('\n=== PAD ORDER does not depend on the order they are pressed ===');
{
  const inOrder = rig();
  const reference = ROW.map((_, i) => inOrder.press(i).join());
  const scrambled = rig();
  const order = [5, 2, 7, 0, 3, 6, 1, 4];
  const got: string[] = [];
  for (const i of order) got[i] = scrambled.press(i).join();
  check('each pad sounds as it does when the row is played through', got.every((g, i) => g === reference[i]));
}

console.log('\n=== AS PLAYED leads from whatever sounded last ===');
{
  const { press } = rig({ voiceLeadScope: 'played' });
  const order = [0, 4, 2, 7, 1, 6, 3, 5];
  const heard = order.map(i => press(i));
  check('the top line is smooth in the order it was played', worstTopJump(heard) <= 5,
    `tops ${heard.map(top).join(' ')}`);
}

console.log('\n=== INVERSION re-seeds the line ===');
{
  const a = rig();
  const plain = ROW.map((_, i) => a.press(i));
  const b = rig({ chordInversion: 1 });
  const turned = ROW.map((_, i) => b.press(i));
  check('the first pad moves with the inversion', turned[0].join() !== plain[0].join(),
    `${plain[0].join()} vs ${turned[0].join()}`);
  check('and the line after it still leads smoothly', worstTopJump(turned) <= 5,
    `tops ${turned.map(top).join(' ')}`);
}
{
  // AS PLAYED: the next pad after INVERSION changes starts afresh from it.
  const { e, press } = rig({ voiceLeadScope: 'played' });
  press(0); press(1);
  const before = press(2);
  e.params = { ...e.params, chordInversion: 2 };
  const reseeded = press(3);
  const fresh = rig({ voiceLeadScope: 'played', chordInversion: 2 });
  check('the next pad is voiced afresh at the new inversion', reseeded.join() === fresh.press(3).join(),
    `${reseeded.join()} vs ${fresh.press(3).join()} (was ${before.join()})`);
}

console.log('\n=== ANCHOR ===');
{
  const { press } = rig({ voiceLeadMode: 'anchor', voiceLeadAnchor: 67 });
  const heard = ROW.map((_, i) => press(i));
  const far = heard.map(c => Math.abs(top(c) - 67));
  check('every top note stays within a fourth of G4', Math.max(...far) <= 5, far.join(','));
}

console.log('\n=== What it must leave alone ===');
{
  // The chord grid, and any chord played without a pad, never passes a pad index.
  const on = rig();
  const off = rig({ voiceLeadEnabled: false });
  const same = ROW.every((_, i) => on.press(i, false).join() === off.press(i, false).join());
  check('a chord that is not a pad is voiced exactly as before', same);
}
{
  const { press } = rig({ outputRangeLow: 48, outputRangeHigh: 84 });
  const heard = ROW.map((_, i) => press(i));
  check('nothing leaves outside RANGE', heard.every(c => c.every(p => p >= 48 && p <= 84)),
    heard.map(c => `${Math.min(...c)}-${Math.max(...c)}`).join(' '));
}
{
  // Inversion repeat turns each chord further by a count of presses, which would
  // undo the leading; a led pad does not take it.
  const repeat = rig({ inversionRepeat: 2 });
  const steady = rig();
  const a = ROW.map((_, i) => repeat.press(i).join());
  const b = ROW.map((_, i) => steady.press(i).join());
  check('inversion repeat does not unpick a led row', a.every((v, i) => v === b[i]));
}
{
  const { e, press } = rig({ voiceLeadScope: 'played' });
  press(0); press(3);
  e.panic();
  const afterPanic = press(5);
  const fresh = rig({ voiceLeadScope: 'played' }).press(5);
  check('panic starts the line again', afterPanic.join() === fresh.join());
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
