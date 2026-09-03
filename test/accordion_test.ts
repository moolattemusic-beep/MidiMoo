import { pruneOpenSections } from '../src/lib/AccordionState.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

const sections = new Set(['EXTERNAL SYNTH', 'WALK', 'Register Control', 'MPE GLIDE']);

function main() {
  console.log('=== A renamed section must not empty the column ===');
  {
    // Exactly what shipped: MODEL D was open, then it was renamed. Nothing
    // matched, every sibling hid itself, and there was no header left to click.
    const out = pruneOpenSections({ root: 'MODEL D' }, sections);
    check('a section that no longer exists is dropped', out.root === null, `${JSON.stringify(out)}`);
  }
  {
    const stored = { root: 'WALK' };
    check('a section that does exist is left alone',
      pruneOpenSections(stored, sections) === stored);
  }
  {
    const stored = { root: null };
    check('nothing open stays nothing open',
      pruneOpenSections(stored, sections) === stored);
  }
  {
    const stored = {};
    check('an empty store is untouched', pruneOpenSections(stored, sections) === stored);
  }

  console.log('\n=== Only what is known counts ===');
  {
    // Before any section has reported in there is no evidence either way, and
    // pruning on no evidence would throw away a perfectly good choice.
    const stored = { root: 'WALK' };
    check('an empty section list prunes nothing',
      pruneOpenSections(stored, new Set()) === stored);
  }

  console.log('\n=== Nested groups are left to themselves ===');
  {
    // Only the root list drills in, so only it can strand the column. A nested
    // group with an unmatched title just means nothing is open there.
    const out = pruneOpenSections({ root: 'WALK', velmod: 'VEL PITCH' }, sections);
    check('a subsection name is not pruned against the root list',
      out.velmod === 'VEL PITCH', `${JSON.stringify(out)}`);
  }
  {
    const out = pruneOpenSections({ root: 'MODEL D', velmod: 'VIBRATO' }, sections);
    check('the root is cleared without disturbing the rest',
      out.root === null && out.velmod === 'VIBRATO', `${JSON.stringify(out)}`);
  }

  console.log('\n=== The stored object is never mutated ===');
  {
    const stored = { root: 'MODEL D' };
    pruneOpenSections(stored, sections);
    check('pruning returns a new object rather than editing state in place',
      stored.root === 'MODEL D');
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
