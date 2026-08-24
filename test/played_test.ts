import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { voicingQualityOf, chooseVoicing, voicingSpread, voicingsFor } from '../src/lib/Voicings.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

const play = (over: any, mods: (e: any) => void) => {
  const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, ...over });
  const ons: number[] = [];
  e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
  mods(e);
  e.handleMidi(60, 100, true);
  return [...new Set(ons)].sort((a, b) => a - b);
};
const major = (e: any) => e.setModifiers(0, false, false, false, false);
const minor7 = (e: any) => e.setModifiers(1, true, false, false, false);
const pcs = (...xs: number[]) => new Set(xs);

console.log('\n=== Quality is read for voicing purposes ===');
{
  check('a triad is a triad', voicingQualityOf(pcs(0, 4, 7)) === 'maj');
  check('a major seventh is its own thing', voicingQualityOf(pcs(0, 4, 7, 11)) === 'maj7');
  check('a minor seventh too', voicingQualityOf(pcs(0, 3, 7, 10)) === 'min7');
  check('a dominant', voicingQualityOf(pcs(0, 4, 7, 10)) === 'dom');
  check('a half diminished', voicingQualityOf(pcs(0, 3, 6, 10)) === 'halfdim');
  check('a sus', voicingQualityOf(pcs(0, 5, 7)) === 'sus');
}

console.log('\n=== Chords are voiced the way they are played ===');
{
  const stacked = play({ voicingPlayed: false }, minor7);
  const played = play({ voicingPlayed: true }, minor7);
  const width = (a: number[]) => a[a.length - 1] - a[0];
  check('the played voicing reaches further', width(played) > width(stacked), `${width(stacked)} -> ${width(played)}`);
  check('it reaches beyond an octave', width(played) > 12, `${width(played)}`);
  check('and states the chord', new Set(played.map(p => p % 12)).size >= 3, JSON.stringify(played));
}

console.log('\n=== The two axes do what they say ===');
{
  const width = (a: number[]) => a[a.length - 1] - a[0];
  const close = play({ voicingPlayed: true, voicingX: -1, voicingY: -1 }, minor7);
  const wide = play({ voicingPlayed: true, voicingX: 1, voicingY: -1 }, minor7);
  check('left is closer than right', width(close) < width(wide), `${width(close)} vs ${width(wide)}`);

  const usual = chooseVoicing('min7', pcs(0, 3, 7, 10), 5, 0.5, 0)!;
  const unusual = chooseVoicing('min7', pcs(0, 3, 7, 10), 5, 0.5, 1)!;
  check('top is a commoner shape than bottom', usual.weight >= unusual.weight, `${usual.weight} vs ${unusual.weight}`);
  check('and they are different shapes', usual.intervals.join() !== unusual.intervals.join());

  const narrow = chooseVoicing('min7', pcs(0, 3, 7, 10), 5, 0, 0.5)!;
  const broad = chooseVoicing('min7', pcs(0, 3, 7, 10), 5, 1, 0.5)!;
  check('the spread axis really spreads', voicingSpread(narrow) < voicingSpread(broad),
    `${voicingSpread(narrow)} vs ${voicingSpread(broad)}`);
}

console.log('\n=== Nothing the chord asks for is dropped ===');
{
  // A shape that states every required class is preferred over a nicer one.
  for (const q of ['maj7', 'min7', 'dom', 'sus'] as const) {
    const required = new Set(voicingsFor(q)[0].intervals.map(i => ((i % 12) + 12) % 12));
    const chosen = chooseVoicing(q, required, 5, 0.5, 0.5)!;
    const got = new Set(chosen.intervals.map(i => ((i % 12) + 12) % 12));
    const missing = [...required].filter(pc => !got.has(pc));
    check(`${q} keeps everything it must state`, missing.length === 0, JSON.stringify(missing));
  }
  const withNinth = play({ voicingPlayed: true, chordMaxNotes: 6 }, (e: any) => e.setModifiers(1, true, false, false, true));
  check('a written ninth survives', withNinth.some(p => ((p - 60) % 12 + 12) % 12 === 2), JSON.stringify(withNinth));
}

console.log('\n=== It still answers the other controls ===');
{
  for (const n of [3, 4, 5, 6]) {
    const out = play({ voicingPlayed: true, chordMaxNotes: n }, minor7);
    check(`max notes ${n} is respected`, out.length <= n, `${out.length}`);
  }
  const low = play({ voicingPlayed: true, chordRegisterStart: 48 }, major);
  const high = play({ voicingPlayed: true, chordRegisterStart: 72 }, major);
  check('the register moves it', high[0] > low[0], `${low[0]} -> ${high[0]}`);
  check('and it starts at the register', low[0] >= 48 && low[0] < 60, `${low[0]}`);
  check('switched off, the old voicings return',
    play({ voicingPlayed: false }, major).length === 3, JSON.stringify(play({ voicingPlayed: false }, major)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(0);
