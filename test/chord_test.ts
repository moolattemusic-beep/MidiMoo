import { parseChordSymbol, parseProgression, pitchClassName } from '../src/lib/ChordSymbol.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

const NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const spell = (root: number, iv: number[]) => iv.map(i => NAMES[(root + i) % 12]).join(' ');

function main() {
  console.log("=== The user's actual sample ===");
  const sample = 'Cmin(b6) Gb7(#11) Dbmaj7 Ebmin(6) Gmin(b9) Abmaj9 E9(b13) F7(#9)';
  const { chords, rejected } = parseProgression(sample);
  check('all 8 symbols parsed', chords.length === 8 && rejected.length === 0, `got ${chords.length}, rejected ${rejected}`);
  for (const c of chords) {
    console.log(`   ${c.symbol.padEnd(10)} root ${pitchClassName(c.root).padEnd(2)}  [${c.intervals.join(', ')}]  = ${spell(c.root, c.intervals)}`);
  }

  console.log('\n=== Expected spellings ===');
  const expect: Record<string, number[]> = {
    'Cmin(b6)': [0, 3, 7, 8],
    'Gb7(#11)': [0, 4, 7, 10, 18],
    'Dbmaj7': [0, 4, 7, 11],
    'Ebmin(6)': [0, 3, 7, 9],
    'Gmin(b9)': [0, 3, 7, 13],
    'Abmaj9': [0, 4, 7, 11, 14],
    'E9(b13)': [0, 4, 7, 10, 14, 20],
    'F7(#9)': [0, 4, 7, 10, 15],
  };
  for (const [sym, iv] of Object.entries(expect)) {
    const p = parseChordSymbol(sym);
    check(sym, !!p && JSON.stringify(p.intervals) === JSON.stringify(iv), `${p?.intervals}`);
  }

  console.log('\n=== Roots and accidentals ===');
  const roots: Array<[string, number]> = [['C',0],['C#',1],['Db',1],['D',2],['Eb',3],['E',4],['F',5],['F#',6],['Gb',6],['G',7],['Ab',8],['A',9],['Bb',10],['B',11]];
  for (const [name, pc] of roots) {
    const p = parseChordSymbol(name);
    check(`root ${name} = ${pc}`, !!p && p.root === pc, `${p?.root}`);
  }

  console.log('\n=== Qualities ===');
  const quals: Array<[string, number[]]> = [
    ['C', [0,4,7]], ['Cm', [0,3,7]], ['Cmin', [0,3,7]], ['C-', [0,3,7]],
    ['Cdim', [0,3,6]], ['Cdim7', [0,3,6,9]], ['Caug', [0,4,8]], ['C+', [0,4,8]],
    ['Csus2', [0,2,7]], ['Csus4', [0,5,7]], ['Csus', [0,5,7]],
    ['C7', [0,4,7,10]], ['C9', [0,4,7,10,14]], ['C11', [0,4,7,10,14,17]], ['C13', [0,4,7,10,14,21]],
    ['C6', [0,4,7,9]], ['Cm6', [0,3,7,9]], ['Cm7', [0,3,7,10]], ['Cm9', [0,3,7,10,14]],
    ['Cmaj7', [0,4,7,11]], ['Cmaj9', [0,4,7,11,14]],
  ];
  for (const [sym, iv] of quals) {
    const p = parseChordSymbol(sym);
    check(sym, !!p && JSON.stringify(p.intervals) === JSON.stringify(iv), `${p?.intervals}`);
  }

  console.log('\n=== Alterations replace rather than clash ===');
  {
    const b5 = parseChordSymbol('C7(b5)');
    check('b5 removes the natural 5th', !!b5 && !b5.intervals.includes(7) && b5.intervals.includes(6), `${b5?.intervals}`);
    const s9 = parseChordSymbol('C9(#9)');
    check('#9 replaces the natural 9th', !!s9 && !s9.intervals.includes(14) && s9.intervals.includes(15), `${s9?.intervals}`);
    const b6 = parseChordSymbol('Cmin(b6)');
    check('b6 keeps the 5th (it is a colour, not an alteration of 5)', !!b6 && b6.intervals.includes(7), `${b6?.intervals}`);
  }

  console.log('\n=== Rejects rather than guesses ===');
  for (const bad of ['H7', 'Cxyz', 'C(b17)', '', 'Cmin(', '7']) {
    check(`rejects ${JSON.stringify(bad)}`, parseChordSymbol(bad) === null, `${JSON.stringify(parseChordSymbol(bad))}`);
  }
  {
    const r = parseProgression('Cmaj7 NOPE Dm7');
    check('good symbols survive a bad one', r.chords.length === 2 && r.rejected.length === 1, `${r.chords.length}/${r.rejected}`);
    check('names the offender', r.rejected[0] === 'NOPE', `${r.rejected}`);
  }

  console.log('\n=== Separators and casing ===');
  check('comma separated', parseProgression('Cmaj7, Dm7, G7').chords.length === 3);
  check('pipe separated', parseProgression('Cmaj7 | Dm7 | G7').chords.length === 3);
  check('newlines', parseProgression('Cmaj7\nDm7\nG7').chords.length === 3);
  check('extra spaces', parseProgression('  Cmaj7   Dm7  ').chords.length === 2);
  check('lowercase root', parseChordSymbol('bb7')?.root === 10, `${parseChordSymbol('bb7')?.root}`);
  check('more than 8 chords all parse', parseProgression('C D E F G A B C D').chords.length === 9);

  console.log('\n=== No duplicate intervals, always sorted, root present ===');
  for (const sym of ['C13(b9)', 'Cmaj9', 'C7(#11)', 'Cmin(b6)', 'C9(b13)']) {
    const p = parseChordSymbol(sym)!;
    const sorted = [...p.intervals].sort((a, b) => a - b);
    check(`${sym}: sorted & unique & rooted`,
      JSON.stringify(p.intervals) === JSON.stringify(sorted) &&
      new Set(p.intervals).size === p.intervals.length &&
      p.intervals[0] === 0, `${p.intervals}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
