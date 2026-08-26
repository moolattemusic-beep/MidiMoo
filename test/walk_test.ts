import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * WALK turns the keys above the split into moves rather than pitches. What is
 * being checked is that a key's distance from the anchor is counted in chord
 * tones, not semitones — that is the whole mechanic, and it is what lets two
 * fingers reach the far end of the keyboard.
 */
const rig = (over: any = {}) => {
  const e = new OrchidEngine({
    ...defaultParams, keyboardMapping: 4, walkSplit: 60, mpeEnabled: false,
    autoBassRegister: 0, voicingPlayed: false, arpeggioScale: false,
    strumEngine: 0, ...over,
  });
  const on: number[] = [], off: number[] = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isCC || ev.isPitchBend || ev.isExpression) return;
    (ev.isOn ? on : off).push(ev.pitch);
  };
  return { e, on, off };
};

/** Hold a chord on the keys below the split, which is what sets the tones. */
const holdChord = async (e: any, key: number, intervals: number[]) => {
  e.handleMidi(key, 100, true, false, false, false, true, undefined, intervals);
  await sleep(70);
};
const press = (e: any, pitch: number) => e.handleMidi(pitch, 100, true);
const lift = (e: any, pitch: number) => e.handleMidi(pitch, 0, false);

(async () => {
  console.log('\n=== C is the root, whatever the chord ===');
  {
    // The fingering for a shape should be the same in any key, so C stands for
    // the root of whatever is held rather than for the note C.
    for (const [key, intervals, root] of [[48, [0, 4, 7], 0], [50, [0, 3, 7], 2], [55, [0, 4, 7, 10], 7]] as Array<[number, number[], number]>) {
      const { e, on } = rig();
      await holdChord(e, key, intervals);
      on.length = 0;
      press(e, 72); await sleep(45);
      check(`C starts on the root of the chord held (${['C','','D','','','','','G'][root]})`,
        on[0] !== undefined && ((on[0] % 12) + 12) % 12 === root, `${on[0]} pc=${on[0] % 12}, wanted ${root}`);
      e.panic();
    }
  }
  {
    const { e, on } = rig();
    await holdChord(e, 50, [0, 3, 7]);      // D minor
    on.length = 0;
    press(e, 72); await sleep(40);          // C is the root, D
    press(e, 76); await sleep(40);          // E is two white keys up
    check('two white keys up is two tones up', on[1] > on[0], `${on}`);
    check('and both belong to the chord',
      on.every(p => [2, 5, 9].includes(((p % 12) + 12) % 12)), `${on.map(p => p % 12)}`);
    e.panic();
  }
  {
    const { e, on } = rig();
    await holdChord(e, 48, [0, 4, 7]);
    on.length = 0;
    press(e, 73); await sleep(40);          // a black key
    check('black keys take no part', on.length === 0, `${on}`);
    press(e, 72); await sleep(40);
    press(e, 75); await sleep(40);          // another black key
    check('and do not move the cursor either', on.length === 1, `${on}`);
    e.panic();
  }

  console.log('\n=== A key is a move, not a pitch ===');
  {
    const { e, on } = rig();
    await holdChord(e, 48, [0, 4, 7]);        // a C major triad, below the split
    on.length = 0;
    press(e, 72); await sleep(40);             // the anchor
    const anchor = on[0];
    press(e, 74); await sleep(40);             // a second above it
    check('the anchor sounds the root', anchor !== undefined && ((anchor % 12) + 12) % 12 === 0, `${anchor}`);
    // On a triad, one rung is a chord tone away — not a semitone.
    check('a step moves by a chord tone, not a semitone',
      on[1] !== undefined && on[1] - anchor > 2, `${anchor} -> ${on[1]}`);
    e.panic();
  }
  {
    const { e, on } = rig();
    await holdChord(e, 48, [0, 4, 7]);
    on.length = 0;
    press(e, 72); await sleep(40);
    // Pressing the same key again moves again: the cursor accumulates.
    press(e, 74); await sleep(40);
    press(e, 74); await sleep(40);
    press(e, 74); await sleep(40);
    check('pressing the same key walks each time', on.length === 4, `${on}`);
    check('and keeps going the same way',
      on[1] < on[2] && on[2] < on[3], `${on}`);
    // Two fingers, and it has travelled well past where either of them is.
    check('two fingers reach beyond either of them', on[3] > 74 + 6, `${on}`);
    e.panic();
  }
  {
    const { e, on } = rig();
    await holdChord(e, 48, [0, 4, 7]);
    on.length = 0;
    press(e, 72); await sleep(40);
    press(e, 69); await sleep(40);             // below the anchor
    check('a key below the anchor walks downward', on[1] < on[0], `${on}`);
    e.panic();
  }
  {
    // A wider interval is a bigger move: a third from the anchor is two tones.
    const { e, on } = rig();
    await holdChord(e, 48, [0, 4, 7]);
    on.length = 0;
    press(e, 72); await sleep(40);
    press(e, 76); await sleep(40);
    const wide = on[1] - on[0];
    e.panic();

    const second = rig();
    await holdChord(second.e, 48, [0, 4, 7]);
    second.on.length = 0;
    press(second.e, 72); await sleep(40);
    press(second.e, 74); await sleep(40);
    const narrow = second.on[1] - second.on[0];
    check('a wider interval from the anchor travels further', wide > narrow, `${wide} vs ${narrow}`);
    second.e.panic();
  }

  console.log('\n=== The chord decides the tones ===');
  {
    const { e, on } = rig();
    await holdChord(e, 48, [0, 3, 7, 10]);     // C minor seventh
    on.length = 0;
    press(e, 72); await sleep(40);
    for (const key of [74, 74, 74, 74]) { press(e, key); await sleep(35); }
    check('every note walked belongs to the chord',
      on.every(p => [0, 3, 7, 10].includes(((p % 12) + 12) % 12)), `${on.map(p => p % 12)}`);
    e.panic();
  }
  {
    // One white key up is one tone up either way; what changes is which tones
    // there are. On a triad that is a third, on its scale a second.
    const chordOnly = rig();
    await holdChord(chordOnly.e, 48, [0, 4, 7]);
    chordOnly.on.length = 0;
    press(chordOnly.e, 72); await sleep(40);
    press(chordOnly.e, 74); await sleep(40);
    const triadStep = chordOnly.on[1] - chordOnly.on[0];
    chordOnly.e.panic();

    const scaled = rig({ arpeggioScale: true });
    await holdChord(scaled.e, 48, [0, 4, 7]);
    scaled.on.length = 0;
    press(scaled.e, 72); await sleep(40);
    press(scaled.e, 74); await sleep(40);
    const scaleStep = scaled.on[1] - scaled.on[0];
    check('a step on a triad is a third', triadStep === 4, `${triadStep}`);
    check('and on its scale a second', scaleStep === 2, `${scaleStep}`);
    scaled.e.panic();
  }

  console.log('\n=== Letting go of the anchor ===');
  {
    const { e, on, off } = rig();
    await holdChord(e, 48, [0, 4, 7]);
    on.length = 0;
    press(e, 72); await sleep(35);
    press(e, 76); await sleep(35);             // still holding both
    lift(e, 72); await sleep(35);              // the anchor goes, 76 stays
    const before = on.length;
    press(e, 74); await sleep(40);
    check('the run carries on after the anchor is released', on.length > before, `${on}`);
    // The anchor is now 76, so a key below it turns the run around.
    check('and turns around from the new anchor', on[on.length - 1] < on[before - 1], `${on}`);
    e.panic();
  }
  {
    const { e, on, off } = rig();
    await holdChord(e, 48, [0, 4, 7]);
    on.length = 0;
    press(e, 72); await sleep(35);
    press(e, 74); await sleep(35);
    lift(e, 74); await sleep(35);
    lift(e, 72); await sleep(60);
    const stuck = [...new Set(on)].filter(p => on.filter(x => x === p).length !== off.filter(x => x === p).length);
    check('letting go of everything leaves nothing sounding', stuck.length === 0, `${stuck}`);
    e.panic();
  }

  console.log('\n=== Below the split it is still a keyboard ===');
  {
    const { e, on } = rig();
    on.length = 0;
    e.handleMidi(48, 100, true, false, false, false, true, undefined, [0, 4, 7]);
    await sleep(70);
    check('a key below the split plays a chord', on.length >= 3, `${on}`);
    e.panic();
  }
  {
    // Nothing held means nothing to walk over, and it stays quiet rather than
    // guessing a key.
    const { e, on } = rig();
    on.length = 0;
    press(e, 72); await sleep(60);
    check('with no chord held it stays silent', on.length === 0, `${on}`);
    e.panic();
  }

  console.log('\n=== Walking a chord ===');
  {
    const { e, on } = rig({ walkChord: true });
    await holdChord(e, 48, [0, 4, 7]);
    on.length = 0;
    press(e, 72); await sleep(50);
    const first = [...on];
    press(e, 74); await sleep(50);
    const second = on.slice(first.length);
    check('the anchor sounds a chord rather than a note', first.length >= 3, `${first}`);
    check('and the whole chord moves', second.length === first.length, `${first} -> ${second}`);
    check('every voice goes up', second.every((p, i) => p > first[i]), `${first} -> ${second}`);
    check('and stays inside the chord',
      second.every(p => [0, 4, 7].includes(((p % 12) + 12) % 12)), `${second.map(p => p % 12)}`);
    // Each voice moves one rung, and a rung is not the same number of semitones
    // everywhere in a chord — moving them all by the same distance would be
    // parallel motion, which is the thing diatonic voice leading is not.
    const moves = second.map((p, i) => p - first[i]);
    check('each voice moves a rung rather than a fixed distance',
      new Set(moves).size > 1, `${moves}`);
    check('and each lands where the voice above it was',
      second.slice(0, -1).every((p, i) => p === first[i + 1]), `${first} -> ${second}`);
    e.panic();
  }

  console.log('\n=== Nothing escapes RANGE ===');
  {
    const { e, on } = rig({ outputRangeLow: 60, outputRangeHigh: 72 });
    await holdChord(e, 48, [0, 4, 7]);
    on.length = 0;
    press(e, 72); await sleep(35);
    for (let i = 0; i < 8; i++) { press(e, 79); await sleep(30); }
    check('walking far still leaves nothing outside the range',
      on.every(p => p >= 60 && p <= 72), `${on}`);
    e.panic();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
