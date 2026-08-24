import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import {
  DEFAULT_COLOUR_MATRIX, TENSIONS, colourTensionsFor, parseColourMatrix, qualityOf,
} from '../src/lib/ChordColour.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

const pcs = (...xs: number[]) => new Set(xs);

console.log('\n=== Quality is read off the third and the seventh ===');
{
  check('major triad', qualityOf(pcs(0, 4, 7)) === 'major');
  check('major seventh is still major', qualityOf(pcs(0, 4, 7, 11)) === 'major');
  check('a flat seventh makes it dominant', qualityOf(pcs(0, 4, 7, 10)) === 'dominant');
  check('minor triad', qualityOf(pcs(0, 3, 7)) === 'minor');
  check('minor seventh is still minor', qualityOf(pcs(0, 3, 7, 10)) === 'minor');
  check('minor major is still minor', qualityOf(pcs(0, 3, 7, 11)) === 'minor');
  check('flat five with a minor third is diminished', qualityOf(pcs(0, 3, 6)) === 'dim');
  check('no third at all is sus', qualityOf(pcs(0, 5, 7)) === 'sus');
}

console.log('\n=== The matrix decides membership, the quality decides order ===');
{
  const m = parseColourMatrix(null);
  check('defaults are the ordinary sets', JSON.stringify(m) === JSON.stringify(DEFAULT_COLOUR_MATRIX));
  const dom = colourTensionsFor('dominant', m).map(t => t.id);
  check('a dominant reaches for its alterations', JSON.stringify(dom) === JSON.stringify(['b9', '#9', 'b13', '#11']), JSON.stringify(dom));

  // Unticking one closes the gap rather than leaving a hole.
  const trimmed = { ...m, dominant: ['#9', 'b13', '#11'] };
  const after = colourTensionsFor('dominant', trimmed).map(t => t.id);
  check('unticking moves the rest up', JSON.stringify(after) === JSON.stringify(['#9', 'b13', '#11']), JSON.stringify(after));

  // The user's example: a natural sixth on minor chords instead of a flat one.
  const sixth = { ...m, minor: ['b7', '9', '6'] };
  const minorIds = colourTensionsFor('minor', sixth).map(t => t.id);
  check('a minor chord can be told to take a natural sixth', minorIds.includes('6'), JSON.stringify(minorIds));
  check('and the order still follows the quality', JSON.stringify(minorIds) === JSON.stringify(['b7', '9', '6']), JSON.stringify(minorIds));

  check('every tension has a distinct interval',
    new Set(TENSIONS.map(t => t.interval)).size === TENSIONS.length);
  check('a broken matrix falls back rather than throwing',
    JSON.stringify(parseColourMatrix('not json')) === JSON.stringify(DEFAULT_COLOUR_MATRIX));
}

console.log('\n=== The engine follows the matrix ===');
{
  const chordOf = (over: any, mods: (e: any) => void) => {
    const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, chordMaxNotes: 8, ...over });
    const ons: number[] = [];
    e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
    mods(e);
    e.handleMidi(60, 100, true);
    return [...new Set(ons)].sort((a, b) => a - b).map(p => ((p - 60) % 12 + 12) % 12);
  };
  const minorTriad = (e: any) => e.setModifiers(1, false, false, false, false);
  const domChord = (e: any) => e.setModifiers(0, true, false, false, false); // major 3rd + b7

  // Default: minor takes a natural eleventh at step three.
  const def3 = chordOf({ chordColor: 3 }, minorTriad);
  check('minor takes b7, 9 then 11 by default', def3.includes(10) && def3.includes(2) && def3.includes(5),
    JSON.stringify(def3));

  // Told to take a sixth instead of the eleventh.
  const sixthMatrix = JSON.stringify({ ...DEFAULT_COLOUR_MATRIX, minor: ['b7', '9', '6'] });
  const withSixth = chordOf({ chordColor: 3, chordColorMatrix: sixthMatrix }, minorTriad);
  check('now it takes the sixth', withSixth.includes(9), JSON.stringify(withSixth));
  check('and not the eleventh', !withSixth.includes(5), JSON.stringify(withSixth));

  // Dominants: choose which ninth.
  const naturalNine = JSON.stringify({ ...DEFAULT_COLOUR_MATRIX, dominant: ['9', '13'] });
  const dom = chordOf({ chordColor: 2, chordColorMatrix: naturalNine }, domChord);
  check('a dominant can be told to take the natural ninth', dom.includes(2), JSON.stringify(dom));
  check('and not the flat one', !dom.includes(1), JSON.stringify(dom));
  check('nor the sharp one', !dom.includes(3), JSON.stringify(dom));

  // Nothing ticked means nothing added.
  const bare = JSON.stringify({ ...DEFAULT_COLOUR_MATRIX, minor: [] });
  // Compared as a chord: a played voicing states the same three tones across
  // more than one octave, so the list of pitch classes is what matters.
  const bareOut = [...new Set(chordOf({ chordColor: 4, chordColorMatrix: bare }, minorTriad))].sort((a, b) => a - b);
  check('an empty row adds nothing', JSON.stringify(bareOut) === JSON.stringify([0, 3, 7]), JSON.stringify(bareOut));

  // Still never two sevenths at once.
  const bothSevenths = JSON.stringify({ ...DEFAULT_COLOUR_MATRIX, dominant: ['maj7', 'b9'] });
  const guarded = chordOf({ chordColor: 2, chordColorMatrix: bothSevenths }, domChord);
  check('a major seventh is still refused on a dominant', !guarded.includes(11), JSON.stringify(guarded));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(0);
