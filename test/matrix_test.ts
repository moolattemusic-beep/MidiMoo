import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import {
  DEFAULT_COLOUR_MATRIX, TENSIONS, colourTensionsFor, isAlteredChord, parseColourMatrix,
  qualityOf, styleTensionsFor,
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
  check('a dominant may take its alterations and its plain tensions',
    JSON.stringify(dom) === JSON.stringify(['b9', '#9', 'b13', '#11', '9', '13']), JSON.stringify(dom));

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

  // Default: JAZZ reaches for a flat seventh, then a ninth, then an eleventh. How
  // many of them actually sound is the shape's business — the style says what is
  // welcome, and a voicing somebody played decides how far it goes.
  const jazzMinor = chordOf({ playStyle: 'jazz' }, minorTriad);
  check('JAZZ reaches the flat seventh and the ninth on a minor chord',
    jazzMinor.includes(10) && jazzMinor.includes(2), JSON.stringify(jazzMinor));

  // Unticking takes a tension away from every style.
  const noSeventh = JSON.stringify({ ...DEFAULT_COLOUR_MATRIX, minor: ['9', '11', '13'] });
  const trimmedOut = chordOf({ playStyle: 'jazz', chordColorMatrix: noSeventh }, minorTriad);
  check('unticking the flat seventh takes it away from the style', !trimmedOut.includes(10), JSON.stringify(trimmedOut));
  check('and what is left still arrives', trimmedOut.includes(2), JSON.stringify(trimmedOut));

  // The ticks can only take away: what a style reaches for is its own.
  const withSixth = JSON.stringify({ ...DEFAULT_COLOUR_MATRIX, minor: ['b7', '9', '11', '6'] });
  const sixthOut = chordOf({ playStyle: 'jazz', chordColorMatrix: withSixth }, minorTriad);
  check('ticking one a style never asks for adds nothing', !sixthOut.includes(9), JSON.stringify(sixthOut));

  // Nothing ticked means the style adds nothing. Asked of a written chord,
  // because a chord played by hand has no spelling to honour and the library has
  // always been free to bring a tone of its own to one of those.
  const written = (over: any) => {
    const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, chordMaxNotes: 8, ...over } as any);
    const ons: number[] = [];
    e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
    e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 3, 7]);
    return [...new Set(ons.map(p => ((p - 60) % 12 + 12) % 12))].sort((a, b) => a - b);
  };
  const bare = JSON.stringify({ ...DEFAULT_COLOUR_MATRIX, minor: [] });
  const bareOut = written({ playStyle: 'jazz', chordColorMatrix: bare });
  check('an empty row adds nothing', JSON.stringify(bareOut) === JSON.stringify([0, 3, 7]), JSON.stringify(bareOut));
  const allowed = written({ playStyle: 'jazz' });
  check('and with the row left alone the style does add', allowed.length > bareOut.length,
    JSON.stringify(allowed));

  // NORMAL is the chord as written, whatever is ticked.
  const normalOut = [...new Set(chordOf({ playStyle: 'normal' }, minorTriad))].sort((a, b) => a - b);
  check('NORMAL adds nothing at all', JSON.stringify(normalOut) === JSON.stringify([0, 3, 7]), JSON.stringify(normalOut));

  // A dominant keeps its own seventh: a style is never allowed to put the other
  // one against it, whatever the tables say.
  const guarded = styleTensionsFor('major', 'jazz', parseColourMatrix(null), new Set([0, 4, 7, 10])).map(t => t.id);
  check('a major seventh is refused over a flat one', !guarded.includes('maj7'), JSON.stringify(guarded));
  const ninths = styleTensionsFor('dominant', 'jazz', parseColourMatrix(null), new Set([0, 4, 7, 10, 2])).map(t => t.id);
  check('and a ninth is never doubled', !ninths.includes('9'), JSON.stringify(ninths));

  // An altered chord is the writer being specific, and is left alone.
  check('a flat ninth marks the chord as altered', isAlteredChord(new Set([0, 4, 7, 10, 1])));
  check('a sharp ninth over a major third too', isAlteredChord(new Set([0, 4, 7, 10, 3])));
  check('a flat fifth too', isAlteredChord(new Set([0, 3, 6, 10])));
  check('a plain major seventh is not altered', !isAlteredChord(new Set([0, 4, 7, 11])));
  check('nor is a sixth', !isAlteredChord(new Set([0, 4, 7, 9])));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(0);
