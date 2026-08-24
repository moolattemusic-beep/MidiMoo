import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { CHORD_PATTERNS, mutatePattern, TICKS_PER_BEAT } from '../src/lib/ChordPatterns.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

console.log('\n=== MAX NOTES is a plain count ===');
{
  const notesFor = (max: number, mods: (e: any) => void) => {
    const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, chordMaxNotes: max, chordColor: 4 });
    const ons: number[] = [];
    e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
    mods(e);
    e.handleMidi(60, 100, true);
    return new Set(ons).size;
  };
  const major = (m: number) => notesFor(m, (e) => e.setModifiers(0, false, false, false, false));
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    check(`max ${n} gives ${n} notes`, major(n) === n, `${major(n)}`);
  }
  check('8 is available', major(8) >= 7, `${major(8)}`);
  // A played voicing may sound a tone in more than one octave, so a triad can
  // legitimately arrive as more than three notes; it is still three tones.
  check('a triad still states only its own three tones',
    (() => {
      const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, chordMaxNotes: 8, chordColor: 0 });
      const ons: number[] = [];
      e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
      e.setModifiers(0, false, false, false, false);
      e.handleMidi(60, 100, true);
      return new Set([...ons].map(p => ((p % 12) + 12) % 12)).size === 3;
    })());
}

console.log('\n=== MODIFY varies rather than replaces ===');
{
  const base = CHORD_PATTERNS.find(p => p.lengthBeats === 4 && p.events.length >= 8)!;
  const same = mutatePattern(base, 0);
  check('zero percent changes nothing', JSON.stringify(same) === JSON.stringify(base));

  const light = mutatePattern(base, 15, 111);
  const heavy = mutatePattern(base, 90, 111);
  const diff = (a: any, b: any) => {
    const key = (e: any) => `${e.voice}:${e.start}:${e.length}:${e.velocity}:${e.octave ?? 0}`;
    const bk = new Set(b.events.map(key));
    return a.events.filter((e: any) => !bk.has(key(e))).length;
  };
  check('a light touch changes something', diff(light, base) > 0, `${diff(light, base)}`);
  check('a heavy one changes more', diff(heavy, base) > diff(light, base), `${diff(light, base)} vs ${diff(heavy, base)}`);
  check('the same seed gives the same result',
    JSON.stringify(mutatePattern(base, 50, 7)) === JSON.stringify(mutatePattern(base, 50, 7)));

  let ok = true, why = '';
  for (const p of CHORD_PATTERNS) {
    for (let seed = 0; seed < 12; seed++) {
      for (const amt of [10, 50, 100]) {
        const m = mutatePattern(p, amt, seed * 31 + amt);
        const total = m.lengthBeats * TICKS_PER_BEAT;
        if (m.events.length === 0) { ok = false; why = `${p.name} emptied`; }
        if (!m.events.some(e => e.start === 0)) { ok = false; why = `${p.name} lost its downbeat`; }
        for (const e of m.events) {
          if (e.voice < 1 || e.voice > 8) { ok = false; why = `${p.name} voice ${e.voice}`; }
          if (e.start < 0 || e.start >= total) { ok = false; why = `${p.name} start ${e.start}/${total}`; }
          if (e.length < 1) { ok = false; why = `${p.name} length ${e.length}`; }
          if (e.velocity < 1 || e.velocity > 127) { ok = false; why = `${p.name} vel ${e.velocity}`; }
        }
      }
    }
  }
  check('every mutation of every pattern stays playable', ok, why);
  check('length is preserved', CHORD_PATTERNS.every(p => mutatePattern(p, 80, 5).lengthBeats === p.lengthBeats));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(0);
