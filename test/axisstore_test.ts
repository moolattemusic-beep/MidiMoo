import { AXIS_REST, AxisStore } from '../src/lib/AxisStore.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

function main() {
  console.log('=== The axes start in the middle ===');
  {
    const s = new AxisStore();
    check('at rest', s.get().x === AXIS_REST && s.get().y === AXIS_REST);
  }

  console.log('\n=== Only what moved is reported ===');
  {
    // Which is what stops a surface flooding the link: a finger sliding
    // sideways has nothing to say about the vertical controller.
    const s = new AxisStore();
    check('moving one axis reports only that one',
      s.set({ x: 90 }).join() === 'x', s.set({ x: 90 }).join());
    check('and the other is left alone', s.get().y === AXIS_REST);
    check('moving both reports both', new AxisStore().set({ x: 10, y: 20 }).sort().join() === 'x,y');
    check('setting what is already set reports nothing',
      s.set({ x: 90 }).length === 0);
    // A controller is a whole number, so a change too small to alter the byte
    // that goes out is not a change at all.
    check('a change under half a step is not a change',
      s.set({ x: 90.4 }).length === 0, `${s.get().x}`);
    check('but half a step up is', s.set({ x: 90.6 }).join() === 'x');
  }

  console.log('\n=== Values stay inside a controller ===');
  {
    const s = new AxisStore();
    s.set({ x: 500, y: -80 });
    check('clamped at both ends', s.get().x === 127 && s.get().y === 0,
      `${s.get().x}, ${s.get().y}`);
    s.set({ x: NaN });
    check('nonsense falls back to rest rather than poisoning the value',
      s.get().x === AXIS_REST, `${s.get().x}`);
  }

  console.log('\n=== Everything watching hears about it ===');
  {
    const s = new AxisStore();
    let a = 0, b = 0;
    const stopA = s.subscribe(() => { a++; });
    s.subscribe(() => { b++; });
    s.set({ y: 20 });
    check('both listeners told', a === 1 && b === 1, `${a}, ${b}`);
    s.set({ y: 20 });
    check('and not told when nothing moved', a === 1 && b === 1, `${a}, ${b}`);
    stopA();
    s.set({ y: 30 });
    check('one that unsubscribed hears no more', a === 1 && b === 2, `${a}, ${b}`);
  }

  console.log('\n=== The snapshot is stable ===');
  {
    // useSyncExternalStore compares by identity and would spin for ever on a
    // store that handed out a fresh object each read.
    const s = new AxisStore();
    check('reading twice gives the same object', s.get() === s.get());
    const before = s.get();
    s.set({ x: 1 });
    check('and a new one only once something changed', s.get() !== before);
  }

  console.log('\n=== Reset ===');
  {
    const s = new AxisStore();
    s.set({ x: 0, y: 127 });
    check('reset reports both moving back', s.reset().sort().join() === 'x,y');
    check('and lands at rest', s.get().x === AXIS_REST && s.get().y === AXIS_REST);
    check('resetting what is already at rest says nothing', s.reset().length === 0);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
