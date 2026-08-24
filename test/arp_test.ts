import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function mk(over: any = {}) {
  const engine: any = new OrchidEngine({ ...defaultParams, ...over });
  const evts: any[] = [];
  const t0 = Date.now();
  engine.onOutputNote = (e: any) => {
    if (e.isExpression || e.isPitchBend) return;
    evts.push({ at: Date.now() - t0, kind: e.isOn ? 'ON' : 'OFF', pitch: e.pitch, ch: e.mpeChannel });
  };
  return { engine, evts };
}

async function heldFor(lengthMs: number | undefined, extra: any = {}) {
  const { engine, evts } = mk(lengthMs === undefined ? extra : { arpeggioNoteLengthMs: lengthMs, ...extra });
  engine.handleArpeggioNoteOn(60, 100);
  await sleep((lengthMs ?? 100) + 350);
  const on = evts.find(e => e.kind === 'ON');
  const off = evts.find(e => e.kind === 'OFF');
  return { on, off, held: on && off ? off.at - on.at : null, engine };
}

async function main() {
  console.log('=== Note length is honoured ===');
  for (const len of [20, 100, 500, 1200]) {
    const { held } = await heldFor(len);
    const ok = held !== null && Math.abs(held - len) <= 60;
    check(`${len}ms setting -> note held ~${len}ms`, ok, `measured ${held}ms`);
  }

  console.log('\n=== Default is unchanged (100ms) ===');
  {
    const { held } = await heldFor(undefined);
    check('default still 100ms', held !== null && Math.abs(held - 100) <= 60, `measured ${held}ms`);
  }

  console.log('\n=== Notes still release cleanly (no hangs) ===');
  {
    const { engine, evts } = mk({ arpeggioNoteLengthMs: 300, mpeEnabled: true });
    for (const p of [60, 64, 67, 72]) { engine.handleArpeggioNoteOn(p, 100); await sleep(40); }
    await sleep(800);
    const ons = evts.filter(e => e.kind === 'ON').length;
    const offs = evts.filter(e => e.kind === 'OFF').length;
    check('every arpeggio note released', ons === offs && ons === 4, `on=${ons} off=${offs}`);
    check('pool empty', engine.activeArpeggioNotes.size === 0, `${engine.activeArpeggioNotes.size}`);
    const alloc = engine.mpeChannelsAllocated.filter((x: boolean) => x).length;
    check('no MPE channels leaked', alloc === 0, `${alloc}`);
  }

  console.log('\n=== Retrigger before the note expires still works ===');
  {
    const { engine, evts } = mk({ arpeggioNoteLengthMs: 800 });
    engine.handleArpeggioNoteOn(60, 100);
    await sleep(100);
    engine.handleArpeggioNoteOn(60, 100); // same pitch again, still ringing
    await sleep(1000);
    const ons = evts.filter(e => e.kind === 'ON').length;
    const offs = evts.filter(e => e.kind === 'OFF').length;
    check('retrigger balanced', ons === offs && ons === 2, `on=${ons} off=${offs}`);
    check('nothing left ringing', engine.activeArpeggioNotes.size === 0, `${engine.activeArpeggioNotes.size}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
}
main();
