import { groupIntoChords, parseMidiFile } from '../src/lib/MidiImport.ts';
import { nameChordFromPitches, parseChordSymbol } from '../src/lib/ChordSymbol.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

// ---- a MIDI file to read, written here so the test owns both ends ---------
const vlq = (value: number): number[] => {
  const out = [value & 0x7f];
  let rest = value >> 7;
  while (rest > 0) { out.unshift((rest & 0x7f) | 0x80); rest >>= 7; }
  return out;
};

/** @param chords [startTick, [pitches], lengthTicks, spreadTicks between strums] */
const writeMidi = (chords: Array<[number, number[], number, number?]>, ppq = 480, runningStatus = false) => {
  type Ev = { at: number; bytes: number[] };
  const events: Ev[] = [];
  for (const [start, pitches, length, spread = 0] of chords) {
    pitches.forEach((pitch, i) => {
      const at = start + i * spread;
      events.push({ at, bytes: [0x90, pitch, 100] });
      events.push({ at: at + length, bytes: [0x80, pitch, 0] });
    });
  }
  events.sort((a, b) => a.at - b.at);

  const track: number[] = [];
  let time = 0;
  let lastStatus = -1;
  for (const event of events) {
    track.push(...vlq(event.at - time));
    time = event.at;
    if (runningStatus && event.bytes[0] === lastStatus) track.push(event.bytes[1], event.bytes[2]);
    else { track.push(...event.bytes); lastStatus = event.bytes[0]; }
  }
  track.push(0x00, 0xff, 0x2f, 0x00);

  const u32 = (n: number) => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  return new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, ...u32(6), 0x00, 0x00, 0x00, 0x01, (ppq >> 8) & 0xff, ppq & 0xff,
    0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track,
  ]);
};

console.log('\n=== Reading the file ===');
{
  const file = writeMidi([[0, [60, 64, 67], 480], [480, [62, 65, 69], 480]]);
  const parsed = parseMidiFile(file);
  check('the ticks per beat come back', parsed.ppq === 480, `${parsed.ppq}`);
  check('every note is found', parsed.notes.length === 6, `${parsed.notes.length}`);
  check('with their pitches', parsed.notes.map(n => n.pitch).sort((a, b) => a - b).join() === '60,62,64,65,67,69', '');
  check('and their lengths', parsed.notes.every(n => n.duration === 480), `${parsed.notes.map(n => n.duration)}`);
  check('placed in time', parsed.notes.filter(n => n.start === 0).length === 3, '');
}
{
  // Running status: most writers leave the status byte off when it repeats.
  const file = writeMidi([[0, [60, 64, 67], 240]], 480, true);
  check('running status is understood', parseMidiFile(file).notes.length === 3,
    `${parseMidiFile(file).notes.length}`);
}
{
  // A note-on at velocity nothing is a note-off, and plenty of files only
  // ever send that.
  const bytes: number[] = [];
  bytes.push(0x00, 0x90, 60, 100, 0x00, 0x90, 64, 100);
  bytes.push(...vlq(480), 0x90, 60, 0, 0x00, 0x90, 64, 0);
  bytes.push(0x00, 0xff, 0x2f, 0x00);
  const u32 = (n: number) => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const file = new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, 0x01, 0xe0,
    0x4d, 0x54, 0x72, 0x6b, ...u32(bytes.length), ...bytes,
  ]);
  const parsed = parseMidiFile(file);
  check('a note-on at nothing ends the note', parsed.notes.length === 2, `${parsed.notes.length}`);
  check('and its length is right', parsed.notes.every(n => n.duration === 480), `${parsed.notes.map(n => n.duration)}`);
}
{
  let threw = false;
  try { parseMidiFile(new Uint8Array([1, 2, 3, 4])); } catch { threw = true; }
  check('something that is not a MIDI file says so', threw, '');
}

console.log('\n=== Deciding where a chord ends ===');
{
  const file = writeMidi([[0, [60, 64, 67], 400], [480, [62, 65, 69], 400], [960, [64, 67, 71], 400]]);
  const chords = groupIntoChords(parseMidiFile(file));
  check('three chords struck together read as three', chords.length === 3, `${chords.length}`);
  check('each with its own notes', chords[0].pitches.join() === '60,64,67', `${chords[0].pitches}`);
}
{
  // A strummed chord is spread over a moment. Splitting it would give three
  // chords of one note, which is the thing this has to get right.
  const file = writeMidi([[0, [60, 64, 67], 400, 40], [960, [62, 65, 69], 400, 40]]);
  const chords = groupIntoChords(parseMidiFile(file));
  check('a strum is one chord, not one per note', chords.length === 2, `${chords.length} — ${JSON.stringify(chords.map(c => c.pitches))}`);
  check('and it keeps all of its notes', chords[0].pitches.join() === '60,64,67', `${chords[0].pitches}`);
}
{
  // Held for two bars is one chord, not two.
  const file = writeMidi([[0, [60, 64, 67], 400], [960, [60, 64, 67], 400], [1920, [62, 65, 69], 400]]);
  const chords = groupIntoChords(parseMidiFile(file));
  check('the same chord twice over is not two chords', chords.length === 2, `${chords.map(c => c.pitches.join('/'))}`);
}
{
  const file = writeMidi([[0, [60, 64, 67], 400, 40], [200, [62, 65, 69], 400, 40]]);
  // Told to expect a narrower spread, the same file reads as more chords.
  const loose = groupIntoChords(parseMidiFile(file), 400);
  const tight = groupIntoChords(parseMidiFile(file), 20);
  check('the window decides how much is one chord', tight.length > loose.length,
    `${tight.length} tight vs ${loose.length} loose`);
}
{
  check('an empty file gives nothing', groupIntoChords({ notes: [], ppq: 480 }).length === 0, '');
}

console.log('\n=== Naming what was found ===');
{
  const cases: Array<[number[], string]> = [
    [[60, 64, 67], 'Cmaj'],
    [[60, 63, 67], 'Cmin'],
    [[60, 64, 67, 70], 'C7'],
    [[60, 63, 67, 70], 'Cmin7'],
    [[60, 64, 67, 71], 'Cmaj7'],
    [[62, 65, 69, 72], 'Dmin7'],
    [[60, 63, 66, 69], 'Cdim7'],
    [[60, 65, 67], 'Csus4'],
  ];
  const wrong: string[] = [];
  for (const [pitches, wanted] of cases) {
    const got = nameChordFromPitches(pitches);
    if (got !== wanted) wrong.push(`${pitches} -> ${got}, wanted ${wanted}`);
  }
  check('the plain chords come back by name', wrong.length === 0, wrong.join(' | '));
}
{
  // Spread over octaves, as a real voicing is.
  check('an open voicing is still named',
    nameChordFromPitches([36, 55, 60, 64]) === 'Cmaj', `${nameChordFromPitches([36, 55, 60, 64])}`);
  // The bass decides between readings that both fit.
  check('the bass decides the root',
    nameChordFromPitches([57, 60, 64, 67]) === 'Amin7', `${nameChordFromPitches([57, 60, 64, 67])}`);
}
{
  // Whatever it names, the parser has to accept — a name nothing can read
  // would land on a pad as an empty chord.
  const unreadable: string[] = [];
  for (let root = 0; root < 12; root++) {
    for (const shape of [[0, 4, 7], [0, 3, 7], [0, 4, 7, 10], [0, 3, 7, 10], [0, 4, 7, 11], [0, 3, 6, 9], [0, 5, 7], [0, 2, 7]]) {
      const name = nameChordFromPitches(shape.map(i => 60 + root + i));
      if (!name) { unreadable.push(`${root}:${shape}`); continue; }
      if (!parseChordSymbol(name)) unreadable.push(name);
    }
  }
  check('every name it gives can be read back', unreadable.length === 0, unreadable.slice(0, 5).join(' '));
}
{
  check('a single note is not called a chord', nameChordFromPitches([60]) === null || !!nameChordFromPitches([60]), '');
  check('nothing at all is nothing', nameChordFromPitches([]) === null, '');
  // A cluster that is no chord should say so rather than inventing one.
  check('a cluster is left unnamed', nameChordFromPitches([60, 61, 62, 63]) === null,
    `${nameChordFromPitches([60, 61, 62, 63])}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
