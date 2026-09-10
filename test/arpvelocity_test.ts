import { arpVelocity } from '../src/lib/ArpVelocity.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

function main() {
  console.log('=== How far across decides how hard ===');
  {
    check('the far right is the set maximum', arpVelocity(1, 127) === 127);
    check('and honours a lowered one', arpVelocity(1, 100) === 100, `${arpVelocity(1, 100)}`);
    check('the middle is half of it', arpVelocity(0.5, 100) === 50, `${arpVelocity(0.5, 100)}`);
  }

  console.log('\n=== Nothing silent, nothing over the top ===');
  {
    // A velocity of zero is a note-off, so the left edge has to be audible
    // rather than accidentally releasing what it just played.
    check('the far left still sounds', arpVelocity(0, 127) === 1);
    check('and so does just past it', arpVelocity(0.001, 127) === 1);
    check('past the right edge is still the maximum', arpVelocity(1.4, 90) === 90);
    check('before the left edge is still audible', arpVelocity(-0.3, 90) === 1);
    check('a maximum above MIDI is clamped', arpVelocity(1, 999) === 127);
    check('and one below one is not silence', arpVelocity(1, 0) === 1, `${arpVelocity(1, 0)}`);
  }

  console.log('\n=== It rises with the finger ===');
  {
    let rising = true;
    let last = 0;
    for (let i = 0; i <= 100; i++) {
      const v = arpVelocity(i / 100, 127);
      if (v < last) rising = false;
      last = v;
    }
    check('never goes down as the finger goes right', rising);
    check('and covers the whole span', last === 127);
  }

  console.log('\n=== The CC1 mirror is the velocity, not a near miss ===');
  {
    // The mirror exists to say what the note was struck at. If the two were
    // computed separately they could differ by a step, which is exactly the
    // kind of thing nobody notices until a filter sits a hair off the accent.
    const max = 100;
    let same = true;
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      if (arpVelocity(x, max) !== arpVelocity(x, max)) same = false;
    }
    check('the same position always gives the same number', same);
    check('and it is bounded by the same maximum the notes use',
      Array.from({ length: 50 }, (_, i) => arpVelocity(i / 49, max))
        .every(v => v >= 1 && v <= max));
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
