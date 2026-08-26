import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * OUTPUT VELOCITY is the last word on how hard anything leaves, applied after
 * everything else has had its say. Full means untouched, which is what it must
 * rest at — a trim left somewhere quiet would hold the whole instrument down
 * without anything on screen saying so.
 */
const played = async (over: any) => {
  const e = new OrchidEngine({
    ...defaultParams, mpeEnabled: false, autoBassRegister: 0, strumEngine: 0,
    velHumanize: 0, voicingPlayed: false, ...over,
  });
  const struck: number[] = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isCC || ev.isPitchBend || ev.isExpression || !ev.isOn) return;
    struck.push(ev.velocity);
  };
  e.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7]);
  await sleep(90);
  e.panic();
  return struck;
};

(async () => {
  console.log('\n=== The last word on velocity ===');
  {
    const full = await played({ outputVelocity: 127 });
    const half = await played({ outputVelocity: 64 });
    const quiet = await played({ outputVelocity: 10 });
    check('at full it changes nothing', full.length > 0 && Math.max(...full) > 60, `${full}`);
    check('halved, everything is quieter', Math.max(...half) < Math.max(...full), `${half} vs ${full}`);
    check('and it scales rather than clamping',
      Math.abs(Math.max(...half) - Math.max(...full) / 2) <= 2, `${Math.max(...half)} vs ${Math.max(...full) / 2}`);
    check('at its lowest nothing is silent', Math.min(...quiet) >= 1, `${quiet}`);
  }
  {
    // It applies to everything that leaves, not only to chords.
    const e = new OrchidEngine({
      ...defaultParams, mpeEnabled: false, arpeggioNoteLengthMs: 40, velHumanize: 0,
      outputVelocity: 40,
    });
    const struck: number[] = [];
    e.onOutputNote = (ev: any) => {
      if (ev.isCC || ev.isPitchBend || ev.isExpression || !ev.isOn) return;
      struck.push(ev.velocity);
    };
    e.handleArpeggioNoteOn(72, 120);
    await sleep(60);
    check('the strum pad is trimmed too', struck.length > 0 && struck[0] < 60, `${struck}`);
    e.panic();
  }
  {
    const e = new OrchidEngine({ ...defaultParams, mpeEnabled: false, outputVelocity: 30 });
    const struck: number[] = [];
    e.onOutputNote = (ev: any) => {
      if (ev.isCC || ev.isPitchBend || ev.isExpression || !ev.isOn) return;
      struck.push(ev.velocity);
    };
    e.startAudition([60, 64, 67], 120);
    await sleep(50);
    check('and so is an audition', struck.length === 3 && struck.every(v => v < 60), `${struck}`);
    e.stopAudition();
  }
  {
    check('it rests at full', defaultParams.outputVelocity === 127, `${defaultParams.outputVelocity}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
