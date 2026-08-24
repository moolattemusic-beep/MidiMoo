import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { parseChordSymbol, parseProgression } from '../src/lib/ChordSymbol.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function rig(over: any = {}) {
  const engine: any = new OrchidEngine({ ...defaultParams, ...over });
  const on: any[] = [], off: any[] = [];
  engine.onOutputNote = (e: any) => {
    if (e.isExpression || e.isPitchBend) return;
    (e.isOn && e.velocity > 0 ? on : off).push({ pitch: e.pitch, ch: e.mpeChannel ?? 1 });
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
  console.log('=== B7(b13,#9): a comma inside parentheses is not a separator ===');
  {
    const list = 'Fmaj Gmin7 Cmin9 B7(b13,#9) E7(#9) Bb9 Ebmaj7 Dmin';
    const { chords, rejected } = parseProgression(list);
    check('all 8 chords parse', chords.length === 8 && rejected.length === 0, `${chords.length}, rejected ${JSON.stringify(rejected)}`);
    check('B7(b13,#9) kept whole', chords.some(c => c.symbol === 'B7(b13,#9)'), `${chords.map(c => c.symbol)}`);
    const b7 = chords.find(c => c.symbol === 'B7(b13,#9)')!;
    check('with both alterations', JSON.stringify(b7.intervals) === JSON.stringify([0, 4, 7, 10, 15, 20]), `${b7?.intervals}`);
    console.log('   ', chords.map(c => c.symbol).join('  '));
  }
  {
    // Commas must still separate chords when they are outside parentheses.
    const r = parseProgression('Cmaj7, Dm7, G7');
    check('top-level commas still split', r.chords.length === 3, `${r.chords.length}`);
    const m = parseProgression('C7(b9,#11), Dm7(b5) | G7(#9,b13)');
    check('mixed separators and multi-alterations', m.chords.length === 3 && m.rejected.length === 0,
      `${m.chords.map(c => c.symbol)} rejected ${m.rejected}`);
  }

  console.log('\n=== Free mode: memory pads survive a CHORD START drag ===');
  for (const [label, mapping] of [['Key Mode', 2], ['Free Mode', 3], ['Classic', 0]] as const) {
    const { engine, on, off } = rig({ keyboardMapping: mapping, strumEngine: 0 });
    const c = parseChordSymbol('Cmin9')!;
    // Hold a memory pad
    engine.handleMidi(60 + c.root, 100, true, false, false, false, true, undefined, c.intervals);
    await sleep(30);
    const heldAfterPress = on.length;

    // Drag the slider while it is held
    for (let v = 60; v <= 80; v++) { engine.updateRegister(v); await sleep(5); }
    for (let v = 80; v >= 52; v--) { engine.updateRegister(v); await sleep(5); }
    await sleep(200);

    // Release the pad
    engine.handleMidi(60 + c.root, 0, false, false, false, false, true, undefined, c.intervals);
    await sleep(200);

    const d = dangling(on, off);
    check(`${label}: no hanging notes`, d.length === 0, `hanging=${JSON.stringify(d)}`);
    const mem = Object.values(engine.activePitchesMemory).flat().length;
    check(`${label}: engine memory empty`, mem === 0, `${mem} entries`);
    check(`${label}: the chord actually played`, heldAfterPress >= 3, `${heldAfterPress} notes`);
    engine.panic();
  }

  console.log('\n=== Free mode: the pad still plays a chord, not one note ===');
  {
    const { engine, on } = rig({ keyboardMapping: 3, strumEngine: 0 });
    const c = parseChordSymbol('Cmin9')!;
    engine.handleMidi(60 + c.root, 100, true, false, false, false, true, undefined, c.intervals);
    await sleep(30);
    const pcs = [...new Set(on.map(n => n.pitch % 12))].sort((a, b) => a - b);
    check('all 5 chord tones sound in Free mode', pcs.length === 5, `${pcs.length}: ${pcs}`);
    on.length = 0;
    engine.updateRegister(70);
    await sleep(60);
    const after = [...new Set(on.map(n => n.pitch % 12))].sort((a, b) => a - b);
    check('still the same chord after a register move', JSON.stringify(after) === JSON.stringify(pcs), `${after} vs ${pcs}`);
    engine.panic();
  }

  console.log('\n=== Free mode keys played directly are unaffected ===');
  {
    const { engine, on, off } = rig({ keyboardMapping: 3, strumEngine: 0 });
    engine.handleMidi(60, 100, true);          // a plain free-mode note
    await sleep(30);
    check('one note only', on.length === 1, `${on.length}`);
    engine.handleMidi(60, 0, false);
    await sleep(60);
    check('released cleanly', dangling(on, off).length === 0, `${JSON.stringify(dangling(on, off))}`);
    engine.panic();
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
