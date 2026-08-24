import { VOICINGS, voicingsFor, voicingFor, voicingSpread, VoicingQuality } from '../src/lib/Voicings.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

const QUALITIES: VoicingQuality[] = ['maj', 'min', 'dom', 'maj7', 'min7', 'sus', 'halfdim', 'dim'];

console.log('\n=== The library is sound ===');
{
  check('every quality is covered', QUALITIES.every(q => voicingsFor(q).length >= 10),
    QUALITIES.map(q => `${q}:${voicingsFor(q).length}`).join(' '));
  check('a good number of voicings', VOICINGS.length >= 120, `${VOICINGS.length}`);

  let bad = '';
  for (const v of VOICINGS) {
    if (v.intervals.length < 4 || v.intervals.length > 6) bad = `${v.quality} has ${v.intervals.length} notes`;
    if (v.intervals.some((n, i) => i > 0 && n <= v.intervals[i - 1])) bad = `${v.quality} not ascending`;
    if (v.intervals[0] < 0) bad = `${v.quality} starts below the root`;
    if (v.intervals[v.intervals.length - 1] > 34) bad = `${v.quality} reaches too far`;
    if (v.weight < 1) bad = `${v.quality} has no weight`;
  }
  check('every shape is well formed', bad === '', bad);
  check('no duplicates', new Set(VOICINGS.map(v => v.quality + v.intervals.join(','))).size === VOICINGS.length);
}

console.log('\n=== They are played voicings, not stacked thirds ===');
{
  const spreads = VOICINGS.map(voicingSpread).sort((a, b) => a - b);
  const median = spreads[Math.floor(spreads.length / 2)];
  check('the median reaches beyond one octave', median > 12, `${median} semitones`);
  check('most reach beyond an octave', spreads.filter(s => s > 12).length > spreads.length * 0.7,
    `${spreads.filter(s => s > 12).length}/${spreads.length}`);
  check('none is unplayably wide', spreads[spreads.length - 1] <= 30, `${spreads[spreads.length - 1]}`);

  // A stack of thirds would put every note in one octave with the root at the
  // bottom; a played voicing frequently does neither.
  const inversions = VOICINGS.filter(v => v.intervals[0] !== 0);
  check('some are inversions, with the root off the bottom', inversions.length > 10, `${inversions.length}`);

  // The seventh below the third is the giveaway of a real neo-soul voicing.
  const seventhLow = VOICINGS.filter(v => {
    const seventh = v.intervals.find(i => i % 12 === 10 || i % 12 === 11);
    const third = v.intervals.find(i => i % 12 === 3 || i % 12 === 4);
    return seventh !== undefined && third !== undefined && seventh < third;
  });
  check('the seventh often sits below the third', seventhLow.length > 10, `${seventhLow.length}`);
}

console.log('\n=== Looking one up ===');
{
  check('commonest first', voicingsFor('min7')[0].weight >= voicingsFor('min7')[1].weight);
  for (const q of QUALITIES) {
    for (const n of [4, 5, 6]) {
      const v = voicingFor(q, n);
      if (!v) { check(`${q} at ${n} notes`, false, 'nothing returned'); continue; }
    }
  }
  check('every quality answers at every size',
    QUALITIES.every(q => [4, 5, 6].every(n => voicingFor(q, n) !== null)));
  check('an exact size is honoured when it exists',
    QUALITIES.every(q => [4, 5, 6].every(n => {
      const v = voicingFor(q, n)!;
      const exact = voicingsFor(q).some(x => x.intervals.length === n);
      return !exact || v.intervals.length === n;
    })));
  check('an impossible size still answers', voicingFor('min7', 12) !== null);
  check('the index walks through the alternatives',
    voicingFor('min7', 5, 0)!.intervals.join() !== voicingFor('min7', 5, 1)!.intervals.join());
  check('the index wraps rather than falling off', voicingFor('min7', 5, 999) !== null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(0);
