import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { CHORD_PATTERNS, patternDurationMs } from '../src/lib/ChordPatterns.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const PULSE = CHORD_PATTERNS.findIndex(p => p.lengthBeats === 4 && p.events.length >= 8);

const mk = (over: any = {}) => {
  const e = new OrchidEngine({ ...defaultParams, patternEnabled: true, patternIndex: PULSE, patternBpm: 120, ...over });
  const ons: number[] = [], offs: number[] = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isPitchBend || ev.isCC || ev.isExpression) return;
    if (ev.isOn) ons.push(ev.pitch); else offs.push(ev.pitch);
  };
  return { e, ons, offs };
};

(async () => {
  console.log('\n=== Overlapping chords hand over instead of doubling ===');
  {
    const { e, ons } = mk();
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(300);
    ons.length = 0;
    // Second chord pressed while the first is still held.
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    await sleep(600);
    const oldNotes = ons.filter(p => [60, 64, 67].includes(p)).length;
    const newNotes = ons.filter(p => [65, 69, 72].includes(p)).length;
    check('the new chord is playing', newNotes > 0, `${newNotes}`);
    check('the old chord has stopped being played', oldNotes === 0, `${oldNotes} old notes`);
    e.panic();
    await sleep(80);
  }

  console.log('\n=== Only one run exists at a time ===');
  {
    const { e } = mk();
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(120);
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    e.handleMidi(67, 100, true, false, false, false, true, [67, 71, 74]);
    await sleep(120);
    check('three chords, one run', (e as any).patternRuns.size === 1, `${(e as any).patternRuns.size}`);
    e.panic();
    await sleep(80);
  }

  console.log('\n=== The bass waits for the pattern ===');
  {
    // A bass setting on, so the chord has a root below it.
    const { e, ons } = mk({ bassNote: 1, patternBpm: 60 });
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    // Immediately after the key: the pattern has not reached a note yet.
    const immediate = ons.length;
    await sleep(400);
    check('nothing sounds on the key press itself', immediate === 0, `${immediate} notes`);
    check('notes arrive with the pattern', ons.length > 0, `${ons.length}`);
    e.panic();
    await sleep(80);
  }

  console.log('\n=== The slider keeps the cycle going ===');
  {
    const { e, ons } = mk({ patternBpm: 60 });
    e.handleMidi(48, 100, true, false, false, false, true, [48, 52, 55]);
    const cycleMs = patternDurationMs(CHORD_PATTERNS[PULSE], 60);
    await sleep(cycleMs * 0.45);
    const phaseBefore = e.getPatternPhase()!;
    ons.length = 0;
    e.updateRegister(72);
    await sleep(40);
    const phaseAfter = e.getPatternPhase()!;
    check('the cycle is not restarted', phaseAfter >= phaseBefore - 0.05, `${phaseBefore.toFixed(2)} -> ${phaseAfter.toFixed(2)}`);
    check('and is still mid-cycle', phaseAfter > 0.25, `${phaseAfter.toFixed(2)}`);
    await sleep(cycleMs * 0.6);
    check('the new register is what plays', ons.length > 0 && ons.every(p => p >= 72), JSON.stringify([...new Set(ons)]));
    e.panic();
    await sleep(80);
  }

  console.log('\n=== NEXT BAR holds the change until the cycle turns ===');
  {
    const { e, ons } = mk({ patternChordChange: 1, patternBpm: 60 });
    const cycleMs = patternDurationMs(CHORD_PATTERNS[PULSE], 60);
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(cycleMs * 0.35);
    ons.length = 0;
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    await sleep(cycleMs * 0.3); // still inside the same cycle
    const early = ons.filter(p => [65, 69, 72].includes(p)).length;
    check('the new chord is held back', early === 0, `${early} early notes`);
    await sleep(cycleMs * 0.6); // past the turn
    const later = ons.filter(p => [65, 69, 72].includes(p)).length;
    check('and arrives when the cycle turns', later > 0, `${later}`);
    e.panic();
    await sleep(80);
  }

  console.log('\n=== A semitone offset moves a note ===');
  {
    const { e, ons } = mk({
      patternBpm: 120,
      patternCustom: JSON.stringify({
        name: 'T', lengthBeats: 4,
        events: [
          { voice: 1, start: 0, length: 48, velocity: 100, semitones: 3 },
          { voice: 2, start: 96, length: 48, velocity: 100, octave: -1, semitones: -1 },
        ],
      }),
    });
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(1300);
    check('three semitones up', ons.includes(63), JSON.stringify(ons));
    check('an octave and a semitone down', ons.includes(51), JSON.stringify(ons));
    e.panic();
    await sleep(80);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
