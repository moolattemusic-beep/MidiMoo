import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { CHORD_SCALES, qualityOf } from '../src/lib/ChordColour.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const rig = (over: any = {}) => {
  const e = new OrchidEngine({ ...defaultParams, mpeEnabled: false, autoBassRegister: 0, ...over });
  e.onOutputNote = () => {};
  return e;
};
/** The pitch classes the pad offers while a chord is held. */
const padClasses = async (e: any, key: number, intervals: number[]): Promise<number[]> => {
  e.handleMidi(key, 100, true, false, false, false, true, undefined, intervals);
  await sleep(90);
  const classes: number[] = e.getArpeggioSequence().map((p: number) => ((p % 12) + 12) % 12);
  return [...new Set(classes)].sort((a, b) => a - b);
};

(async () => {
  console.log('\n=== Off, the pad is the chord ===');
  {
    const e = rig({ arpeggioScale: false });
    const got = await padClasses(e, 60, [0, 4, 7, 11]);   // Cmaj7
    check('only the chord tones are offered', got.join() === '0,4,7,11', `${got}`);
    e.panic();
  }

  console.log('\n=== On, the pad is the scale the chord implies ===');
  {
    const e = rig({ arpeggioScale: true });
    const got = await padClasses(e, 60, [0, 4, 7, 11]);   // Cmaj7 -> Ionian
    check('a major seventh gets its own major scale',
      got.join() === CHORD_SCALES.major.join(), `${got}`);
    check('and the chord is still in there', [0, 4, 7, 11].every(pc => got.includes(pc)), `${got}`);
    e.panic();
  }
  {
    const e = rig({ arpeggioScale: true });
    const got = await padClasses(e, 60, [0, 3, 7, 10]);   // Cmin7 -> Dorian
    check('a minor seventh gets Dorian', got.join() === CHORD_SCALES.minor.join(), `${got}`);
    // The point of not reusing RNDM's tables: its minor scale has ten notes.
    check('which is seven notes, not ten', got.length === 7, `${got.length}`);
    e.panic();
  }
  {
    const e = rig({ arpeggioScale: true });
    const got = await padClasses(e, 60, [0, 4, 7, 10]);   // C7 -> Mixolydian
    check('a dominant gets Mixolydian', got.join() === CHORD_SCALES.dominant.join(), `${got}`);
    check('which is seven notes, not eleven', got.length === 7, `${got.length}`);
    e.panic();
  }
  {
    const e = rig({ arpeggioScale: true });
    const got = await padClasses(e, 60, [0, 5, 7]);       // Csus4
    check('a sus chord is not given a third',
      !got.includes(3) && !got.includes(4), `${got.map(pc => NAMES[pc])}`);
    e.panic();
  }
  {
    const e = rig({ arpeggioScale: true });
    // A diminished seventh states a note Locrian does not have. Losing it to
    // the scale would be losing the chord.
    const got = await padClasses(e, 60, [0, 3, 6, 9]);
    check('a chord tone the scale lacks is kept anyway', got.includes(9), `${got}`);
    check('alongside the scale', CHORD_SCALES.dim.every(pc => got.includes(pc)), `${got}`);
    e.panic();
  }
  {
    // The scale follows the chord's root, not the key of C.
    const e = rig({ arpeggioScale: true });
    const got = await padClasses(e, 62, [0, 3, 7, 10]);   // Dmin7 -> D Dorian
    const expected = CHORD_SCALES.minor.map(step => (2 + step) % 12).sort((a, b) => a - b);
    check('the scale is built on the chord it is under', got.join() === expected.join(),
      `${got.map(pc => NAMES[pc])} vs ${expected.map(pc => NAMES[pc])}`);
    e.panic();
  }

  console.log('\n=== Chord tones stay dominant ===');
  {
    const e = rig({ arpeggioScale: true, arpeggioNoteLengthMs: 40, velHumanize: 0 });
    const struck: Array<{ pitch: number; velocity: number }> = [];
    e.onOutputNote = (ev: any) => {
      if (ev.isCC || ev.isPitchBend || ev.isExpression || !ev.isOn) return;
      struck.push({ pitch: ev.pitch, velocity: ev.velocity });
    };
    e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7, 11]);
    await sleep(90);
    const chordTones = e.getArpeggioChordTones();
    check('the pad knows which notes are the chord', chordTones.sort((a: number, b: number) => a - b).join() === '0,4,7,11', `${chordTones}`);

    struck.length = 0;
    for (const pitch of e.getArpeggioSequence().slice(0, 7)) {
      e.handleArpeggioNoteOn(pitch, 110);
      await sleep(15);
    }
    await sleep(80);
    const inChord = struck.filter(n => chordTones.includes(((n.pitch % 12) + 12) % 12));
    const passing = struck.filter(n => !chordTones.includes(((n.pitch % 12) + 12) % 12));
    check('both kinds were struck', inChord.length > 0 && passing.length > 0, `${inChord.length}/${passing.length}`);
    check('and the passing notes are quieter',
      Math.max(...passing.map(n => n.velocity)) < Math.min(...inChord.map(n => n.velocity)),
      `chord ${inChord.map(n => n.velocity)} passing ${passing.map(n => n.velocity)}`);
    e.panic();
  }
  {
    // With SCALE off there is no such thing as a passing note: everything the
    // pad offers belongs to the chord, so there is nothing to soften.
    const e = rig({ arpeggioScale: false });
    e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7, 11]);
    await sleep(90);
    const raw: number[] = e.getArpeggioSequence().map((p: number) => ((p % 12) + 12) % 12);
    const classes = [...new Set(raw)];
    const chordTones: number[] = e.getArpeggioChordTones();
    check('every note the pad offers is a chord tone',
      classes.every(pc => chordTones.includes(pc)), `${classes} vs ${chordTones}`);
    e.panic();
  }

  console.log('\n=== Where there is no root ===');
  {
    // Free mode has no chord to take a root from: the keys are the notes. A
    // scale would be a key the player never chose.
    const e = rig({ arpeggioScale: true, keyboardMapping: 3 });
    e.handleMidi(60, 100, true);
    await sleep(60);
    e.handleMidi(64, 100, true);
    await sleep(90);
    const raw: number[] = e.getArpeggioSequence().map((p: number) => ((p % 12) + 12) % 12);
    const got = [...new Set(raw)];
    check('free mode is left on what is actually held', got.length <= 3, `${got}`);
    e.panic();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
