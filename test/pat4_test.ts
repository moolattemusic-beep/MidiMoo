import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { randomPattern, patternDurationMs } from '../src/lib/ChordPatterns.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const P = (events: any[], lengthBeats = 4) => JSON.stringify({ name: 'T', lengthBeats, events });
const CHORD = [60, 64, 67];

const capture = (over: any) => {
  // Humanize deliberately jitters the final velocity, so it is switched off
  // here: this is testing what governs the level, not the jitter on top of it.
  const e = new OrchidEngine({ ...defaultParams, velHumanize: 0, patternEnabled: true, patternBpm: 200, ...over });
  const ons: Array<{ p: number; v: number }> = [];
  e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push({ p: ev.pitch, v: ev.velocity }); };
  return { e, ons };
};

(async () => {
  console.log('\n=== Fixed velocity ignores the keys ===');
  {
    const pat = P([{ voice: 1, start: 0, length: 48, velocity: 127 }]);
    const soft = capture({ patternCustom: pat, patternFixedVelocity: true, patternVelocity: 100 });
    soft.e.handleMidi(60, 20, true, false, false, false, true, CHORD);   // struck softly
    const hard = capture({ patternCustom: pat, patternFixedVelocity: true, patternVelocity: 100 });
    hard.e.handleMidi(60, 127, true, false, false, false, true, CHORD);  // struck hard
    await sleep(300);
    check('a soft and a hard press play the same', soft.ons[0]?.v === hard.ons[0]?.v, `${soft.ons[0]?.v} vs ${hard.ons[0]?.v}`);
    // The engine's own velocity curve still shapes the final number, so what
    // matters is that the slider governs it and the keys do not.
    const louder = capture({ patternCustom: pat, patternFixedVelocity: true, patternVelocity: 127 });
    louder.e.handleMidi(60, 20, true, false, false, false, true, CHORD);
    await sleep(220);
    check('the slider governs the level', (louder.ons[0]?.v ?? 0) > (soft.ons[0]?.v ?? 0),
      `${soft.ons[0]?.v} -> ${louder.ons[0]?.v}`);
    louder.e.panic();
    soft.e.panic(); hard.e.panic();
    await sleep(60);
  }
  {
    const pat = P([{ voice: 1, start: 0, length: 48, velocity: 127 }, { voice: 2, start: 48, length: 48, velocity: 60 }]);
    const { e, ons } = capture({ patternCustom: pat, patternFixedVelocity: true, patternVelocity: 120 });
    e.handleMidi(60, 64, true, false, false, false, true, CHORD);
    await sleep(400);
    check("the pattern's own accents still show", ons.length >= 2 && ons[0].v > ons[1].v, JSON.stringify(ons.slice(0, 2)));
    e.panic();
    await sleep(60);
  }
  {
    const pat = P([{ voice: 1, start: 0, length: 48, velocity: 127 }]);
    const soft = capture({ patternCustom: pat, patternFixedVelocity: false });
    soft.e.handleMidi(60, 30, true, false, false, false, true, CHORD);
    const hard = capture({ patternCustom: pat, patternFixedVelocity: false });
    hard.e.handleMidi(60, 120, true, false, false, false, true, CHORD);
    await sleep(300);
    check('switched off, the keys still matter', (soft.ons[0]?.v ?? 0) < (hard.ons[0]?.v ?? 0), `${soft.ons[0]?.v} vs ${hard.ons[0]?.v}`);
    soft.e.panic(); hard.e.panic();
    await sleep(60);
  }

  console.log('\n=== Inversion rotates the chord tones ===');
  {
    const pat = P([{ voice: 1, start: 0, length: 48, velocity: 127 }]);
    for (const [inv, expect] of [[0, 60], [1, 64], [2, 67], [3, 72]] as any) {
      const { e, ons } = capture({ patternCustom: pat, patternInversion: inv });
      e.handleMidi(60, 100, true, false, false, false, true, CHORD);
      await sleep(220);
      check(`inversion ${inv} plays ${expect}`, ons[0]?.p === expect, `got ${ons[0]?.p}`);
      e.panic();
      await sleep(40);
    }
    const { e, ons } = capture({ patternCustom: pat, patternInversion: -1 });
    e.handleMidi(60, 100, true, false, false, false, true, CHORD);
    await sleep(220);
    check('inversion -1 drops an octave to 55', ons[0]?.p === 55, `got ${ons[0]?.p}`);
    e.panic();
    await sleep(60);
  }

  console.log('\n=== Grace keeps the cycle between chords ===');
  {
    const pat = P([{ voice: 1, start: 0, length: 48, velocity: 100 }]);
    const { e } = capture({ patternCustom: pat, patternBpm: 60, patternGraceEnabled: true, patternGraceMs: 400 });
    const cycleMs = patternDurationMs(JSON.parse(pat), 60);
    e.handleMidi(60, 100, true, false, false, false, true, CHORD);
    await sleep(cycleMs * 0.5);
    const before = e.getPatternPhase()!;
    e.handleMidi(60, 0, false, false, false, false, true, []);   // let go entirely
    await sleep(150);                                            // inside the grace window
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    const after = e.getPatternPhase()!;
    check('the cycle carried on', after > before, `${before.toFixed(2)} -> ${after.toFixed(2)}`);
    check('and did not restart', after > 0.3, `${after.toFixed(2)}`);
    e.panic();
    await sleep(60);
  }
  {
    const pat = P([{ voice: 1, start: 0, length: 48, velocity: 100 }]);
    const { e } = capture({ patternCustom: pat, patternBpm: 60, patternGraceEnabled: true, patternGraceMs: 100 });
    e.handleMidi(60, 100, true, false, false, false, true, CHORD);
    await sleep(600);
    e.handleMidi(60, 0, false, false, false, false, true, []);
    await sleep(300); // well past the window
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    const after = e.getPatternPhase()!;
    check('past the window it starts afresh', after < 0.15, `${after.toFixed(3)}`);
    e.panic();
    await sleep(60);
  }
  {
    const pat = P([{ voice: 1, start: 0, length: 48, velocity: 100 }]);
    const { e } = capture({ patternCustom: pat, patternBpm: 60, patternGraceEnabled: false });
    e.handleMidi(60, 100, true, false, false, false, true, CHORD);
    await sleep(600);
    e.handleMidi(60, 0, false, false, false, false, true, []);
    await sleep(80);
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    check('switched off, it always restarts', e.getPatternPhase()! < 0.15, `${e.getPatternPhase()!.toFixed(3)}`);
    e.panic();
    await sleep(60);
  }

  console.log('\n=== The generator answers density and overlap ===');
  {
    const count = (o: any) => randomPattern({ seed: 4242, ...o }).events.length;
    const sparse = count({ density: 10, overlap: 0 });
    const packed = count({ density: 100, overlap: 0 });
    check('more density, more notes', packed > sparse, `${sparse} -> ${packed}`);

    const stacks = (overlap: number) => {
      const p = randomPattern({ seed: 99, density: 70, overlap });
      const byStart = new Map<number, number>();
      for (const e of p.events) byStart.set(e.start, (byStart.get(e.start) ?? 0) + 1);
      return [...byStart.values()].filter(n => n > 1).length;
    };
    check('no overlap gives a single line', stacks(0) === 0, `${stacks(0)} stacked positions`);
    check('full overlap stacks voices', stacks(100) > 0, `${stacks(100)} stacked positions`);
    check('still deterministic for a seed',
      JSON.stringify(randomPattern({ seed: 7, density: 60, overlap: 40 })) ===
      JSON.stringify(randomPattern({ seed: 7, density: 60, overlap: 40 })));
    check('always has a downbeat', [1, 2, 3, 4, 5].every(s =>
      randomPattern({ seed: s, density: 5, overlap: 0 }).events.some(e => e.start === 0)));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
