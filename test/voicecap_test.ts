import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { parseChordSymbol } from '../src/lib/ChordSymbol.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

function rig(over: any = {}) {
  const engine: any = new OrchidEngine({ ...defaultParams, strumEngine: 0, ...over });
  const on: number[] = [];
  engine.onOutputNote = (e: any) => { if (!e.isExpression && !e.isPitchBend && e.isOn && e.velocity > 0) on.push(e.pitch); };
  return { engine, on };
}
async function playPad(engine: any, on: number[], sym: string) {
  const c = parseChordSymbol(sym)!;
  on.length = 0;
  engine.handleMidi(60 + c.root, 100, true, false, false, false, true, undefined, c.intervals);
  await sleep(30);
  const rel = [...new Set(on.map(p => (((p % 12) - c.root) + 24) % 12))].sort((a, b) => a - b);
  return { count: new Set(on.map(p => p % 12)).size, degrees: rel, pcs: [...new Set(on.map(p => p % 12))].sort((a,b)=>a-b) };
}

async function main() {
  console.log('=== MAX VOICES caps memory chords when MPE glide is on ===');
  for (const max of [3, 4, 5, 6]) {
    const { engine, on } = rig({ mpeEnabled: true, mpeMaxVoices: max });
    const r = await playPad(engine, on, 'B7(b13,#9)');   // 6 tones written
    console.log(`   max ${max}: ${r.count} notes -> degrees [${r.degrees.join(', ')}]`);
    check(`max ${max}: exactly ${max} notes`, r.count === max, `${r.count}`);
    engine.panic();
  }

  console.log('\n=== The 5th goes before the alterations ===');
  {
    const { engine, on } = rig({ mpeEnabled: true, mpeMaxVoices: 4 });
    const r = await playPad(engine, on, 'B7(b13,#9)');   // [0,4,7,10,15,20]
    check('root kept', r.degrees.includes(0), `${r.degrees}`);
    check('3rd kept', r.degrees.includes(4), `${r.degrees}`);
    check('7th kept', r.degrees.includes(10), `${r.degrees}`);
    check('5th dropped', !r.degrees.includes(7), `${r.degrees}`);
    check('an alteration survived', r.degrees.includes(3) || r.degrees.includes(8), `${r.degrees} (#9 = 3, b13 = 8 as pitch classes)`);
    engine.panic();
  }

  console.log('\n=== Off when MPE glide is off ===');
  {
    const { engine, on } = rig({ mpeEnabled: false, mpeMaxVoices: 3 });
    const r = await playPad(engine, on, 'B7(b13,#9)');
    check('all 6 tones still play', r.count === 6, `${r.count}`);
    engine.panic();
  }

  console.log('\n=== Played chords are untouched by MAX VOICES ===');
  {
    const { engine, on } = rig({ mpeEnabled: true, mpeMaxVoices: 2 });
    engine.manualBaseType = 0; engine.ext_M7 = true;
    on.length = 0;
    engine.handleMidi(60, 100, true);          // a performance key, not a pad
    await sleep(30);
    const count = new Set(on.map(p => p % 12)).size;
    check('performance key ignores MAX VOICES', count > 2, `${count} notes`);
    engine.panic();
  }

  console.log('\n=== Ordinary saved slots are capped too ===');
  {
    const { engine, on } = rig({ mpeEnabled: true, mpeMaxVoices: 3 });
    engine.manualBaseType = 0; engine.ext_M7 = true; engine.ext_9 = true;
    on.length = 0;
    engine.handleMidi(60, 100, true, false, false, false, true);   // memory trigger, no intervals
    await sleep(30);
    check('capped to 3', new Set(on.map(p => p % 12)).size === 3, `${new Set(on.map(p => p % 12)).size}`);
    engine.panic();
  }

  console.log('\n=== A register drag keeps the cap ===');
  {
    const { engine, on } = rig({ mpeEnabled: true, mpeMaxVoices: 4 });
    const c = parseChordSymbol('B7(b13,#9)')!;
    engine.handleMidi(60 + c.root, 100, true, false, false, false, true, undefined, c.intervals);
    await sleep(30);
    on.length = 0;
    engine.updateRegister(70);
    await sleep(60);
    engine.handleMidi(60 + c.root, 0, false, false, false, false, true, undefined, c.intervals);
    await sleep(60);
    const live = Object.values(engine.activePitchesMemory).flat().length;
    check('nothing left ringing after release', live === 0, `${live}`);
    engine.panic();
  }

  console.log('\n=== Simple triads are not mangled ===');
  {
    const { engine, on } = rig({ mpeEnabled: true, mpeMaxVoices: 8 });
    const r = await playPad(engine, on, 'Fmaj');
    check('major triad intact at a high cap', JSON.stringify(r.degrees) === JSON.stringify([0, 4, 7]), `${r.degrees}`);
    engine.panic();
  }
  {
    const { engine, on } = rig({ mpeEnabled: true, mpeMaxVoices: 2 });
    const r = await playPad(engine, on, 'Fmaj');
    check('triad at 2 voices keeps root and 3rd', JSON.stringify(r.degrees) === JSON.stringify([0, 4]), `${r.degrees}`);
    engine.panic();
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
