import { CHORD_PRESETS, randomPreset } from '../src/lib/ChordPresets.ts';
import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

console.log('\n=== The presets are sound ===');
{
  check('a good number of them', CHORD_PRESETS.length >= 150, `${CHORD_PRESETS.length}`);
  check('every one has chords to fill pads with', CHORD_PRESETS.every(p => p.chords.length >= 4),
    CHORD_PRESETS.filter(p => p.chords.length < 4).map(p => p.title).join(','));
  check('none has more than the pads can hold', CHORD_PRESETS.every(p => p.chords.length <= 8));
  check('titles are readable', CHORD_PRESETS.every(p => p.title.length > 0 && !p.title.includes('.rpc')));

  let bad = '';
  for (const p of CHORD_PRESETS) {
    for (const c of p.chords) {
      if (c.notes.length < 3) bad = `${p.title} has a fragment`;
      if (c.notes.some(n => n < 0 || n > 127)) bad = `${p.title} out of range`;
      if (c.notes.some((n, i) => i > 0 && n <= c.notes[i - 1])) bad = `${p.title} not ascending`;
      if (!c.symbol) bad = `${p.title} unnamed chord`;
    }
    if (new Set(p.chords.map(c => c.notes.join(','))).size !== p.chords.length) bad = `${p.title} repeats a chord`;
  }
  check('every chord is well formed', bad === '', bad);

  const spreads = CHORD_PRESETS.flatMap(p => p.chords.map(c => c.notes[c.notes.length - 1] - c.notes[0]));
  spreads.sort((a, b) => a - b);
  check('they are real voicings, not stacks', spreads[Math.floor(spreads.length / 2)] > 12,
    `median ${spreads[Math.floor(spreads.length / 2)]}`);
}

console.log('\n=== Picking one ===');
{
  check('a preset comes back', randomPreset().chords.length >= 4);
  const first = CHORD_PRESETS[0].title;
  let avoided = true;
  for (let i = 0; i < 40; i++) if (randomPreset(first).title === first) avoided = false;
  check('it avoids the one already loaded', avoided);
  const titles = new Set(Array.from({ length: 60 }, () => randomPreset().title));
  check('and it really varies', titles.size > 10, `${titles.size} different in 60`);
}

(async () => {
  console.log('\n=== A preset chord plays as written ===');
  {
    const preset = CHORD_PRESETS.find(p => p.chords[0].notes.length >= 4)!;
    const chord = preset.chords[0];
    const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, memoryFollowRegister: false, chordMaxNotes: 8 });
    const ons: number[] = [];
    e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
    e.handleMidi(chord.notes[0], 100, true, false, false, false, true, [...chord.notes]);
    await sleep(60);
    check('the voicing is kept exactly', JSON.stringify([...new Set(ons)].sort((a, b) => a - b)) === JSON.stringify(chord.notes),
      `${JSON.stringify([...new Set(ons)].sort((a, b) => a - b))} vs ${JSON.stringify(chord.notes)}`);
  }
  {
    // And with FOLLOW REG it still answers the register slider.
    const chord = CHORD_PRESETS[0].chords[0];
    const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, memoryFollowRegister: true, chordRegisterStart: 72, chordMaxNotes: 8 });
    const ons: number[] = [];
    e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
    e.handleMidi(chord.notes[0], 100, true, false, false, false, true, [...chord.notes]);
    await sleep(60);
    check('the register moves it', ons.every(p => p >= 72), JSON.stringify(ons));
    check('and it keeps its pitch classes',
      JSON.stringify([...new Set(ons.map(p => p % 12))].sort((a, b) => a - b)) ===
      JSON.stringify([...new Set(chord.notes.map(n => n % 12))].sort((a, b) => a - b)));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
