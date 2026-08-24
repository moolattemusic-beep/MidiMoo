import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { patternDurationMs, CHORD_PATTERNS } from '../src/lib/ChordPatterns.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const rec = (e: OrchidEngine) => {
  const ons: number[] = [], offs: number[] = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isPitchBend || ev.isCC || ev.isExpression) return;
    if (ev.isOn) ons.push(ev.pitch); else offs.push(ev.pitch);
  };
  return { ons, offs };
};

(async () => {
  console.log('\n=== Sustain lifts when a new chord arrives ===');
  {
    const e = new OrchidEngine({ ...defaultParams, strumEngine: 0 });
    const { ons, offs } = rec(e);
    e.handleControlChange(64, 127);                       // pedal down
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(60);
    e.handleMidi(60, 0, false, false, false, false, true, [60, 64, 67]); // key up, pedal holds
    await sleep(60);
    check('pedal keeps the chord sounding', offs.length === 0, `${offs.length} offs`);
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]); // new chord
    await sleep(80);
    check('the held chord was released', offs.length >= 3, `${offs.length} offs`);
    check('the old notes are the released ones', [60, 64, 67].every(p => offs.includes(p)), JSON.stringify(offs));
    check('the new chord is sounding', [65, 69, 72].every(p => ons.includes(p)), JSON.stringify(ons));
  }

  console.log('\n=== Silent register makes no sound ===');
  {
    const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, registerSilent: true });
    const { ons } = rec(e);
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(60);
    const before = ons.length;
    e.updateRegister(72);
    await sleep(80);
    check('sliding sounds nothing', ons.length === before, `${ons.length - before} new notes`);
    check('the setting still moved', e.params.chordRegisterStart === 72, `${e.params.chordRegisterStart}`);
  }

  console.log('\n=== Not silent: the slider re-voices, and the pedal stacks it ===');
  {
    const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, registerSilent: false });
    const { ons, offs } = rec(e);
    e.handleMidi(48, 100, true, false, false, false, true, [48, 52, 55]);
    await sleep(50);
    const before = ons.length;
    e.updateRegister(55); // the register already sits at 60, so move somewhere else
    await sleep(60);
    check('sliding re-voices what is sounding', ons.length > before, `${ons.length - before}`);
    check('and releases the old voicing', offs.length > 0, `${offs.length}`);
  }
  {
    const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, registerSilent: false });
    const { ons, offs } = rec(e);
    e.handleControlChange(64, 127);
    e.handleMidi(48, 100, true, false, false, false, true, [48, 52, 55]);
    await sleep(50);
    e.updateRegister(55);
    await sleep(50);
    e.updateRegister(62);
    await sleep(60);
    check('under the pedal nothing is released', offs.length === 0, `${offs.length} offs`);
    const soundingBefore = new Set(ons.filter(p => !offs.includes(p)));
    e.handleControlChange(64, 0);
    await sleep(60);
    // Only what the pedal alone was holding goes; the voicing the slider
    // actually landed on carries on sounding under the still-held key.
    check('lifting the pedal releases the stacked notes', offs.length > 0, `${offs.length} offs`);
    check('but not every note', offs.length < soundingBefore.size, `${offs.length} of ${soundingBefore.size}`);
    const stillOn = [...soundingBefore].filter(p => !offs.includes(p));
    check('the current voicing is still sounding', stillOn.length > 0, JSON.stringify(stillOn));
  }

  console.log('\n=== A chord change joins the cycle in progress ===');
  {
    const params = { ...defaultParams, patternEnabled: true, patternIndex: 10, patternBpm: 100 };
    const e = new OrchidEngine(params);
    rec(e);
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    const cycleMs = patternDurationMs(CHORD_PATTERNS[10], 100);
    await sleep(cycleMs * 0.5);
    const phaseBefore = e.getPatternPhase()!;
    e.handleMidi(65, 100, true, false, false, false, true, [65, 69, 72]);
    const phaseAfter = e.getPatternPhase()!;
    check('the cycle keeps its place', Math.abs(phaseAfter - phaseBefore) < 0.08,
      `${phaseBefore.toFixed(2)} -> ${phaseAfter.toFixed(2)}`);
    check('and is halfway through, not restarted', phaseAfter > 0.3, `${phaseAfter.toFixed(2)}`);
    e.handleMidi(60, 0, false, false, false, false, true, []);
    e.handleMidi(65, 0, false, false, false, false, true, []);
    await sleep(60);
    check('phase is let go when nothing is playing', e.getPatternPhase() === null);
  }

  console.log('\n=== A fresh chord starts its own cycle ===');
  {
    const params = { ...defaultParams, patternEnabled: true, patternIndex: 10, patternBpm: 100 };
    const e = new OrchidEngine(params);
    rec(e);
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(40);
    const phase = e.getPatternPhase()!;
    check('starts near the top of the cycle', phase < 0.15, `${phase.toFixed(3)}`);
    e.handleMidi(60, 0, false, false, false, false, true, []);
    await sleep(40);
  }

  console.log('\n=== An octave in the pattern moves the note ===');
  {
    const params = {
      ...defaultParams, patternEnabled: true, patternBpm: 120,
      patternCustom: JSON.stringify({
        name: 'T', lengthBeats: 4,
        events: [
          { voice: 1, start: 0, length: 48, velocity: 100, octave: -1 },
          { voice: 2, start: 96, length: 48, velocity: 100, octave: 1 },
          { voice: 3, start: 192, length: 48, velocity: 100 },
        ],
      }),
    };
    const e = new OrchidEngine(params);
    const { ons } = rec(e);
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67]);
    await sleep(1400);
    e.handleMidi(60, 0, false, false, false, false, true, []);
    check('voice 1 dropped an octave', ons.includes(48), JSON.stringify(ons));
    check('voice 2 raised an octave', ons.includes(76), JSON.stringify(ons));
    check('voice 3 left where it was', ons.includes(67), JSON.stringify(ons));
    await sleep(60);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
