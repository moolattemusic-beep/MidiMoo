import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { parseChordSymbol } from '../src/lib/ChordSymbol.ts';
import { CHORD_PRESETS } from '../src/lib/ChordPresets.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

/**
 * The measurement the whole change rests on: every one of the 221 progressions
 * in the preset library, loaded onto the pads as symbols — the way RNDM and the
 * text field load them — and played through, with the top-voice jumps counted
 * with voice leading off and in each mode.
 */
type Mode = 'off' | 'topLine' | 'anchor' | 'allVoices' | 'commonTones';

const rows = CHORD_PRESETS
  .map(preset => preset.chords
    .map(c => parseChordSymbol(c.symbol))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 8)
    .map(p => ({
      rootPitch: 60 + p.root, baseType: -1,
      ext_m7: false, ext_M7: false, ext_6: false, ext_9: false,
      chordIntervals: p.intervals,
    })))
  .filter(row => row.length >= 3);

function measure(mode: Mode) {
  const jumps: number[] = [];
  let anchorMiss = 0;
  for (const row of rows) {
    const e = new OrchidEngine({
      ...defaultParams,
      mpeEnabled: false, strumEngine: 0, autoBassRegister: 0, inversionRepeat: 0,
      chordRegisterStart: 48, outputRangeLow: 24, outputRangeHigh: 108, voicingPlayed: true,
      voiceLeadEnabled: mode !== 'off', voiceLeadScope: 'pads',
      voiceLeadMode: mode === 'off' ? 'topLine' : mode, voiceLeadAnchor: 67,
    } as any);
    e.setPadSlots(row);
    const heard: number[] = [];
    e.onOutputNote = (ev: any) => {
      if (ev.isCC || ev.isExpression || ev.isPitchBend) return;
      if (ev.isOn && ev.velocity > 0) heard.push(ev.pitch);
    };
    let lastTop: number | null = null;
    row.forEach((s, i) => {
      heard.length = 0;
      e.handleMidi(s.rootPitch, 100, true, false, false, false, true, undefined, s.chordIntervals, i);
      e.handleMidi(s.rootPitch, 0, false, false, false, false, true, undefined, s.chordIntervals);
      if (heard.length === 0) return;
      const top = Math.max(...heard);
      if (lastTop !== null) jumps.push(Math.abs(top - lastTop));
      if (Math.abs(top - 67) > 5) anchorMiss++;
      lastTop = top;
    });
  }
  jumps.sort((a, b) => a - b);
  const at = (q: number) => jumps[Math.min(jumps.length - 1, Math.floor(q * jumps.length))];
  const bigJumps = jumps.filter(j => j >= 7).length;
  return { median: at(0.5), p90: at(0.9), worst: jumps[jumps.length - 1], bigJumps, count: jumps.length, anchorMiss };
}

console.log(`\n=== ${rows.length} preset progressions, top-voice jumps in semitones ===`);
const results: Record<string, ReturnType<typeof measure>> = {};
for (const mode of ['off', 'topLine', 'anchor', 'allVoices', 'commonTones'] as Mode[]) {
  results[mode] = measure(mode);
  const r = results[mode];
  console.log(`     ${mode.padEnd(12)} median ${String(r.median).padStart(2)}  90% ${String(r.p90).padStart(2)}  worst ${String(r.worst).padStart(2)}  jumps of a fifth or more ${r.bigJumps}/${r.count}`);
}

const off = results.off;
check('the library really does jump about today', off.p90 >= 5, `90th percentile ${off.p90}`);
check('TOP LINE brings the typical jump down', results.topLine.median < off.median || results.topLine.median <= 2,
  `${results.topLine.median} vs ${off.median}`);
check('TOP LINE nearly eliminates jumps of a fifth or more',
  results.topLine.bigJumps <= Math.max(1, Math.floor(off.bigJumps * 0.1)),
  `${results.topLine.bigJumps} vs ${off.bigJumps}`);
check('TOP LINE keeps nine in ten moves within a fourth', results.topLine.p90 <= 5, `${results.topLine.p90}`);
check('ANCHOR keeps almost every top note within a fourth of G4',
  results.anchor.anchorMiss <= Math.ceil(results.anchor.count * 0.02),
  `${results.anchor.anchorMiss} misses`);
check('every mode is smoother than no leading at the top end',
  (['topLine', 'anchor', 'allVoices', 'commonTones'] as const).every(m => results[m].p90 <= off.p90),
  (['topLine', 'anchor', 'allVoices', 'commonTones'] as const).map(m => `${m}:${results[m].p90}`).join(' '));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
