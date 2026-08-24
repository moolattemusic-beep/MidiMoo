import { createRequire } from 'node:module';
import path from 'node:path';
import { diffParams, fieldChanged, isAllowedCommand } from '../src/lib/RemoteProtocol.ts';

// The suite is bundled into test/.build before it runs, so relative requires
// would resolve from there rather than from this file.
const require = createRequire(path.join(process.cwd(), 'noop.js'));
const { HeldGestures, resolveFile } = require('./electron/remote-safety.cjs');

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

const DIST = '/app/dist';

console.log('\n=== What a vanished phone is owed ===');
{
  const held = new HeldGestures();
  const chord = [60, 100, true, false, false, false, true, [60, 64, 67], undefined];
  held.record('handleMidi', chord);
  const releases = held.releases();
  check('a held chord comes back as one release', releases.length === 1, `${releases.length}`);
  const args = releases[0].args;
  check('addressed to the same key', args[0] === 60, `${args[0]}`);
  check('at zero velocity', args[1] === 0, `${args[1]}`);
  check('and switched off', args[2] === false, `${args[2]}`);
  // The voicing has to survive: the engine identifies what to release by it.
  check('carrying the same voicing', JSON.stringify(args[7]) === JSON.stringify([60, 64, 67]), `${args[7]}`);
  check('the original is left alone', chord[1] === 100 && chord[2] === true, `${chord[1]} ${chord[2]}`);
}
{
  const held = new HeldGestures();
  held.record('handleMidi', [60, 100, true]);
  held.record('handleMidi', [64, 100, true]);
  held.record('handleMidi', [60, 0, false]);
  check('a key already released is not released twice', held.releases().length === 1, JSON.stringify(held.releases()));
  check('and it is the one still down', held.releases()[0].args[0] === 64, '');
}
{
  const held = new HeldGestures();
  held.record('setBaseType', [2]);
  held.record('toggleExtension', ['m7']);
  held.record('handleMidi', [60, 100, true]);
  const kinds = held.releases().map((r: any) => r.fn).sort();
  check('modifiers held down are released too',
    kinds.join() === 'handleMidi,releaseBaseType,releaseExtension', kinds.join());
  held.record('releaseBaseType', [2]);
  held.record('releaseExtension', ['m7']);
  check('once let go they are not', held.releases().length === 1, `${held.releases().length}`);
}
{
  const held = new HeldGestures();
  held.record('handleMidi', [60, 100, true]);
  held.record('setBaseType', [1]);
  held.record('panic', []);
  check('panic leaves nothing owed', held.releases().length === 0, `${held.releases().length}`);
}

console.log('\n=== What a request may read ===');
{
  check('the root is the app', resolveFile(DIST, '/') === '/app/dist/index.html', resolveFile(DIST, '/'));
  check('an asset is itself', resolveFile(DIST, '/assets/main.js') === '/app/dist/assets/main.js', resolveFile(DIST, '/assets/main.js'));
  // A route inside the interface is the app, so a reload does not 404.
  check('a route is the app', resolveFile(DIST, '/settings') === '/app/dist/index.html', resolveFile(DIST, '/settings'));
  for (const attempt of [
    '/../package.json',
    '/../../etc/passwd',
    '/assets/../../../../etc/passwd',
    '/./../../secret.txt',
  ]) {
    const resolved = resolveFile(DIST, attempt);
    check(`"${attempt}" cannot escape`, resolved === null || resolved.startsWith('/app/dist/'), `${resolved}`);
  }
}

console.log('\n=== Only listed commands get through ===');
{
  check('a real command is allowed', isAllowedCommand('handleMidi'), '');
  for (const bad of ['reset', 'constructor', '__proto__', 'panic '] ) {
    check(`"${bad}" is refused`, !isAllowedCommand(bad), '');
  }
  check('and so is nonsense', !isAllowedCommand(42) && !isAllowedCommand(null), '');
}

console.log('\n=== Only what changed goes down the wire ===');
{
  const before = { bpm: 90, colour: 3, matrix: { maj: ['9'] } };
  check('nothing changed sends nothing', diffParams(before, { ...before }) === undefined, '');
  const one = diffParams(before, { ...before, bpm: 120 });
  check('one change sends one key', JSON.stringify(one) === JSON.stringify({ bpm: 120 }), JSON.stringify(one));
  // The colour matrix is an object rebuilt on every state update, so identity
  // would report it changed on every frame.
  const rebuilt = diffParams(before, { bpm: 90, colour: 3, matrix: { maj: ['9'] } });
  check('an object rebuilt with the same contents is not a change', rebuilt === undefined, JSON.stringify(rebuilt));
  const edited = diffParams(before, { ...before, matrix: { maj: ['9', '13'] } });
  check('but a real edit to it is', !!edited && 'matrix' in edited, JSON.stringify(edited));
  check('no previous state sends everything',
    Object.keys(diffParams(null, before) ?? {}).length === 3, '');
}
{
  check('identical arrays are unchanged', !fieldChanged([1, 2], [1, 2]), '');
  check('a different array is changed', fieldChanged([1, 2], [1, 3]), '');
  check('null against a value is changed', fieldChanged(null, { a: 1 }), '');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
