/**
 * The voicing disk does one job at a time.
 *
 * With PLAYED VOICINGS on it chooses a shape from the library, and nothing else
 * touches that shape — the drop voicings used to run underneath it, widening a
 * shape that had already been chosen for its width, which is why its CLOSE edge
 * could sound open. With PLAYED VOICINGS off the disk is the five drop voicings
 * it is labelled with, the nearest corner wins outright, and a dropped note is
 * moved down an octave rather than thrown away for sitting under the register.
 */
import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { parseChordSymbol } from '../src/lib/ChordSymbol.ts';
import { chooseVoicing, voicingQualityOf } from '../src/lib/Voicings.ts';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
};

const REGISTER = 48;
const RANGE_LOW = 24;

/** The five nodes of the disk, at the corners of its pentagon. */
const CORNERS: Array<[string, number, number]> = [
  ['CLOSED', 0, -1],
  ['DROP 2', 0.951, -0.309],
  ['DROP 3', 0.588, 0.809],
  ['DROP 4', -0.588, 0.809],
  ['OPEN', -0.951, -0.309],
];

// Triads mostly, because a pasted seventh is usually turned down by the library
// — every shape it has for one adds a tone the chord was not written with.
const CHORDS = ['C', 'Am', 'F', 'G', 'Em', 'Dm', 'Cmaj7', 'Dm7', 'G7', 'Bm7b5'];

function rig(over: Record<string, unknown>) {
  const engine = new OrchidEngine({
    ...defaultParams,
    mpeEnabled: false, strumEngine: 0, autoBassRegister: 0, patternEnabled: false,
    inversionRepeat: 0, chordInversion: 0, chordRegisterStart: REGISTER,
    outputRangeLow: RANGE_LOW, outputRangeHigh: 108, voiceLeadEnabled: false,
    ...over,
  } as any);
  const heard: number[] = [];
  engine.onOutputNote = (e: any) => {
    if (e.isCC || e.isExpression || e.isPitchBend) return;
    if (e.isOn && e.velocity > 0) heard.push(e.pitch);
  };
  return (symbol: string) => {
    const parsed = parseChordSymbol(symbol)!;
    heard.length = 0;
    engine.handleMidi(60 + parsed.root, 100, true, false, false, false, true, undefined, parsed.intervals);
    const notes = [...heard].sort((a, b) => a - b);
    engine.handleMidi(60 + parsed.root, 0, false, false, false, false, true, undefined, parsed.intervals);
    return notes;
  };
}

/** The library's shape for this chord at this corner, placed as the engine places it. */
function libraryShape(symbol: string, x: number, y: number): number[] | null {
  const parsed = parseChordSymbol(symbol)!;
  const required = new Set(parsed.intervals.map(i => ((i % 12) + 12) % 12));
  const shape = chooseVoicing(voicingQualityOf(required), required, 6, (x + 1) / 2, (y + 1) / 2);
  if (!shape) return null;
  const stated = new Set(shape.intervals.map(i => ((i % 12) + 12) % 12));
  // A pasted chord is played as spelled, so a shape that leaves a tone out or
  // brings one of its own is refused and the chord is built instead.
  for (const pc of required) if (!stated.has(pc)) return null;
  for (const pc of stated) if (!required.has(pc)) return null;
  let base = REGISTER - (((REGISTER - parsed.root) % 12) + 12) % 12;
  while (base + shape.intervals[0] < REGISTER) base += 12;
  while (base + shape.intervals[0] >= REGISTER + 12) base -= 12;
  const pitches = shape.intervals.map(i => base + i).filter(p => p >= 0 && p <= 127);
  return pitches.length > 6 ? pitches.slice(0, 6) : pitches;
}

function main() {
  console.log('\n=== PLAYED VOICINGS on: the library shape, and nothing on top of it ===');
  {
    let compared = 0;
    let intact = 0;
    const mismatched: string[] = [];
    for (const [name, x, y] of CORNERS) {
      const sound = rig({ voicingPlayed: true, voicingX: x, voicingY: y });
      for (const symbol of CHORDS) {
        const shape = libraryShape(symbol, x, y);
        if (!shape) continue; // the library turned this one down; it is built instead
        compared++;
        const heard = sound(symbol);
        if (heard.join() === [...shape].sort((a, b) => a - b).join()) intact++;
        else mismatched.push(`${symbol} at ${name}: ${heard} vs ${shape}`);
      }
    }
    check('there are library shapes to compare against', compared >= 10, `${compared}`);
    check('every one is sounded exactly as the library wrote it',
      intact === compared, mismatched.slice(0, 3).join(' | '));
  }
  {
    const sound = rig({ voicingPlayed: true, voicingX: -1, voicingY: 0 });
    const close = sound('Cmaj7');
    const wide = rig({ voicingPlayed: true, voicingX: 1, voicingY: 0 })('Cmaj7');
    const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
    check('the CLOSE edge really is the closer of the two',
      spread(close) <= spread(wide), `close ${close} wide ${wide}`);
    check('and nothing sits below the register there',
      close.every(p => p >= REGISTER), `${close}`);
  }

  console.log('\n=== PLAYED VOICINGS off: the five drop voicings, as labelled ===');
  {
    const closedAt = rig({ voicingPlayed: false, voicingX: 0, voicingY: -1 });
    for (const symbol of ['Cmaj7', 'Dm7', 'G7']) {
      const closed = closedAt(symbol);
      for (const [name, x, y] of CORNERS.slice(1)) {
        const heard = rig({ voicingPlayed: false, voicingX: x, voicingY: y })(symbol);
        const expected = [...closed];
        const lower = (index: number) => {
          if (index < 0 || index >= expected.length) return;
          const dropped = expected[index] - 12;
          if (dropped >= RANGE_LOW && !expected.includes(dropped)) expected[index] = dropped;
        };
        if (name === 'DROP 2') lower(expected.length - 2);
        else if (name === 'DROP 3') lower(expected.length - 3);
        else if (name === 'DROP 4') lower(expected.length - 4);
        else if (name === 'OPEN') { lower(expected.length - 2); lower(expected.length - 4); }
        expected.sort((a, b) => a - b);
        check(`${symbol} at ${name}: the named voice is an octave lower`,
          heard.join() === expected.join(), `${heard} vs ${expected}`);
        check(`${symbol} at ${name}: no note is lost`, heard.length === closed.length,
          `${heard.length} vs ${closed.length}`);
      }
    }
  }
  {
    // The drop used to be thrown away for sitting under the register, so a triad
    // came back as a bare fifth.
    const heard = rig({ voicingPlayed: false, voicingX: 0.951, voicingY: -0.309 })('C');
    check('DROP 2 on a triad is still a triad', heard.length === 3, `${heard}`);
    check('its dropped voice is below the register', heard.some(p => p < REGISTER), `${heard}`);
    check('and still inside RANGE', heard.every(p => p >= RANGE_LOW), `${heard}`);
  }
  {
    const sound = rig({ voicingPlayed: false, voicingX: 0.7, voicingY: 0.2 });
    const presses = Array.from({ length: 8 }, () => sound('Cmaj7').join());
    check('a spot between corners sounds the same every press',
      new Set(presses).size === 1, [...new Set(presses)].join(' | '));
  }
  {
    // Known, and left alone: there are not enough voices in a triad to drop.
    const triad = (x: number, y: number) => rig({ voicingPlayed: false, voicingX: x, voicingY: y })('C').join();
    check('on a triad DROP 4 is the same as CLOSED', triad(-0.588, 0.809) === triad(0, -1));
    check('and OPEN the same as DROP 2', triad(-0.951, -0.309) === triad(0.951, -0.309));
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
