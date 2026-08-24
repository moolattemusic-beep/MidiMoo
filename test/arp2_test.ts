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

// Mirror of the curve in ArpeggioXYPad
const MIN = 20, MAX = 5000, TICKS = 1000;
const toMs = (pos: number) => {
  const ms = MIN * Math.pow(MAX / MIN, pos / TICKS);
  const grain = ms < 100 ? 5 : ms < 500 ? 10 : ms < 2000 ? 25 : 50;
  return Math.min(MAX, Math.max(MIN, Math.round(ms / grain) * grain));
};

async function main() {
  console.log('=== Swept notes each ring their full length ===');
  {
    const LEN = 700;
    const { engine, evts } = mk({ arpeggioNoteLengthMs: LEN });
    const pitches = [60, 62, 64, 65, 67];
    for (const p of pitches) { engine.handleArpeggioNoteOn(p, 100); await sleep(60); }
    // While still sweeping, earlier notes must still be sounding
    const offsSoFar = evts.filter(e => e.kind === 'OFF').length;
    check('nothing cut off during the sweep', offsSoFar === 0, `${offsSoFar} early note-offs`);
    check('all notes still ringing', engine.activeArpeggioNotes.size === 5, `${engine.activeArpeggioNotes.size}/5`);

    await sleep(LEN + 400);
    const held = pitches.map(p => {
      const on = evts.find(e => e.kind === 'ON' && e.pitch === p);
      const off = evts.find(e => e.kind === 'OFF' && e.pitch === p);
      return on && off ? off.at - on.at : null;
    });
    console.log('  held durations:', JSON.stringify(held));
    check('each note held ~its full length', held.every(h => h !== null && Math.abs(h - LEN) <= 120), JSON.stringify(held));
    check('all released in the end', engine.activeArpeggioNotes.size === 0, `${engine.activeArpeggioNotes.size}`);
  }

  console.log('\n=== Long setting: notes overlap rather than choking each other ===');
  {
    const { engine, evts } = mk({ arpeggioNoteLengthMs: 3000, mpeEnabled: true });
    for (const p of [60, 64, 67, 71]) { engine.handleArpeggioNoteOn(p, 100); await sleep(80); }
    await sleep(200);
    const sounding = evts.filter(e => e.kind === 'ON').length - evts.filter(e => e.kind === 'OFF').length;
    check('4 notes sounding together', sounding === 4, `${sounding}`);
    engine.panic();
  }

  console.log('\n=== Re-hitting the same pitch still retriggers ===');
  {
    const { engine, evts } = mk({ arpeggioNoteLengthMs: 2000 });
    engine.handleArpeggioNoteOn(60, 100);
    await sleep(100);
    engine.handleArpeggioNoteOn(60, 100);
    await sleep(2400);
    const ons = evts.filter(e => e.kind === 'ON').length;
    const offs = evts.filter(e => e.kind === 'OFF').length;
    check('balanced on/off', ons === offs && ons === 2, `on=${ons} off=${offs}`);
    check('nothing left ringing', engine.activeArpeggioNotes.size === 0, `${engine.activeArpeggioNotes.size}`);
  }

  console.log('\n=== Curve: low values get most of the travel ===');
  {
    const pts = [0, 100, 250, 500, 750, 900, 1000].map(p => ({ pos: p, ms: toMs(p) }));
    console.log('  ', JSON.stringify(pts));
    check('starts at 20ms', toMs(0) === 20, `${toMs(0)}`);
    check('tops out at 5000ms', toMs(1000) === 5000, `${toMs(1000)}`);
    const below500 = pts.filter(p => p.ms <= 500).length;
    check('at least half the travel is under 500ms', below500 >= 4, `${below500}/7 points`);
    const monotone = pts.every((p, i) => i === 0 || p.ms > pts[i-1].ms);
    check('monotonic', monotone);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
}
main();
