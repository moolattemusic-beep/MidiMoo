/**
 * PLAYING STYLE: the chord a keyboard player would reach for, given the one that
 * was written.
 *
 * The point of it is the written chord — a pad that says C or Am. COLOUR never
 * reached those at all: it was applied where a chord is built from the MAJOR and
 * MINOR buttons, and a chord that arrives with its own intervals skips that
 * entirely. So every check here drives the engine the way a pad does, with a
 * chord symbol.
 */
import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { parseChordSymbol } from '../src/lib/ChordSymbol.ts';
import { CHORD_PRESETS } from '../src/lib/ChordPresets.ts';
import { PLAY_STYLES, isAlteredChord } from '../src/lib/ChordColour.ts';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
};

const STYLES = PLAY_STYLES.map(s => s.id);

/** A written chord, played as a pad plays it. */
function sound(symbol: string, over: Record<string, unknown> = {}): number[] {
  const parsed = parseChordSymbol(symbol)!;
  const engine = new OrchidEngine({
    ...defaultParams, mpeEnabled: false, strumEngine: 0, autoBassRegister: 0,
    patternEnabled: false, chordMaxNotes: 6, chordRegisterStart: 48, ...over,
  } as any);
  const heard: number[] = [];
  engine.onOutputNote = (e: any) => {
    if (e.isCC || e.isExpression || e.isPitchBend) return;
    if (e.isOn && e.velocity > 0) heard.push(e.pitch);
  };
  engine.handleMidi(60 + parsed.root, 100, true, false, false, false, true, undefined, parsed.intervals, 0);
  return [...new Set(heard)].sort((a, b) => a - b);
}
const tonesOf = (pitches: number[], root: number) =>
  [...new Set(pitches.map(p => (((p - root) % 12) + 12) % 12))].sort((a, b) => a - b);
const tones = (symbol: string, style: string, over: Record<string, unknown> = {}) =>
  tonesOf(sound(symbol, { playStyle: style, ...over }), 60 + parseChordSymbol(symbol)!.root);

console.log('\n=== A written triad, which is what the pads are full of ===');
{
  check('NORMAL plays C as the three notes it says', JSON.stringify(tones('C', 'normal')) === JSON.stringify([0, 4, 7]),
    JSON.stringify(tones('C', 'normal')));
  check('POP makes it an add9', tones('C', 'pop').includes(2), JSON.stringify(tones('C', 'pop')));
  check('and POP puts no seventh on it',
    !tones('C', 'pop').includes(10) && !tones('C', 'pop').includes(11), JSON.stringify(tones('C', 'pop')));
  check('GOSPEL reaches further than POP',
    tones('C', 'gospel').length > tones('C', 'pop').length,
    `${JSON.stringify(tones('C', 'pop'))} -> ${JSON.stringify(tones('C', 'gospel'))}`);
  check('and GOSPEL still adds no seventh to a plain triad',
    !tones('C', 'gospel').includes(11) && !tones('C', 'gospel').includes(10), JSON.stringify(tones('C', 'gospel')));
  check('JAZZ adds the seventh itself', tones('C', 'jazz').includes(11), JSON.stringify(tones('C', 'jazz')));
  check('Am in JAZZ is an Am9, flat seventh and all',
    tones('Am', 'jazz').includes(10) && tones('Am', 'jazz').includes(2), JSON.stringify(tones('Am', 'jazz')));
  check('Am in POP keeps its plain minor seventh out of it',
    !tones('Am', 'pop').includes(10), JSON.stringify(tones('Am', 'pop')));
  check('every style still states the chord that was written',
    STYLES.every(s => [0, 4, 7].every(t => tones('C', s).includes(t))),
    STYLES.map(s => `${s}:${JSON.stringify(tones('C', s))}`).join(' '));
}

console.log('\n=== What a style will not touch ===');
{
  const altered = ['C7b9', 'C7#9', 'C7#11', 'Cm7b5'];
  for (const symbol of altered) {
    const parsed = parseChordSymbol(symbol)!;
    check(`${symbol} is read as altered`, isAlteredChord(new Set(parsed.intervals.map(i => ((i % 12) + 12) % 12))));
    check(`${symbol} sounds the same in every style`,
      STYLES.every(s => sound(symbol, { playStyle: s }).join() === sound(symbol, { playStyle: 'normal' }).join()),
      STYLES.map(s => `${s}:${sound(symbol, { playStyle: s }).join()}`).join(' | '));
  }
}
{
  // MAX NOTES is the ceiling: the written notes are never dropped for colour.
  const four = tones('Cmaj7', 'jazz', { chordMaxNotes: 4 });
  check('at MAX NOTES 4 a written seventh chord keeps all four of its notes',
    [0, 4, 7, 11].every(t => four.includes(t)), JSON.stringify(four));
  const tight = tones('C', 'jazz', { chordMaxNotes: 3 });
  check('with no room at all, a style adds nothing',
    tight.every(t => [0, 4, 7].includes(t)), JSON.stringify(tight));
}

console.log('\n=== NORMAL is the instrument as it was ===');
{
  const written = CHORD_PRESETS.flatMap(p => p.chords).map(c => c.symbol)
    .map(s => parseChordSymbol(s) ? s : null).filter((s): s is string => !!s);
  const unchanged = written.filter(symbol => {
    const parsed = parseChordSymbol(symbol)!;
    const want = [...new Set(parsed.intervals.map(i => ((i % 12) + 12) % 12))].sort((a, b) => a - b);
    return JSON.stringify(tones(symbol, 'normal')) === JSON.stringify(want);
  });
  check(`NORMAL adds nothing to any of ${written.length} written chords`,
    unchanged.length === written.length, `${written.length - unchanged.length} differ`);
}

console.log('\n=== How far the styles reach ===');
{
  const symbols = [...new Set(CHORD_PRESETS.flatMap(p => p.chords).map(c => c.symbol))]
    .filter(s => parseChordSymbol(s));
  for (const style of STYLES) {
    if (style === 'normal') continue;
    const richer = symbols.filter(s => tones(s, style).length > tones(s, 'normal').length).length;
    const same = symbols.length - richer;
    console.log(`     ${style.padEnd(7)} enriches ${richer} of ${symbols.length} written chords (${same} left as written)`);
    check(`${style} reaches a good share of them`, richer > symbols.length * 0.2, `${richer}/${symbols.length}`);
  }
  const plain = ['C', 'Am', 'F', 'G', 'Em', 'Dm', 'Bb', 'Gm'];
  for (const style of STYLES) {
    if (style === 'normal') continue;
    check(`${style} spices up every plain triad`,
      plain.every(s => tones(s, style).length > 3),
      plain.map(s => `${s}:${tones(s, style).length}`).join(' '));
  }
}

console.log('\n=== It is still the instrument underneath ===');
{
  check('nothing leaves RANGE',
    STYLES.every(s => sound('Cmaj7', { playStyle: s, outputRangeLow: 48, outputRangeHigh: 72 })
      .every(p => p >= 48 && p <= 72)));
  check('a style is deterministic', sound('F', { playStyle: 'jazz' }).join() === sound('F', { playStyle: 'jazz' }).join());
  check('the register still decides where it sits',
    Math.min(...sound('C', { playStyle: 'gospel', chordRegisterStart: 60 }))
      > Math.min(...sound('C', { playStyle: 'gospel', chordRegisterStart: 48 })));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
