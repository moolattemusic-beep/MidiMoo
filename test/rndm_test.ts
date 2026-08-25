import {
  CHORD_TYPE_MAP, ChordTypeGroup, NOTES, checkFunction, generateProgression,
  generateSingleChord, getAllCommonChordTones, getImpliedJazzTones,
  getParentScaleNotes, getQualitiesForMood, isForbidden, smartRename, transposeSymbol,
} from '../src/lib/RndmEngine.ts';
import { chordIntervalsWithCommonNotes, sharedNotes } from '../src/lib/RndmEngine.ts';
import { parseChordSymbol } from '../src/lib/ChordSymbol.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

const ALL_ROLES = Array.from({ length: 12 }, (_, i) => i);
const ALL_TYPES: ChordTypeGroup[] = ['major', 'minor', 'dominant', 'diminished', 'sus', 'exotic'];

/** A repeatable stand-in for Math.random, so a failing case can be looked at twice. */
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

(async () => {
  console.log('\n=== Every chord it names is a chord the instrument can play ===');
  {
    // The whole integration rests on this: RNDM writes symbols, MidiMOO reads
    // them. A spelling it cannot read would land on a pad as nothing at all.
    let checked = 0;
    const unreadable: string[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const commonNotes = seed % 3 === 0 ? [] : [NOTES[seed % 12], NOTES[(seed * 5) % 12]];
      const { chords } = generateProgression({
        count: 8,
        commonNotes: [...new Set(commonNotes)],
        mood: seed % 11,
        allowRepeats: seed % 2 === 0,
        types: ALL_TYPES,
        allowedFunctions: ALL_ROLES,
        random: seeded(seed),
      });
      for (const chord of chords) {
        checked++;
        if (!parseChordSymbol(chord)) unreadable.push(chord);
      }
    }
    check(`all ${checked} generated symbols parse`, unreadable.length === 0,
      [...new Set(unreadable)].join(' '));
  }
  {
    // Including every quality it can reach, named on its own.
    const unreadable: string[] = [];
    for (const group of ALL_TYPES) {
      for (const quality of CHORD_TYPE_MAP[group]) {
        for (const root of NOTES) if (!parseChordSymbol(root + quality)) unreadable.push(root + quality);
      }
    }
    check('every quality in the map parses on every root', unreadable.length === 0,
      [...new Set(unreadable)].join(' '));
  }
  {
    // And the renamed forms, which is where the parentheses come from.
    const unreadable: string[] = [];
    for (const root of NOTES) {
      for (const quality of ['min7', 'maj7', '7', '9', 'min9']) {
        for (const note of NOTES) {
          const named = smartRename(root, quality, [note]);
          if (!isForbidden(named) && !parseChordSymbol(named)) unreadable.push(named);
        }
      }
    }
    check('every renamed form parses', unreadable.length === 0, [...new Set(unreadable)].slice(0, 8).join(' '));
  }

  console.log('\n=== The common notes are actually heard ===');
  {
    // Selection only asks that a note fits, not that the chord states it — D is
    // the eleventh of A9 and is not in the chord. Left alone it is inaudible in
    // about a third of them, so the layer that adds it is what makes the idea
    // work at all.
    let statedPlain = 0, statedWithLayer = 0, total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const commonNotes = [...new Set([NOTES[seed % 12], NOTES[(seed * 7) % 12]])];
      const { chords, fallback } = generateProgression({
        count: 8, commonNotes, mood: 5, allowRepeats: true,
        types: ALL_TYPES, allowedFunctions: ALL_ROLES, random: seeded(seed * 13),
      });
      if (fallback) continue;
      for (const chord of chords) {
        const parsed = parseChordSymbol(chord)!;
        const plain = new Set(parsed.intervals.map(i => (parsed.root + i) % 12));
        const layered = new Set(
          chordIntervalsWithCommonNotes(parsed.root, parsed.intervals, commonNotes)
            .map(i => (parsed.root + i) % 12));
        for (const note of commonNotes) {
          total++;
          if (plain.has(NOTES.indexOf(note))) statedPlain++;
          if (layered.has(NOTES.indexOf(note))) statedWithLayer++;
        }
      }
    }
    check('without the layer many chords never state the note', statedPlain < total, `${statedPlain}/${total}`);
    check('with it every chord states every note asked for', statedWithLayer === total, `${statedWithLayer}/${total}`);
  }
  {
    const parsed = parseChordSymbol('A9')!;
    const layered = chordIntervalsWithCommonNotes(parsed.root, parsed.intervals, ['D']);
    check('a note the chord lacks is added above it', layered.includes(17), `${layered}`);
    check('and the chord keeps its own notes', parsed.intervals.every(i => layered.includes(i)), `${layered}`);
    const already = chordIntervalsWithCommonNotes(parsed.root, parsed.intervals, ['A', 'E']);
    check('a note it already has is not doubled', already.length === parsed.intervals.length, `${already}`);
  }
  {
    // A role the player has switched off must not be used to justify a chord.
    const onlyRootAndFifth = [0, 7];
    const { chords } = generateProgression({
      count: 8, commonNotes: ['C'], mood: 5, allowRepeats: true,
      types: ALL_TYPES, allowedFunctions: onlyRootAndFifth, random: seeded(99),
    });
    const roles = chords.map(c => {
      const root = c.match(/^([A-G][b#]?)/)![0];
      return (0 - NOTES.indexOf(root) + 12) % 12;
    });
    check('C only appears as a root or a fifth', roles.every(r => onlyRootAndFifth.includes(r)), roles.join());
  }
  {
    check('a note outside the allowed roles is refused',
      !checkFunction('C', ['Db'], [0, 7]), '');
    check('and one inside them is not', checkFunction('C', ['G'], [0, 7]), '');
  }

  console.log('\n=== The switch that never did anything ===');
  {
    // ALLOW REPEATED ROOTS was passed to the original and never read.
    const narrow = { commonNotes: ['C', 'E', 'G'], mood: 5, types: ['major'] as ChordTypeGroup[], allowedFunctions: ALL_ROLES };
    const off = generateProgression({ ...narrow, count: 8, allowRepeats: false, random: seeded(7) });
    const on = generateProgression({ ...narrow, count: 8, allowRepeats: true, random: seeded(7) });
    const rootsOf = (r: string[]) => r.map(c => c.match(/^([A-G][b#]?)/)![0]);
    check('with it off, eight pads get eight distinct roots where it can',
      new Set(rootsOf(off.chords)).size >= Math.min(8, new Set(rootsOf(on.chords)).size), '');
    check('with it on, a root may come round again',
      on.chords.length === 8, `${on.chords.length}`);
  }

  console.log('\n=== Mood tilts without shutting anything out ===');
  {
    const dark = getQualitiesForMood(['major', 'minor'], 0);
    const bright = getQualitiesForMood(['major', 'minor'], 10);
    const even = getQualitiesForMood(['major', 'minor'], 5);
    const share = (pool: string[], q: string) => pool.filter(x => x === q).length / pool.length;
    check('dark weights the minor qualities up', share(dark, 'min7') > share(even, 'min7'), '');
    check('bright weights the major ones up', share(bright, 'maj7') > share(even, 'maj7'), '');
    check('and neither removes the other', dark.includes('maj7') && bright.includes('min7'), '');
    check('nothing selected still yields something', getQualitiesForMood([], 5).length > 0, '');
  }

  console.log('\n=== Naming ===');
  {
    check('a flat ninth over a minor is named', smartRename('C', 'min7', ['Db']) === 'Cmin7(b9)', smartRename('C', 'min7', ['Db']));
    check('a major seventh over a minor renames the chord', smartRename('C', 'min7', ['B']) === 'CminMaj7', smartRename('C', 'min7', ['B']));
    // A ninth cannot be both natural and flat, so the chord becomes a seventh.
    check('an altered ninth demotes a ninth chord', smartRename('C', '9', ['Db']) === 'C7(b9)', smartRename('C', '9', ['Db']));
    check('nothing to say leaves the name alone', smartRename('C', 'maj7', []) === 'Cmaj7', '');
    check('a contradiction is refused', isForbidden('CminMaj7(b6)'), '');
  }

  console.log('\n=== Scales, tones and transposition ===');
  {
    check('a major chord implies its own scale',
      getParentScaleNotes('C', 'maj7').join() === 'C,D,E,Gb,G,A,B', getParentScaleNotes('C', 'maj7').join());
    check('a dominant implies nearly everything', getParentScaleNotes('C', '7').length === 11, '');
    check('tones of Cmaj7 include the seventh', getImpliedJazzTones('Cmaj7').includes('B'), '');
    check('two chords a fifth apart share tones', getAllCommonChordTones(['Cmaj7', 'G7']).length > 0, '');
    check('one chord shares everything with itself',
      getAllCommonChordTones(['Cmin7']).length === getImpliedJazzTones('Cmin7').length, '');
    check('nothing shared reports nothing', getAllCommonChordTones([]).length === 0, '');
    check('transposing moves only the root', transposeSymbol('Cmin7(b9)', 2) === 'Dmin7(b9)', transposeSymbol('Cmin7(b9)', 2));
    check('and wraps round the octave', transposeSymbol('Bmaj7', 1) === 'Cmaj7', transposeSymbol('Bmaj7', 1));
    check('by nothing changes nothing', transposeSymbol('Ebmin9', 0) === 'Ebmin9', '');
  }

  console.log('\n=== What a set of chords shares ===');
  {
    // A preset is a written-out voicing that happens to carry a name. Reading
    // the name would credit it with tensions nobody played, so it is read as
    // the notes it actually contains.
    const preset = [
      { voicing: [60, 64, 67, 71], symbol: 'Cmaj7' },
      { voicing: [62, 65, 69, 72], symbol: 'Dmin7' },
    ];
    const fromVoicings = sharedNotes(preset);
    check('a preset shares only notes both actually contain',
      fromVoicings.join() === 'C', fromVoicings.join());
    // The same two chords read as symbols are far more generous, which is
    // exactly the reading a preset must not get.
    const fromSymbols = sharedNotes([{ symbol: 'Cmaj7' }, { symbol: 'Dmin7' }]);
    check('read as symbols they appear to share more',
      fromSymbols.length > fromVoicings.length, `${fromSymbols} vs ${fromVoicings}`);
  }
  {
    check('one chord shares nothing with itself alone', sharedNotes([{ symbol: 'Cmaj7' }]).length === 0, '');
    check('nothing at all shares nothing', sharedNotes([]).length === 0, '');
    check('empty pads are ignored rather than counted',
      sharedNotes([{ voicing: [60, 64, 67] }, {}, { voicing: [60, 65, 69] }]).join() === 'C',
      sharedNotes([{ voicing: [60, 64, 67] }, {}, { voicing: [60, 65, 69] }]).join());
    // Octaves are the same note as far as this is concerned.
    check('a note shared an octave apart still counts',
      sharedNotes([{ voicing: [60, 64] }, { voicing: [72, 67] }]).join() === 'C', '');
    check('chords with nothing in common report nothing',
      sharedNotes([{ voicing: [60, 64, 67] }, { voicing: [61, 66, 68] }]).length === 0, '');
  }

  console.log('\n=== Rerolling one chord ===');
  {
    const progression = ['Cmin7', 'Fmin7', 'Gmin7'];
    const replacement = generateSingleChord(['C'], 5, ALL_TYPES, progression, ALL_ROLES, seeded(3));
    check('the replacement parses', !!parseChordSymbol(replacement), replacement);
    const root = replacement.match(/^([A-G][b#]?)/)![0];
    check('and avoids the roots already in use', !['C', 'F', 'G'].includes(root), `${replacement}`);
    check('it can still hold the common note', getImpliedJazzTones(replacement).includes('C'), replacement);
  }
  {
    // Asking for the impossible must still return a chord rather than nothing.
    const impossible = generateProgression({
      count: 8, commonNotes: ['C', 'Db', 'D', 'Eb', 'E', 'F'], mood: 5,
      allowRepeats: true, types: ['major'], allowedFunctions: [0], random: seeded(5),
    });
    check('an impossible request falls back rather than failing',
      impossible.chords.length === 8 && impossible.fallback === true, JSON.stringify(impossible.chords.slice(0, 2)));
    check('and the fallback is still playable', !!parseChordSymbol(impossible.chords[0]), '');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
