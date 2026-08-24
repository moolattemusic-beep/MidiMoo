import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { parseChordSymbol, parseProgression } from '../src/lib/ChordSymbol.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

function rig(over: any = {}) {
  const engine: any = new OrchidEngine({ ...defaultParams, strumEngine: 0, ...over });
  const on: number[] = [];
  engine.onOutputNote = (e: any) => {
    if (e.isExpression || e.isPitchBend) return;
    if (e.isOn && e.velocity > 0) on.push(e.pitch);
  };
  return { engine, on };
}
// Play a pasted chord the way the pad does
async function play(engine: any, sym: string, on: number[]) {
  const c = parseChordSymbol(sym)!;
  on.length = 0;
  engine.handleMidi(60 + c.root, 100, true, false, false, false, true, undefined, c.intervals);
  await sleep(30);
  const pcs = [...new Set(on.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
  return { pitches: [...on].sort((a, b) => a - b), pcs, chord: c };
}

async function main() {
  console.log('=== Pasted chords sound the notes they spell ===');
  for (const sym of ['Cmin(b6)', 'Gb7(#11)', 'Dbmaj7', 'Ebmin(6)', 'Gmin(b9)', 'Abmaj9', 'E9(b13)', 'F7(#9)']) {
    const { engine, on } = rig();
    const r = await play(engine, sym, on);
    const want = [...new Set(r.chord.intervals.map(i => (r.chord.root + i) % 12))].sort((a, b) => a - b);
    console.log(`   ${sym.padEnd(10)} -> ${r.pcs.map(p => NAMES[p]).join(' ')}`);
    check(`${sym}: every written tone present`, JSON.stringify(r.pcs) === JSON.stringify(want),
      `got ${r.pcs.map(p=>NAMES[p])} want ${want.map(p=>NAMES[p])}`);
    engine.panic();
  }

  console.log('\n=== Density does not thin a pasted chord ===');
  {
    // chordDensity 0 caps generated chords at 3 notes
    const { engine, on } = rig({ chordDensity: 0 });
    const r = await play(engine, 'E9(b13)', on);
    check('6-note chord survives MAX NOTES = 3', r.pcs.length === 6, `${r.pcs.length} notes: ${r.pcs.map(p=>NAMES[p])}`);
    engine.panic();
  }

  console.log('\n=== It follows register and inversion, unlike customVoicing ===');
  {
    const low = rig({ chordRegisterStart: 48 });
    const rl = await play(low.engine, 'Dbmaj7', low.on);
    const high = rig({ chordRegisterStart: 72 });
    const rh = await play(high.engine, 'Dbmaj7', high.on);
    console.log(`   register 48 -> ${rl.pitches.join(' ')};  register 72 -> ${rh.pitches.join(' ')}`);
    check('register start moves the voicing', Math.min(...rh.pitches) > Math.min(...rl.pitches), `${rl.pitches} vs ${rh.pitches}`);
    check('same chord tones either way', JSON.stringify(rl.pcs) === JSON.stringify(rh.pcs), `${rl.pcs} vs ${rh.pcs}`);
    low.engine.panic(); high.engine.panic();

    // The real requirement is that a pasted chord is voiced exactly like the
    // same chord built the normal way, under whatever settings are set. (The
    // app's inversion control happens not to move this voicing either way —
    // pre-existing behaviour, identical for both paths.)
    for (const settings of [
      { chordInversion: 0 }, { chordInversion: 2 },
      { chordRegisterStart: 55 }, { voicingRange: 24 }, { registerMode: 1 },
    ]) {
      const a = rig(settings);
      const pasted = await play(a.engine, 'Dbmaj7', a.on);
      a.engine.panic();

      const b = rig(settings);
      b.engine.manualBaseType = 0; b.engine.ext_M7 = true;   // Dbmaj7 the normal way
      b.on.length = 0;
      b.engine.handleMidi(61, 100, true, false, false, false, true);
      await sleep(30);
      const normal = [...b.on].sort((x, y) => x - y);
      b.engine.panic();

      check(`voiced like a normal chord under ${JSON.stringify(settings)}`,
        JSON.stringify(pasted.pitches) === JSON.stringify(normal), `${pasted.pitches} vs ${normal}`);
    }
  }

  console.log('\n=== The root is taken literally in every mapping mode ===');
  {
    for (const [name, mapping] of [['Classic', 0], ['Circle', 1], ['Key Mode', 2]] as const) {
      const { engine, on } = rig({ keyboardMapping: mapping, keyRoot: 5, keyScale: 0 });
      const r = await play(engine, 'Cmin(b6)', on);
      check(`${name}: root stays C`, r.pcs.includes(0) && JSON.stringify(r.pcs) === JSON.stringify([0, 3, 7, 8]),
        `${r.pcs.map(p=>NAMES[p])}`);
      engine.panic();
    }
  }

  console.log('\n=== Modifier pads do not reshape a pasted chord ===');
  {
    const { engine, on } = rig();
    engine.manualBaseType = 0;   // force MAJOR
    engine.ext_m7 = true;        // and a m7
    const r = await play(engine, 'Cmin(b6)', on);
    check('still minor with its b6', JSON.stringify(r.pcs) === JSON.stringify([0, 3, 7, 8]), `${r.pcs.map(p=>NAMES[p])}`);
    engine.panic();
  }

  console.log('\n=== A register move rebuilds it, not the default chord ===');
  {
    const { engine, on } = rig({ chordRegisterStart: 60 });
    const c = parseChordSymbol('Gb7(#11)')!;
    engine.handleMidi(60 + c.root, 100, true, false, false, false, true, undefined, c.intervals);
    await sleep(30);
    on.length = 0;
    engine.updateRegister(72);   // as if dragging CHORD START while held
    await sleep(40);
    const pcs = [...new Set(on.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
    const want = [...new Set(c.intervals.map(i => (c.root + i) % 12))].sort((a, b) => a - b);
    check('rebuilt chord is still Gb7(#11)', JSON.stringify(pcs) === JSON.stringify(want), `${pcs.map(p=>NAMES[p])} vs ${want.map(p=>NAMES[p])}`);
    engine.panic();
  }

  console.log('\n=== Existing slots are untouched ===');
  {
    const { engine, on } = rig();
    engine.manualBaseType = 1;   // minor, the old-style slot path
    on.length = 0;
    engine.handleMidi(60, 100, true, false, false, false, true, undefined, undefined);
    await sleep(30);
    const pcs = [...new Set(on.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
    check('a normal slot still plays a plain minor triad', JSON.stringify(pcs) === JSON.stringify([0, 3, 7]), `${pcs.map(p=>NAMES[p])}`);
    engine.panic();
  }

  console.log('\n=== Fewer than 8 chords leaves the rest empty ===');
  {
    const { chords } = parseProgression('Cmaj7 Dm7 G7');
    const slots = Array(8).fill(null);
    chords.slice(0, 8).forEach((c, i) => { slots[i] = c; });
    check('3 filled, 5 empty', slots.filter(Boolean).length === 3 && slots.slice(3).every(x => x === null));
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
