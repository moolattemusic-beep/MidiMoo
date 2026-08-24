import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { CHORD_PATTERNS, patternDurationMs } from '../src/lib/ChordPatterns.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const HOLD_PATTERN = JSON.stringify({
  name: 'T', lengthBeats: 4,
  events: [
    { voice: 1, start: 0, length: 384, velocity: 90, hold: true },
    { voice: 2, start: 0, length: 48, velocity: 100 },
    { voice: 3, start: 192, length: 48, velocity: 100 },
  ],
});

const mk = (over: any = {}) => {
  const e = new OrchidEngine({ ...defaultParams, patternEnabled: true, patternBpm: 240, patternCustom: HOLD_PATTERN, ...over });
  const ons: number[] = [], offs: number[] = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isPitchBend || ev.isCC || ev.isExpression) return;
    if (ev.isOn) ons.push(ev.pitch); else offs.push(ev.pitch);
  };
  return { e, ons, offs };
};

(async () => {
  console.log('\n=== A held note is struck once and rings on ===');
  {
    const { e, ons } = mk();
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    const cycleMs = patternDurationMs(JSON.parse(HOLD_PATTERN), 240);
    await sleep(cycleMs * 3 + 100); // three cycles
    const heldStrikes = ons.filter(p => p === 60).length;
    const movingStrikes = ons.filter(p => p === 64).length;
    check('the held note sounded once', heldStrikes === 1, `${heldStrikes} strikes`);
    check('while the moving voice repeated', movingStrikes >= 3, `${movingStrikes} strikes`);
    e.panic();
    await sleep(60);
  }

  console.log('\n=== A held note carries across a chord change ===');
  {
    const { e, ons, offs } = mk({ patternBpm: 200 });
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    const cycleMs = patternDurationMs(JSON.parse(HOLD_PATTERN), 200);
    await sleep(cycleMs * 0.5);
    check('held note is sounding and not released', ons.includes(60) && !offs.includes(60));
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    // Still ringing under the change until the pattern next reaches it.
    check('it rings under the change', !offs.includes(60), `offs ${JSON.stringify(offs)}`);
    await sleep(cycleMs * 1.2);
    check('then it is exchanged for the new chord', ons.includes(65), JSON.stringify([...new Set(ons)]));
    check('and the old one released', offs.includes(60), JSON.stringify(offs));
    e.panic();
    await sleep(60);
  }

  console.log('\n=== Releasing the key releases the held note ===');
  {
    const { e, ons, offs } = mk();
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(250);
    e.handleMidi(60, 0, false, false, false, false, true, []);
    await sleep(150);
    check('nothing is left ringing', ons.length === offs.length, `${ons.length} on / ${offs.length} off`);
    check('the held note was released', offs.includes(60), JSON.stringify(offs));
  }

  console.log('\n=== The library uses holds ===');
  {
    const withHolds = CHORD_PATTERNS.filter(p => p.events.some(e => e.hold));
    check('several patterns hold a chord', withHolds.length >= 4, `${withHolds.length}`);
    check('a held pattern also moves', withHolds.every(p => p.events.some(e => !e.hold)),
      withHolds.filter(p => !p.events.some(e => !e.hold)).map(p => p.name).join(','));
    // What the files showed: most onsets are a single note, not a stack.
    const singles = CHORD_PATTERNS.filter(p => {
      const byStart = new Map<number, number>();
      for (const e of p.events) byStart.set(e.start, (byStart.get(e.start) ?? 0) + 1);
      return [...byStart.values()].filter(n => n === 1).length / byStart.size > 0.5;
    });
    check('many patterns are mostly single notes', singles.length >= 12, `${singles.length}/${CHORD_PATTERNS.length}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
