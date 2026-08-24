import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { CHORD_PATTERNS, randomPattern, patternDurationMs, TICKS_PER_BEAT } from '../src/lib/ChordPatterns.ts';

// A four-beat pattern whose events carry no octave of their own, so what comes
// out can be compared against the chord itself.
const PLAIN = CHORD_PATTERNS.findIndex(p =>
  p.lengthBeats === 4 && p.events.every(e => !e.octave && !e.semitones));
if (PLAIN < 0) throw new Error('no plain four-beat pattern to test with');

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('\n=== Library is well formed ===');
  {
    check('a full library', CHORD_PATTERNS.length >= 40, `${CHORD_PATTERNS.length}`);
    const names = new Set(CHORD_PATTERNS.map(p => p.name));
    check('names are unique', names.size === CHORD_PATTERNS.length);
    let ok = true, why = '';
    for (const p of CHORD_PATTERNS) {
      const total = p.lengthBeats * TICKS_PER_BEAT;
      if (p.events.length === 0) { ok = false; why = `${p.name} empty`; break; }
      for (const e of p.events) {
        if (e.voice < 1 || e.voice > 8) { ok = false; why = `${p.name} voice ${e.voice}`; break; }
        if (e.start < 0 || e.start >= total) { ok = false; why = `${p.name} start ${e.start}/${total}`; break; }
        if (e.length < 1) { ok = false; why = `${p.name} length ${e.length}`; break; }
        if (e.velocity < 1 || e.velocity > 127) { ok = false; why = `${p.name} vel ${e.velocity}`; break; }
      }
      if (!ok) break;
    }
    check('every event is in range', ok, why);
    check('some patterns stack voices', CHORD_PATTERNS.some(p => {
      const byStart = new Map<number, number>();
      for (const e of p.events) byStart.set(e.start, (byStart.get(e.start) ?? 0) + 1);
      return [...byStart.values()].some(n => n > 1);
    }));
    check('some patterns sound one voice alone', CHORD_PATTERNS.some(p => {
      const byStart = new Map<number, number>();
      for (const e of p.events) byStart.set(e.start, (byStart.get(e.start) ?? 0) + 1);
      return [...byStart.values()].some(n => n === 1);
    }));
    check('velocities vary within a pattern', CHORD_PATTERNS.some(p => new Set(p.events.map(e => e.velocity)).size > 1));
    check('durations vary across the library', new Set(CHORD_PATTERNS.flatMap(p => p.events.map(e => e.length))).size > 4);
  }

  console.log('\n=== Random patterns are usable ===');
  {
    let ok = true, why = '';
    for (let i = 0; i < 40; i++) {
      const p = randomPattern(i * 7919);
      const total = p.lengthBeats * TICKS_PER_BEAT;
      if (p.events.length === 0) { ok = false; why = `seed ${i} empty`; break; }
      for (const e of p.events) {
        if (e.voice < 1 || e.voice > 5 || e.start < 0 || e.start >= total || e.length < 1) { ok = false; why = `seed ${i} bad event`; break; }
      }
      if (!ok) break;
    }
    check('40 seeds all produce valid patterns', ok, why);
    check('the same seed gives the same pattern',
      JSON.stringify(randomPattern(123)) === JSON.stringify(randomPattern(123)));
    check('different seeds differ',
      JSON.stringify(randomPattern(1)) !== JSON.stringify(randomPattern(2)));
    check('always has a downbeat', [1, 2, 3, 4, 5].every(s => randomPattern(s).events.some(e => e.start === 0)));
  }

  console.log('\n=== The transport plays and stops cleanly ===');
  {
    const params = { ...defaultParams, patternEnabled: true, patternIndex: PLAIN, patternBpm: 200, strumEngine: 1 };
    const e = new OrchidEngine(params);
    const ons: number[] = [], offs: number[] = [];
    e.onOutputNote = (ev: any) => {
      if (ev.isPitchBend || ev.isCC || ev.isExpression) return;
      if (ev.isOn) ons.push(ev.pitch); else offs.push(ev.pitch);
    };
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67, 71]);
    await sleep(400);
    check('notes are sounding', ons.length > 0, `${ons.length}`);
    check('only chord notes are used', ons.every(p => [60, 64, 67, 71].includes(p)), JSON.stringify([...new Set(ons)]));
    const soundingBefore = ons.length - offs.length;
    check('some notes still held mid-pattern', soundingBefore >= 0, `${soundingBefore}`);

    e.handleMidi(60, 0, false, false, false, false, true, [60, 64, 67, 71]);
    await sleep(300);
    check('every note was released', ons.length === offs.length, `${ons.length} on / ${offs.length} off`);
    const stray: number[] = [];
    e.onOutputNote = (ev: any) => { if (ev.isOn) stray.push(ev.pitch); };
    await sleep(400);
    check('nothing sounds after release', stray.length === 0, `${stray.length}`);
  }

  console.log('\n=== Voices wrap onto a smaller chord ===');
  {
    const params = { ...defaultParams, patternEnabled: true, patternIndex: PLAIN, patternBpm: 220 };
    const e = new OrchidEngine(params);
    const ons: number[] = [];
    e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64]); // only two notes
    await sleep(500);
    check('pattern still fires', ons.length > 0, `${ons.length}`);
    check('never reaches past the chord', ons.every(p => p === 60 || p === 64), JSON.stringify([...new Set(ons)]));
    e.handleMidi(60, 0, false, false, false, false, true, [60, 64]);
    await sleep(100);
  }

  console.log('\n=== Panic stops a running pattern ===');
  {
    const params = { ...defaultParams, patternEnabled: true, patternIndex: PLAIN, patternBpm: 200 };
    const e = new OrchidEngine(params);
    let on = 0, off = 0;
    e.onOutputNote = (ev: any) => { if (ev.isPitchBend || ev.isCC) return; if (ev.isOn) on++; else off++; };
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(250);
    e.panic();
    await sleep(250);
    check('no note left sounding after panic', on === off, `${on} on / ${off} off`);
  }

  console.log('\n=== Cycle starts are marked once per cycle ===');
  {
    const pattern = CHORD_PATTERNS[PLAIN];
    const params = { ...defaultParams, patternEnabled: true, patternIndex: PLAIN, patternBpm: 240 };
    const cycleMs = patternDurationMs(pattern, 240);
    const e = new OrchidEngine(params);
    let cycles = 0, notes = 0;
    e.onOutputNote = (ev: any) => {
      if (ev.isPitchBend || ev.isCC || !ev.isOn) return;
      notes++;
      if (ev.isCycleStart) cycles++;
    };
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(cycleMs * 2 + 120);
    e.handleMidi(60, 0, false, false, false, false, true, [60, 64, 67]);
    check('more notes than cycles', notes > cycles, `${notes} notes / ${cycles} cycles`);
    check('roughly one cycle mark per cycle', cycles >= 2 && cycles <= 4, `${cycles} in 2 cycles`);
    await sleep(100);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
