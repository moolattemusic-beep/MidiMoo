import { alterationReference, chordSymbolReference, parseChordSymbol } from '../src/lib/ChordSymbol.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

/**
 * The reference is generated from the parser's own tables, so the thing worth
 * testing is that it stays true: everything it offers must parse, and must
 * parse to what it claims.
 */
console.log('\n=== Everything the reference offers is accepted ===');
{
  const entries = chordSymbolReference();
  check('it lists something', entries.length > 8, `${entries.length}`);

  const broken: string[] = [];
  for (const entry of entries) {
    for (const spelling of entry.spellings) {
      const symbol = 'C' + (spelling === '(nothing)' ? '' : spelling);
      const parsed = parseChordSymbol(symbol);
      if (!parsed) { broken.push(`${symbol} does not parse`); continue; }
      if (parsed.intervals.join() !== entry.intervals.join()) {
        broken.push(`${symbol} -> ${parsed.intervals} not ${entry.intervals}`);
      }
    }
  }
  check('every spelling parses to what it claims', broken.length === 0, broken.slice(0, 4).join(' | '));

  const shapes = entries.map(e => e.intervals.join());
  check('synonyms are collected rather than repeated', new Set(shapes).size === shapes.length, '');
  check('the notes are spelled out for reading',
    entries.every(e => /^[A-G]/.test(e.notes) && e.notes.split(' ').length === e.intervals.length), '');
  const majorSeventh = entries.find(e => e.intervals.join() === '0,4,7,11');
  check('a major seventh is described from C', majorSeventh?.notes === 'C E G B', `${majorSeventh?.notes}`);
}

console.log('\n=== And every alteration it offers works ===');
{
  const alterations = alterationReference();
  check('it lists something', alterations.length > 8, `${alterations.length}`);
  const broken: string[] = [];
  for (const { spelling, semitones } of alterations) {
    const parsed = parseChordSymbol(`C7(${spelling})`);
    if (!parsed) { broken.push(`C7(${spelling})`); continue; }
    if (!parsed.intervals.includes(semitones)) broken.push(`C7(${spelling}) lacks ${semitones}`);
  }
  check('each one parses and adds the interval it claims', broken.length === 0, broken.slice(0, 4).join(' | '));
  check('they are listed in pitch order',
    alterations.every((a, i) => i === 0 || alterations[i - 1].semitones <= a.semitones), '');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
