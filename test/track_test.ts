import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function mk(over: any = {}) {
  const engine: any = new OrchidEngine({ ...defaultParams, mpeEnabled: true, keyboardMapping: 2, mpeGlideTimeMs: 150, ...over });
  const on: any[] = [], off: any[] = [], bends: any[] = [];
  engine.onOutputNote = (e: any) => {
    if (e.isExpression) return;
    if (e.isPitchBend) { bends.push({ ch: e.mpeChannel, base: e.pitch, sounding: e.pitch + (e.pitchBendValue || 0) }); return; }
    (e.isOn ? on : off).push({ pitch: e.pitch, ch: e.mpeChannel ?? 1 });
  };
  return { engine, on, off, bends };
}
const dangling = (on: any[], off: any[]) => {
  const live = new Map<string, number>();
  for (const n of on) { const k = `${n.ch}:${n.pitch}`; live.set(k, (live.get(k) || 0) + 1); }
  for (const n of off) { const k = `${n.ch}:${n.pitch}`; live.set(k, (live.get(k) || 0) - 1); }
  return [...live.entries()].filter(([, v]) => v > 0);
};

async function main() {
  console.log('=== Does the chord actually follow the slider? ===');
  {
    const { engine, bends } = mk({ strumEngine: 0 });
    engine.handleMidi(60, 100, true);
    await sleep(40);
    bends.length = 0;
    // drag from 60 up to 84, at pointer-move speed
    for (let v = 60; v <= 84; v++) { engine.updateRegister(v); await sleep(16); }
    await sleep(400); // let the last glide land
    const perCh = new Map<number, number[]>();
    for (const b of bends) {
      if (!perCh.has(b.ch)) perCh.set(b.ch, []);
      perCh.get(b.ch)!.push(b.sounding);
    }
    // Distance covered rather than start-to-finish displacement: RANGE folds a
    // voice back an octave when the slider pushes it past the edge, so a note
    // that followed the whole way can end up near where it started. What is
    // being asked here is whether it moved, not where it stopped.
    const summary = [...perCh.entries()].map(([ch, s]) => ({
      ch,
      travelled: +s.reduce((total, pitch, i) => i === 0 ? 0 : total + Math.abs(pitch - s[i - 1]), 0).toFixed(1),
      steps: s.length,
    }));
    console.log('  pitch travelled per channel:', JSON.stringify(summary));
    // A voice used to be free to sail past the top of RANGE, so it could travel
    // the slider's full two octaves. It is folded back now, which caps how far
    // any one of them can get from where it started — so what is asked is that
    // each one moved, and separately that none of them left the window. Landing
    // where the chord would have been played is covered by `glidefold`.
    check('notes actually moved with the slider', summary.every(s => Math.abs(s.travelled) > 6), JSON.stringify(summary));
    const strayed = bends.filter(b => b.sounding < engine.params.outputRangeLow - 0.01
      || b.sounding > engine.params.outputRangeHigh + 0.01);
    check('and none of them left the range on the way',
      strayed.length === 0, JSON.stringify(strayed.slice(0, 3)));
    // Gradual means small moves, not a fixed number of them: how many steps a
    // channel gets depends on how long it is part of the voicing, and a played
    // voicing reshapes as the register moves. What says it glided rather than
    // jumped is the distance covered per step.
    check('movement was gradual, not a jump',
      summary.every(s => s.steps >= 8 && Math.abs(s.travelled) / s.steps <= 3),
      JSON.stringify(summary.map(s => ({ ...s, perStep: +(Math.abs(s.travelled) / s.steps).toFixed(2) }))));
  }

  console.log('\n=== Hanging notes: many drag styles ===');
  const styles: [string, any, number, number][] = [
    ['fast drag, strum on',      { strumEngine: 1, strumSpeedMs: 40 }, 4, 1],
    ['slow drag, strum on',      { strumEngine: 1, strumSpeedMs: 40 }, 25, 1],
    ['slow strum (120ms)',       { strumEngine: 1, strumSpeedMs: 120 }, 8, 1],
    ['strum off',                { strumEngine: 0 }, 8, 1],
    ['long glide (470ms)',       { mpeGlideTimeMs: 470 }, 8, 1],
    ['with auto bass',           { autoBassRegister: 2 }, 8, 1],
    ['inversion repeat',         { inversionRepeat: 2 }, 8, 1],
    ['dense chords',             { alwaysAdd7th: true }, 8, 1],
    ['two keys held',            { strumEngine: 1 }, 8, 2],
  ];
  for (const [label, opts, gap, keys] of styles) {
    const { engine, on, off } = mk(opts);
    const held = keys === 2 ? [60, 64] : [60];
    for (const k of held) engine.handleMidi(k, 100, true);
    await sleep(30);
    for (let v = 60; v <= 84; v++) { engine.updateRegister(v); await sleep(gap); }
    for (let v = 84; v >= 48; v--) { engine.updateRegister(v); await sleep(gap); }
    await sleep(500);
    for (const k of held) engine.handleMidi(k, 0, false);
    await sleep(600);
    const d = dangling(on, off);
    check(`${label}: no hanging notes`, d.length === 0, `hanging=${JSON.stringify(d)}`);
  }

  console.log('\n=== Release DURING the drag, repeatedly ===');
  for (let trial = 0; trial < 5; trial++) {
    const { engine, on, off } = mk({ strumEngine: 1, strumSpeedMs: 40 });
    engine.handleMidi(60, 100, true);
    await sleep(5 + trial * 9); // release at various points inside the strum window
    for (let v = 60; v <= 70; v++) { engine.updateRegister(v); await sleep(4); }
    engine.handleMidi(60, 0, false);
    for (let v = 70; v <= 78; v++) { engine.updateRegister(v); await sleep(4); }
    await sleep(600);
    const d = dangling(on, off);
    check(`trial ${trial}: no hanging notes`, d.length === 0, `hanging=${JSON.stringify(d)}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
}
main();
