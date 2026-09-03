import {
  captureSnapshot, restoreSnapshot, parseSnapshots, withSnapshot,
  removeSnapshot, renameSnapshot, normaliseSlots, Snapshot,
} from '../src/lib/Snapshots.ts';
import { defaultParams, OrchidParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

const chord = (rootPitch: number) => ({
  rootPitch, baseType: 0, ext_m7: false, ext_M7: true, ext_6: false, ext_9: false,
  symbol: 'Cmaj7',
});
const eightPads = () => [chord(60), chord(62), null, null, null, null, null, chord(67)] as any;

function main() {
  console.log('=== A setup carries the sound and gives it back ===');
  {
    const params: OrchidParams = {
      ...defaultParams, chordRegisterStart: 48, chordInversion: 3,
      arpeggioScale: true, extSynthMode: 'poly', walkBpm: 132,
    };
    const snap = captureSnapshot('Moog Lead', params, eightPads(), ['C', 'G']);
    const back = restoreSnapshot(snap);

    check('every parameter comes back', back.params.chordRegisterStart === 48
      && back.params.chordInversion === 3 && back.params.arpeggioScale === true
      && back.params.extSynthMode === 'poly' && back.params.walkBpm === 132);
    check('the pads come back', back.slots[0]?.rootPitch === 60 && back.slots[7]?.rootPitch === 67);
    check('empty pads stay empty', back.slots[2] === null);
    check("RNDM's required notes come back", back.rndmRequired.join() === 'C,G');
    check('the name is kept', snap.name === 'Moog Lead');
  }
  {
    const snap = captureSnapshot('  ', defaultParams, eightPads(), []);
    check('a blank name gets a placeholder rather than an unlabelled row',
      snap.name === 'UNTITLED', snap.name);
  }
  {
    // Capture must copy, or editing the live state afterwards would rewrite
    // history — the setup would silently follow whatever you did next.
    const live = { ...defaultParams };
    const pads = eightPads();
    const req = ['C'];
    const snap = captureSnapshot('X', live, pads, req);
    live.chordInversion = 9;
    pads[0] = null;
    req.push('G');
    const back = restoreSnapshot(snap);
    check('the setup is a copy, not a window onto the live state',
      back.params.chordInversion === defaultParams.chordInversion
      && back.slots[0]?.rootPitch === 60 && back.rndmRequired.join() === 'C');
  }

  console.log('\n=== A setup outlives the build that saved it ===');
  {
    // The failure this codebase keeps producing: stored state written before a
    // feature existed. A missing parameter has to come back as its default,
    // never as undefined.
    const old = {
      id: 'a', name: 'From An Older Build', saved: 1,
      params: { chordRegisterStart: 40 } as any,
      slots: [], rndmRequired: [],
    } as Snapshot;
    const back = restoreSnapshot(old);
    check('what it did say is honoured', back.params.chordRegisterStart === 40);
    check('what it could not know about gets the default',
      back.params.extSynthMode === defaultParams.extSynthMode
      && back.params.walkBpm === defaultParams.walkBpm
      && back.params.outputVelocity === defaultParams.outputVelocity);
    check('no parameter is left undefined',
      Object.keys(defaultParams).every(k => (back.params as any)[k] !== undefined));
    check('a short pad list is filled out to eight', back.slots.length === 8);
  }
  {
    const back = restoreSnapshot({ name: 'junk' } as any);
    check('a setup missing everything still restores to something usable',
      back.slots.length === 8 && back.rndmRequired.length === 0
      && back.params.chordMaxNotes === defaultParams.chordMaxNotes);
  }

  console.log('\n=== Pads are normalised, whatever was stored ===');
  {
    check('junk in a pad becomes an empty pad',
      normaliseSlots(['nonsense', 42, {}, null])[0] === null);
    check('a non-array is eight empty pads',
      normaliseSlots('what' as any).length === 8);
    check('more than eight is trimmed',
      normaliseSlots(Array(20).fill(chord(60))).length === 8);
  }

  console.log('\n=== The stored list survives being mangled ===');
  {
    check('nothing stored is an empty list', parseSnapshots(null).length === 0);
    check('unparseable JSON is an empty list', parseSnapshots('{{{').length === 0);
    check('a non-array is an empty list', parseSnapshots('{"a":1}').length === 0);
    const mixed = parseSnapshots(JSON.stringify([
      { id: 'a', name: 'Good', saved: 5, params: {}, slots: [], rndmRequired: [] },
      null,
      { noName: true },
      { id: 'b', name: 'Also Good', saved: 6, params: {}, slots: [], rndmRequired: [] },
    ]));
    check('a broken entry is dropped without taking the rest with it',
      mixed.length === 2 && mixed[0].name === 'Good' && mixed[1].name === 'Also Good',
      `${mixed.map(m => m.name)}`);
    const noId = parseSnapshots(JSON.stringify([{ name: 'Nameless Id', params: {} }]));
    check('an entry without an id is given one', !!noId[0].id);
  }

  console.log('\n=== The name is the identity ===');
  {
    const a = captureSnapshot('Pads', defaultParams, eightPads(), []);
    const b = captureSnapshot('Lead', defaultParams, eightPads(), []);
    let list = withSnapshot(withSnapshot([], a), b);
    check('two names, two setups', list.length === 2);

    const again = captureSnapshot('pads', { ...defaultParams, chordInversion: 5 }, eightPads(), []);
    list = withSnapshot(list, again);
    check('saving the same name replaces rather than duplicating', list.length === 2);
    check('and the replacement is what is now stored',
      list.find(s => s.name.toLowerCase() === 'pads')!.params.chordInversion === 5);
    check('while keeping the row it replaced, so the list does not jump about',
      list.find(s => s.name.toLowerCase() === 'pads')!.id === a.id);
  }

  console.log('\n=== Renaming and deleting ===');
  {
    const a = captureSnapshot('One', defaultParams, eightPads(), []);
    const b = captureSnapshot('Two', defaultParams, eightPads(), []);
    const list = [a, b];

    check('a rename lands', renameSnapshot(list, a.id, 'Uno').find(s => s.id === a.id)!.name === 'Uno');
    check('renaming onto a name already taken is refused, not merged',
      renameSnapshot(list, a.id, 'Two').find(s => s.id === a.id)!.name === 'One');
    check('a blank rename is refused',
      renameSnapshot(list, a.id, '   ').find(s => s.id === a.id)!.name === 'One');
    check('deleting removes exactly one', removeSnapshot(list, a.id).length === 1);
    check('deleting something absent changes nothing', removeSnapshot(list, 'nope').length === 2);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
