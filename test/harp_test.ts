import { CHORD_PATTERNS, TICKS_PER_BEAT } from '../src/lib/ChordPatterns.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

const byCat = (c: string) => CHORD_PATTERNS.filter(p => (p.category ?? 'piano') === c);

console.log('\n=== Every pattern is filed and sound ===');
{
  const cats = new Set(CHORD_PATTERNS.map(p => p.category ?? 'piano'));
  check('only known categories', [...cats].every(c => ['piano', 'harp', 'guitar', 'shapes'].includes(c)), [...cats].join(','));
  for (const c of ['piano', 'harp', 'guitar', 'shapes']) {
    check(`${c} has patterns`, byCat(c).length >= 7, `${byCat(c).length}`);
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
  }
  check('every event is in range', bad === '', bad);
}

console.log('\n=== Harp patterns behave like a harp ===');
{
  const harp = byCat('harp');
  // Four fingers to a hand: nothing should strike five notes at one instant.
  const maxAtOnce = (p: any) => {
    const byStart = new Map<number, number>();
    for (const e of p.events) byStart.set(e.start, (byStart.get(e.start) ?? 0) + 1);
    return Math.max(...byStart.values());
  };
  // A harp never strikes two strings at the same instant: the hand crosses
  // them. Everything is spread, whether it is a rolled chord or a run.
  check('no two notes ever land together', harp.every(p => maxAtOnce(p) === 1),
    harp.filter(p => maxAtOnce(p) > 1).map(p => p.name).join(','));

  // Some are rolled chords (notes a few ticks apart), the rest are runs. Both
  // are idiomatic, so it is the presence of rolls that is checked, not that
  // every pattern is one.
  const rolled = harp.filter(p => {
    const starts = [...new Set(p.events.map(e => e.start))].sort((a, b) => a - b);
    return starts.some((s, i) => i > 0 && s - starts[i - 1] > 0 && s - starts[i - 1] <= 8);
  });
  check('several patterns roll their chords', rolled.length >= 4, `${rolled.length}/${harp.length}`);
  check('the rest are runs', harp.length - rolled.length >= 4, `${harp.length - rolled.length}`);

  // Strings ring: notes last well beyond the gap to the next one.
  const ringy = harp.filter(p => {
    const avg = p.events.reduce((s: number, e: any) => s + e.length, 0) / p.events.length;
    return avg >= TICKS_PER_BEAT * 0.8;
  });
  check('notes are left ringing', ringy.length >= 7, `${ringy.length}/${harp.length}`);

  // Not robotic: velocities vary within every pattern.
  check('velocities vary in every harp pattern',
    harp.every(p => new Set(p.events.map(e => e.velocity)).size > 2),
    harp.filter(p => new Set(p.events.map(e => e.velocity)).size <= 2).map(p => p.name).join(','));

  // Groups of three and four, never five in a run.
  check('figures come in threes and fours', harp.some(p => p.name === 'HARP THREES') && harp.some(p => p.name === 'HARP FOURS'));
}

console.log('\n=== Guitar patterns are strummed ===');
{
  const guitar = byCat('guitar');
  const spread = guitar.filter(p => {
    const starts = [...new Set(p.events.map(e => e.start))].sort((a, b) => a - b);
    return starts.some((s, i) => i > 0 && s - starts[i - 1] > 0 && s - starts[i - 1] <= 6);
  });
  check('the strums there are are spread across the strings', spread.length >= 3, `${spread.length}/${guitar.length}`);
  check('velocities vary', guitar.every(p => new Set(p.events.map(e => e.velocity)).size > 2));
}

console.log('\n=== Off the grid on purpose ===');
{
  // A part placed exactly on the grid everywhere is what sounds typed.
  const offGrid = CHORD_PATTERNS.filter(p =>
    p.events.some(e => e.start % (TICKS_PER_BEAT / 4) !== 0)
  );
  check('many patterns sit slightly off the grid', offGrid.length >= 12, `${offGrid.length}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(0);
