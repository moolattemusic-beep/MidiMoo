import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function mk(over: any = {}) {
  const engine: any = new OrchidEngine({ ...defaultParams, mpeEnabled: true, keyboardMapping: 2, mpeGlideTimeMs: 150, ...over });
  const on: any[] = [], off: any[] = [];
  engine.onOutputNote = (e: any) => {
    if (e.isExpression || e.isPitchBend) return;
    (e.isOn ? on : off).push({ pitch: e.pitch, ch: e.mpeChannel ?? 1 });
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
  console.log('=== Hold a chord, drag CHORD START across its range ===');
  for (const [label, opts] of [
    ['no bass', {}],
    ['auto bass on', { autoBassRegister: 2 }],
    ['legato glide', { mpeGlideMode: 0 }],
    ['hold glide', { mpeGlideMode: 2 }],
  ] as const) {
    const { engine, on, off } = mk(opts);
    engine.handleMidi(60, 100, true);
    await sleep(30);
    // drag the slider: many rapid updates, as a pointer drag produces
    for (let v = 60; v <= 84; v++) { engine.updateRegister(v); await sleep(6); }
    for (let v = 84; v >= 48; v--) { engine.updateRegister(v); await sleep(6); }
    await sleep(300);
    engine.handleMidi(60, 0, false);
    await sleep(400);
    // HOLD deliberately keeps notes ringing until the next chord or PANIC,
    // so it is only expected to be silent after a panic.
    if (label === 'hold glide') { engine.panic(); await sleep(20); }
    const d = dangling(on, off);
    const stillRinging = Object.values(engine.activePitchesMemory).flat().length;
    if (label === 'hold glide') {
      check(`${label}: PANIC clears the pool`, stillRinging === 0, `entries=${stillRinging}`);
    } else {
      check(`${label}: no hanging notes after release`, d.length === 0, `hanging=${JSON.stringify(d)}`);
      check(`${label}: engine memory empty`, stillRinging === 0, `entries=${stillRinging}`);
    }
  }

  console.log('\n=== Same, but release mid-drag ===');
  {
    const { engine, on, off } = mk();
    engine.handleMidi(60, 100, true);
    await sleep(20);
    for (let v = 60; v <= 72; v++) { engine.updateRegister(v); await sleep(5); }
    engine.handleMidi(60, 0, false);          // let go while still dragging
    for (let v = 72; v <= 80; v++) { engine.updateRegister(v); await sleep(5); }
    await sleep(400);
    const d = dangling(on, off);
    check('no hanging notes when released mid-drag', d.length === 0, `hanging=${JSON.stringify(d)}`);
  }

  console.log('\n=== MPE channel accounting ===');
  {
    const { engine } = mk();
    engine.handleMidi(60, 100, true);
    for (let v = 60; v <= 84; v++) { engine.updateRegister(v); await sleep(4); }
    engine.handleMidi(60, 0, false);
    await sleep(400);
    const allocated = engine.mpeChannelsAllocated.filter((x: boolean) => x).length;
    check('no MPE channels leaked', allocated === 0, `still marked in use: ${allocated}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
}
main();
