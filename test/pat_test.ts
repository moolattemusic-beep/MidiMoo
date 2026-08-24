import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

// Drive getArpeggioSequence off a known pitch list by stubbing the source.
function seqFor(pattern: number, pitches: number[]) {
  const engine: any = new OrchidEngine({ ...defaultParams, arpeggioPattern: pattern });
  engine.getArpeggioPitches = () => pitches;
  return engine.getArpeggioSequence();
}
// map pitches back to 1-based positions so the output reads like the spec
const asPos = (seq: number[], pitches: number[]) => seq.map(p => pitches.indexOf(p) + 1);

const NAMES = ['UP', 'DOWN', '2UP1DN', 'ALT', '3RDS', 'PEND', 'OUT-IN', 'RND'];

function main() {
  const six = [60, 62, 64, 65, 67, 69];
  const three = [60, 64, 67];

  console.log('=== Six notes, every pattern ===');
  for (let i = 0; i < NAMES.length; i++) {
    const s = seqFor(i, six);
    console.log(`  ${NAMES[i].padEnd(7)} ${asPos(s, six).join(' ')}`);
  }

  console.log('\n=== The two you specified ===');
  {
    // 3-note chord in one octave, two up one down -> 1 2 3, 2 3 1, 3 1 2
    const s = asPos(seqFor(2, three), three);
    check('3-note TWO UP ONE DOWN = 1 2 3 2 3 1 3 1 2',
      JSON.stringify(s) === JSON.stringify([1,2,3,2,3,1,3,1,2]), s.join(' '));
  }
  {
    const s = asPos(seqFor(2, six), six);
    check('6-note TWO UP ONE DOWN starts 1 2 3 2 3 4 3 4 5',
      JSON.stringify(s.slice(0, 9)) === JSON.stringify([1,2,3,2,3,4,3,4,5]), s.slice(0, 9).join(' '));
  }
  {
    const s = asPos(seqFor(3, six), six);
    check('ALTERNATE starts 1 3 2 4 then 3 5 4 6',
      JSON.stringify(s.slice(0, 8)) === JSON.stringify([1,3,2,4,3,5,4,6]), s.slice(0, 8).join(' '));
  }

  console.log('\n=== The rest behave ===');
  check('UP is the plain list', JSON.stringify(seqFor(0, six)) === JSON.stringify(six));
  check('DOWN is reversed', JSON.stringify(seqFor(1, six)) === JSON.stringify([...six].reverse()));
  check('THIRDS = 1 3 5 2 4 6', JSON.stringify(asPos(seqFor(4, six), six)) === JSON.stringify([1,3,5,2,4,6]));
  check('PENDULUM = 1..6 then 5 4 3 2', JSON.stringify(asPos(seqFor(5, six), six)) === JSON.stringify([1,2,3,4,5,6,5,4,3,2]));
  check('OUTSIDE-IN = 1 6 2 5 3 4', JSON.stringify(asPos(seqFor(6, six), six)) === JSON.stringify([1,6,2,5,3,4]));

  console.log('\n=== No two patterns are the same ===');
  {
    const sigs = NAMES.map((_, i) => i === 7 ? null : JSON.stringify(seqFor(i, six)));
    for (let a = 0; a < sigs.length; a++)
      for (let b = a + 1; b < sigs.length; b++)
        if (sigs[a] && sigs[b])
          check(`${NAMES[a]} differs from ${NAMES[b]}`, sigs[a] !== sigs[b], `both ${asPos(seqFor(a, six), six).join(' ')}`);
  }

  console.log('\n=== Density and safety ===');
  check('patterns are denser than the chord', seqFor(2, six).length > six.length, `${seqFor(2, six).length} vs ${six.length}`);
  check('every note is a real chord tone', seqFor(2, six).every(p => six.includes(p)));
  for (let i = 0; i < NAMES.length; i++) {
    check(`${NAMES[i]}: empty chord is safe`, seqFor(i, []).length === 0);
    check(`${NAMES[i]}: single note is safe`, seqFor(i, [60]).every(p => p === 60));
  }

  console.log('\n=== RANDOM is stable until the chord changes ===');
  {
    const engine: any = new OrchidEngine({ ...defaultParams, arpeggioPattern: 7 });
    let list = six;
    engine.getArpeggioPitches = () => list;
    const a = engine.getArpeggioSequence();
    const b = engine.getArpeggioSequence();
    check('same chord -> same order', JSON.stringify(a) === JSON.stringify(b), `${a} vs ${b}`);
    check('contains every note once', [...a].sort((x, y) => x - y).join() === [...six].sort((x, y) => x - y).join());
    list = [60, 63, 67];
    const c = engine.getArpeggioSequence();
    check('chord changed -> reshuffled to new notes', c.every((p: number) => list.includes(p)) && c.length === 3, `${c}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
}
main();
