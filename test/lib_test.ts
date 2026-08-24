import { CHORD_PATTERNS, TICKS_PER_BEAT } from '../src/lib/ChordPatterns.ts';
import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const byCat = (c: string) => CHORD_PATTERNS.filter(p => (p.category ?? 'piano') === c);

console.log('\n=== The favourites are all still here ===');
{
  for (const name of ['PIMA', 'HARP FOURS', 'HARP THREES', 'HARP WAVE', 'HARP WHISPER', 'HARP CROSS']) {
    check(`${name} kept`, CHORD_PATTERNS.some(p => p.name === name));
  }
}

console.log('\n=== Every category is filled ===');
{
  for (const c of ['piano', 'harp', 'guitar', 'shapes']) {
    check(`${c} has at least ten`, byCat(c).length >= 10, `${byCat(c).length}`);
  }
  check('names are unique', new Set(CHORD_PATTERNS.map(p => p.name)).size === CHORD_PATTERNS.length);
  let bad = '';
  for (const p of CHORD_PATTERNS) {
    const total = p.lengthBeats * TICKS_PER_BEAT;
    for (const e of p.events) {
      if (e.voice < 1 || e.voice > 8) bad = `${p.name} voice ${e.voice}`;
      if (e.start < 0 || e.start >= total) bad = `${p.name} start ${e.start}/${total}`;
      if (e.length < 1) bad = `${p.name} length`;
      if (e.velocity < 1 || e.velocity > 127) bad = `${p.name} vel ${e.velocity}`;
    }
    if (p.events.length === 0) bad = `${p.name} empty`;
  }
  check('every event is in range', bad === '', bad);
}

console.log('\n=== The library is figuration, not block chords ===');
{
  const maxAtOnce = (p: any) => {
    const byStart = new Map<number, number>();
    for (const e of p.events) byStart.set(e.start, (byStart.get(e.start) ?? 0) + 1);
    return Math.max(...byStart.values());
  };
  const single = CHORD_PATTERNS.filter(p => maxAtOnce(p) === 1);
  check('almost everything moves one note at a time',
    single.length >= CHORD_PATTERNS.length - 4, `${single.length}/${CHORD_PATTERNS.length}`);

  // Notes must ring past the step to the next one, or the part sounds clipped.
  const ringy = CHORD_PATTERNS.filter(p => {
    const avg = p.events.reduce((s: number, e: any) => s + e.length, 0) / p.events.length;
    return avg >= TICKS_PER_BEAT * 0.7;
  });
  check('notes are left ringing', ringy.length >= CHORD_PATTERNS.length - 3, `${ringy.length}/${CHORD_PATTERNS.length}`);

  check('velocities vary everywhere',
    CHORD_PATTERNS.every(p => new Set(p.events.map(e => e.velocity)).size > 2),
    CHORD_PATTERNS.filter(p => new Set(p.events.map(e => e.velocity)).size <= 2).map(p => p.name).join(','));
}

(async () => {
  console.log('\n=== Chord balance ===');
  {
    // The pattern note is thrown an octave up so it cannot be mistaken for the
    // chord's own lowest note, which is the same pitch.
    const ONE = JSON.stringify({ name: 'T', lengthBeats: 4, events: [{ voice: 1, start: 0, length: 24, velocity: 127, octave: 1 }] });
    const grab = async (balance: number) => {
      const e = new OrchidEngine({
        ...defaultParams, velHumanize: 0, patternEnabled: true, patternBpm: 240,
        patternCustom: ONE, patternChordLayer: true, patternChordBalance: balance,
      });
      const ons: Array<{ p: number; v: number }> = [];
      e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push({ p: ev.pitch, v: ev.velocity }); };
      e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
      await sleep(350);
      e.panic();
      await sleep(50);
      const pat = ons.filter(o => o.p === 72).map(o => o.v);
      const chord = ons.filter(o => o.p === 64).map(o => o.v);
      return { pat: pat[0] ?? 0, chord: chord[0] ?? 0 };
    };
    const level = await grab(50);
    const toPattern = await grab(0);
    const toChord = await grab(100);
    check('level sounds both', level.pat > 0 && level.chord > 0, JSON.stringify(level));
    check('hard left silences the chord', toPattern.chord === 0 && toPattern.pat > 0, JSON.stringify(toPattern));
    check('hard right silences the pattern', toChord.pat === 0 && toChord.chord > 0, JSON.stringify(toChord));
  }

  console.log('\n=== Humanize leans late ===');
  {
    const e = new OrchidEngine({ ...defaultParams, patternHumanize: 100 });
    const offsets: number[] = [];
    for (let i = 0; i < 4000; i++) offsets.push((e as any).humanizeOffsetMs());
    const late = offsets.filter(o => o > 0).length;
    const ratio = late / offsets.length;
    check('about three in four are late', ratio > 0.7 && ratio < 0.8, `${(ratio * 100).toFixed(1)}%`);
    check('and some still rush', offsets.some(o => o < 0));
    check('the reach is bounded', Math.max(...offsets.map(Math.abs)) <= 45, `${Math.max(...offsets.map(Math.abs)).toFixed(1)}ms`);

    const off = new OrchidEngine({ ...defaultParams, patternHumanize: 0 });
    check('at zero nothing moves', Array.from({ length: 50 }, () => (off as any).humanizeOffsetMs()).every(o => o === 0));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
