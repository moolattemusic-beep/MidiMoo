import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * When the new chord has more notes than the one being glided from, one voice
 * has nothing to glide out of. ATTACK strikes it where it belongs, UNISON
 * enters it on a pitch already sounding and glides it out, DROP leaves it out.
 */
const change = async (mode: number) => {
  const e = new OrchidEngine({
    ...defaultParams, mpeEnabled: true, mpeGlideMode: 1, mpeGlideTimeMs: 30,
    autoBassRegister: 0, voicingPlayed: false, mpeNewVoice: mode,
  });
  const attacks: number[] = [];
  const sent = new Map<number, number>(), bend = new Map<number, number>();
  let capture = false;
  e.onOutputNote = (ev: any) => {
    if (ev.isCC || ev.isExpression) return;
    if (ev.isPitchBend) { bend.set(ev.mpeChannel, ev.pitchBendValue ?? 0); return; }
    if (ev.isOn) { sent.set(ev.mpeChannel, ev.pitch); if (capture) attacks.push(ev.pitch); }
    else sent.delete(ev.mpeChannel);
  };
  e.handleMidi(60, 100, true, false, false, false, true, [60, 64, 67], undefined);
  await sleep(110);
  e.handleMidi(60, 0, false, false, false, false, true, [60, 64, 67], undefined);
  await sleep(20);
  capture = true;
  e.handleMidi(62, 100, true, false, false, false, true, [62, 65, 69, 74], undefined);
  await sleep(140);
  const sounding = [...sent.entries()].map(([ch, p]) => Math.round(p + (bend.get(ch) ?? 0))).sort((a, b) => a - b);
  const stuckCheck = { engine: e };
  return { attacks, sounding, stuckCheck };
};

(async () => {
  console.log('\n=== ATTACK: as it was ===');
  {
    const { attacks, sounding, stuckCheck } = await change(0);
    check('the extra voice is struck at its own pitch', attacks.join() === '74', `${attacks}`);
    check('and the chord is complete', sounding.join() === '62,65,69,74', `${sounding}`);
    stuckCheck.engine.panic();
  }

  console.log('\n=== UNISON: enters where something is already sounding ===');
  {
    const { attacks, sounding, stuckCheck } = await change(1);
    check('one voice still enters', attacks.length === 1, `${attacks}`);
    // 69 is the nearest of the voices already heading somewhere, so the attack
    // lands there and is masked by it rather than being heard as a new note.
    check('but it enters on a pitch already sounding', attacks[0] !== 74, `entered at ${attacks[0]}`);
    check('the nearest one', attacks[0] === 69, `entered at ${attacks[0]}`);
    check('and glides out to where it belongs', sounding.join() === '62,65,69,74', `${sounding}`);
    stuckCheck.engine.panic();
  }

  console.log('\n=== DROP: it does not arrive ===');
  {
    const { attacks, sounding, stuckCheck } = await change(2);
    check('nothing is struck at all', attacks.length === 0, `${attacks}`);
    check('and the chord is one voice short', sounding.join() === '62,65,69', `${sounding}`);
    stuckCheck.engine.panic();
  }

  console.log('\n=== Nothing is left sounding, whichever way in ===');
  {
    for (const mode of [0, 1, 2]) {
      const e = new OrchidEngine({
        ...defaultParams, mpeEnabled: true, mpeGlideMode: 1, mpeGlideTimeMs: 20,
        autoBassRegister: 1, voicingPlayed: false, mpeNewVoice: mode,
      });
      const events: Array<{ pitch: number; ch: number; isOn: boolean }> = [];
      e.onOutputNote = (ev: any) => {
        if (ev.isCC || ev.isPitchBend || ev.isExpression) return;
        events.push({ pitch: ev.pitch, ch: ev.mpeChannel, isOn: ev.isOn });
      };
      const steps: Array<[number, number[]]> = [
        [60, [60, 64, 67]], [62, [62, 65, 69, 74]], [64, [64, 67]], [65, [65, 69, 72, 76, 79]], [60, [60, 64, 67]],
      ];
      let previous: number | null = null;
      for (const [key, pitches] of steps) {
        if (previous !== null) { e.handleMidi(previous, 0, false, false, false, false, true, pitches, undefined); await sleep(15); }
        e.handleMidi(key, 100, true, false, false, false, true, pitches, undefined);
        previous = key;
        await sleep(120);
      }
      e.handleMidi(previous!, 0, false, false, false, false, true, undefined, undefined);
      await sleep(400);
      const live = new Map<string, number>();
      for (const ev of events) {
        const key = `${ev.ch}:${ev.pitch}`;
        live.set(key, (live.get(key) ?? 0) + (ev.isOn ? 1 : -1));
      }
      const stuck = [...live.entries()].filter(([, n]) => n > 0);
      check(`mode ${mode} leaves nothing hanging`, stuck.length === 0, JSON.stringify(stuck));
      check(`mode ${mode} gives its channels back`,
        (e as any).mpeChannelsAllocated.filter(Boolean).length === 0,
        `${(e as any).mpeChannelsAllocated.filter(Boolean).length}`);
      e.panic();
    }
  }

  console.log('\n=== Dropping thins the chord, which is the trade ===');
  {
    // Worth pinning down rather than leaving as a warning: once a voice is
    // dropped it is not held, so the next chord has fewer to glide from and the
    // count cannot climb back until everything is released.
    const e = new OrchidEngine({
      ...defaultParams, mpeEnabled: true, mpeGlideMode: 1, mpeGlideTimeMs: 20,
      autoBassRegister: 0, voicingPlayed: false, mpeNewVoice: 2,
    });
    const sent = new Map<number, number>();
    e.onOutputNote = (ev: any) => {
      if (ev.isCC || ev.isPitchBend || ev.isExpression) return;
      if (ev.isOn) sent.set(ev.mpeChannel, ev.pitch); else sent.delete(ev.mpeChannel);
    };
    e.handleMidi(60, 100, true, false, false, false, true, [60, 64], undefined);
    await sleep(110);
    for (const [key, pitches] of [[62, [62, 65, 69, 74]], [64, [64, 67, 71, 76]]] as Array<[number, number[]]>) {
      e.handleMidi(key === 62 ? 60 : 62, 0, false, false, false, false, true, undefined, undefined);
      await sleep(15);
      e.handleMidi(key, 100, true, false, false, false, true, pitches, undefined);
      await sleep(110);
    }
    check('a two-note start caps every chord after it at two', sent.size === 2, `${sent.size} voices`);
    e.panic();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
