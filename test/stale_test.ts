import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

// Model what the MIDI port actually sees: each message lands at
// (emission time + delayMs), because delayed sends are scheduled to the port.
type Msg = { deliverAt: number; emittedAt: number; kind: string; ch: number; bend?: number; pitch: number };

function mk(over: any = {}) {
  const engine: any = new OrchidEngine({
    ...defaultParams, mpeEnabled: true, mpeGlideTimeMs: 470, keyboardMapping: 2, ...over,
  });
  const msgs: Msg[] = [];
  const t0 = Date.now();
  engine.onOutputNote = (e: any) => {
    const now = Date.now() - t0;
    const d = e.delayMs || 0;
    if (e.isExpression) return;
    msgs.push({
      emittedAt: now, deliverAt: now + d, ch: e.mpeChannel ?? 1, pitch: e.pitch,
      kind: e.isPitchBend ? 'BEND' : (e.isOn ? 'ON' : 'OFF'),
      bend: e.isPitchBend ? e.pitchBendValue : undefined,
    });
  };
  return { engine, msgs };
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== Key mode: glide, then quickly change chord ===');
  const { engine, msgs } = mk();
  engine.handleMidi(60, 100, true);   // chord 1
  await sleep(20);
  engine.handleMidi(64, 100, true);   // chord 2 while 1 held -> glides (470ms of bends)
  await sleep(40);
  engine.handleMidi(64, 0, false);
  engine.handleMidi(60, 0, false);    // let everything go, mid-glide
  await sleep(30);
  engine.handleMidi(67, 100, true);   // brand new chord right after
  await sleep(50);

  // For every note-on, does a bend emitted EARLIER arrive AFTER it?
  const problems: any[] = [];
  for (const on of msgs.filter(m => m.kind === 'ON')) {
    const stale = msgs.filter(m =>
      m.kind === 'BEND' && m.ch === on.ch &&
      m.emittedAt < on.emittedAt &&      // scheduled before this note existed
      m.deliverAt > on.deliverAt &&      // but lands after it starts sounding
      Math.abs(m.bend ?? 0) > 0.01       // and actually bends the pitch
    );
    if (stale.length) problems.push({
      note: on.pitch, ch: on.ch, onAt: on.deliverAt,
      staleBendsArrivingAfter: stale.length,
      worstOffsetSemitones: Math.max(...stale.map(s => Math.abs(s.bend ?? 0))).toFixed(2),
    });
  }

  console.log(JSON.stringify(problems, null, 1));
  console.log(problems.length === 0
    ? '\nPASS  no stale bends land on a fresh note'
    : `\nFAIL  ${problems.length} note(s) get bent by a previous glide still in flight`);
  console.log(`\n${problems.length === 0 ? 1 : 0} passed, ${problems.length === 0 ? 0 : 1} failed`);
}
main();
