import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * The chord grid slides between two chords on the same root by re-stating the
 * held key rather than by overlapping two of them, because the engine keys a
 * held chord by its root. This is whether that path actually glides the voices
 * or quietly strikes them again.
 */
const run = async (isUpdate: boolean, glideMode = 1, mpe = true) => {
  const e = new OrchidEngine({
    ...defaultParams,
    mpeEnabled: mpe, mpeGlideMode: glideMode, mpeGlideTimeMs: 40, mpeGraceMs: 60,
    autoBassRegister: 0, voicingPlayed: false,
  });
  const events: Array<{ kind: string; pitch: number; ch: number }> = [];
  let capture = false;
  e.onOutputNote = (ev: any) => {
    if (ev.isCC || ev.isExpression) return;
    if (!capture) return;
    if (ev.isPitchBend) events.push({ kind: 'bend', pitch: ev.pitchBendValue ?? 0, ch: ev.mpeChannel });
    else events.push({ kind: ev.isOn ? 'on' : 'off', pitch: ev.pitch, ch: ev.mpeChannel });
  };

  // C major on key 48, as the grid sends it.
  e.handleMidi(48, 100, true, false, false, false, true, undefined, [0, 4, 7]);
  await sleep(80);
  capture = true;
  // C minor on the same key.
  e.handleMidi(48, 100, true, false, isUpdate, false, true, undefined, [0, 3, 7]);
  await sleep(120);

  return {
    ons: events.filter(x => x.kind === 'on'),
    offs: events.filter(x => x.kind === 'off'),
    bends: events.filter(x => x.kind === 'bend' && x.pitch !== 0),
    engine: e,
  };
};

(async () => {
  console.log('=== Same root, re-stated as an update ===');
  {
    const r = await run(true);
    console.log(`     ons=${r.ons.length} offs=${r.offs.length} bends=${r.bends.length}`);
    // Gliding means the voices already sounding are bent to the new chord
    // rather than being struck again: the third moves from E to Eb by bending.
    check('the voices are bent rather than struck again',
      r.bends.length > 0, `${r.bends.length} bends`);
    check('and nothing is restruck', r.ons.length === 0,
      `${r.ons.map(o => `ch${o.ch}:${o.pitch}`).join(' ')}`);
    r.engine.panic();
  }

  console.log('\n=== The same change sent as a fresh note-on ===');
  {
    // What the grid did before, and why it sounded restruck.
    const r = await run(false);
    console.log(`     ons=${r.ons.length} offs=${r.offs.length} bends=${r.bends.length}`);
    check('a plain note-on strikes the chord again instead',
      r.ons.length > 0, `${r.ons.length} note-ons`);
    r.engine.panic();
  }

  console.log('\n=== It glides whichever glide mode is set ===');
  {
    // The board says a glide mode is needed; this is whether that is true, and
    // which setting actually has to be on for a slide to bend rather than
    // strike. Getting this wrong sends someone hunting the wrong switch.
    for (const mode of [0, 1, 2, 3]) {
      const r = await run(true, mode);
      check(`glide mode ${mode} bends rather than restriking`,
        r.bends.length > 0 && r.ons.length === 0,
        `${r.bends.length} bends, ${r.ons.length} ons`);
      r.engine.panic();
    }
  }

  console.log('\n=== With MPE off there is nothing to bend ===');
  {
    const r = await run(true, 1, false);
    check('so the chord is restated as notes instead', r.bends.length === 0,
      `${r.bends.length} bends`);
    r.engine.panic();
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
})();
