import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const P = (events: any[], lengthBeats = 4) => JSON.stringify({ name: 'T', lengthBeats, events });
const CHORD = [60, 64, 67];
// Where autoBassRegister 1 puts the root, read off the engine rather than
// worked out here, so this suite tests the routing and not the folding.
let BASS = -1;

const rig = (over: any) => {
  const e = new OrchidEngine({
    ...defaultParams, velHumanize: 0, patternHumanize: 0,
    patternEnabled: true, patternBpm: 240, autoBassRegister: 1, ...over,
  });
  const ons: number[] = [], offs: number[] = [];
  e.onOutputNote = (ev: any) => {
    if (ev.isPitchBend || ev.isCC) return;
    (ev.isOn ? ons : offs).push(ev.pitch);
  };
  return { e, ons, offs };
};

(async () => {
  {
    const pat = P([{ voice: 2, start: 0, length: 24, velocity: 100 }]);
    const { e, ons } = rig({ patternCustom: pat, patternBassMode: 0 });
    e.handleMidi(60, 90, true, false, false, false, true, CHORD);
    await sleep(260);
    BASS = Math.min(...ons);
    e.panic(); await sleep(40);
  }

  console.log('\n=== The bass sounding on its own ===');
  {
    // Only voice 2 is named, so nothing sounds the pool's lowest rung. In OWN
    // the bass is not a rung of the figure at all, so it arrives regardless.
    const pat = P([{ voice: 2, start: 0, length: 24, velocity: 100 }]);
    const { e, ons } = rig({ patternCustom: pat, patternBassMode: 0 });
    e.handleMidi(60, 90, true, false, false, false, true, CHORD);
    await sleep(260);
    check('the bass sounds', ons.includes(BASS), `${ons}`);
    check('the figure sounds above it', ons.some(p => p > BASS), `${ons}`);
    e.panic(); await sleep(40);
  }
  {
    const pat = P([{ voice: 1, start: 0, length: 24, velocity: 100 }]);
    const { e, ons } = rig({ patternCustom: pat, patternBassMode: 0 });
    e.handleMidi(60, 90, true, false, false, false, true, CHORD);
    await sleep(260);
    // Sounding on its own means the figure keeps its own lowest voice: the
    // bass is extra, not a substitute for it.
    check('the figure still plays its own lowest voice', ons.includes(60), `${ons}`);
    check('and the bass is underneath it', ons.includes(BASS), `${ons}`);
    e.panic(); await sleep(40);
  }

  console.log('\n=== The bass as the figure\'s lowest voice ===');
  {
    const pat = P([{ voice: 1, start: 0, length: 24, velocity: 100 }]);
    const { e, ons } = rig({ patternCustom: pat, patternBassMode: 1 });
    e.handleMidi(60, 90, true, false, false, false, true, CHORD);
    await sleep(260);
    check('voice 1 is the bass note', ons.includes(BASS), `${ons}`);
    // 60 was the lowest rung before the bass joined; now it is the second.
    check('it displaces what was lowest', !ons.includes(60), `${ons}`);
    e.panic(); await sleep(40);
  }
  {
    // Nothing names the lowest rung, so in this mode the bass never sounds —
    // there is no separate bass to fall back on. That is the difference.
    const pat = P([{ voice: 2, start: 0, length: 24, velocity: 100 }]);
    const { e, ons } = rig({ patternCustom: pat, patternBassMode: 1 });
    e.handleMidi(60, 90, true, false, false, false, true, CHORD);
    await sleep(260);
    check('an unnamed lowest voice leaves no bass', !ons.includes(BASS), `${ons}`);
    check('the figure still sounds', ons.length > 0, `${ons}`);
    e.panic(); await sleep(40);
  }
  {
    // Whichever mode, releasing the key must leave nothing sounding.
    for (const mode of [0, 1]) {
      const pat = P([{ voice: 1, start: 0, length: 24, velocity: 100 }, { voice: 2, start: 24, length: 24, velocity: 90 }]);
      const { e, ons, offs } = rig({ patternCustom: pat, patternBassMode: mode });
      e.handleMidi(60, 90, true, false, false, false, true, CHORD);
      await sleep(300);
      e.handleMidi(60, 0, false, false, false, false, true, CHORD);
      await sleep(200);
      const hanging = ons.filter(p => ons.filter(x => x === p).length > offs.filter(x => x === p).length);
      check(`mode ${mode} leaves nothing hanging`, hanging.length === 0, `${hanging}`);
      e.panic(); await sleep(40);
    }
  }
  {
    // Changing chord under a running pattern goes through the update path,
    // which has its own copy of the bass decision.
    const pat = P([{ voice: 1, start: 0, length: 12, velocity: 100 }], 1);
    const { e, ons } = rig({ patternCustom: pat, patternBassMode: 1 });
    e.handleMidi(60, 90, true, false, false, false, true, CHORD);
    await sleep(160);
    const before = ons.length;
    e.handleMidi(60, 90, true, false, false, false, true, [62, 65, 69]);
    await sleep(600);
    const after = ons.slice(before);
    check('the new chord still sounds', after.length > 0, `${after}`);
    check('and its own lowest note is displaced by the bass', !after.includes(62), `${after}`);
    e.panic(); await sleep(40);
  }
  {
    // The same change in OWN mode: the figure keeps its lowest note, because
    // the bass is not standing in for it.
    const pat = P([{ voice: 1, start: 0, length: 12, velocity: 100 }], 1);
    const { e, ons } = rig({ patternCustom: pat, patternBassMode: 0 });
    e.handleMidi(60, 90, true, false, false, false, true, CHORD);
    await sleep(160);
    const before = ons.length;
    e.handleMidi(60, 90, true, false, false, false, true, [62, 65, 69]);
    await sleep(600);
    const after = ons.slice(before);
    check('the new chord keeps its own lowest note', after.includes(62), `${after}`);
    e.panic(); await sleep(40);
  }

  console.log('\n=== The arpeggio hands its shared channel back ===');
  {
    const e = new OrchidEngine({ ...defaultParams, mpeEnabled: true, arpeggioMpeChannels: false, arpeggioNoteLengthMs: 30 });
    const held = () => (e as any).mpeChannelsAllocated.filter(Boolean).length;
    e.handleArpeggioNoteOn(72, 100, );
    await sleep(20);
    check('a shared channel is taken', held() === 1, `${held()}`);
    e.handleArpeggioNoteOff(72);
    await sleep(20);
    check('it is kept while the routing wants it', held() === 1, `${held()}`);

    // Switching back to per-note channels is what used to strand it.
    e.params = { ...e.params, arpeggioMpeChannels: true };
    e.handleArpeggioNoteOn(74, 100);
    await sleep(20);
    e.handleArpeggioNoteOff(74);
    await sleep(20);
    check('switching to per-note channels frees it', held() === 0, `${held()}`);

    // And turning MPE off entirely.
    e.params = { ...e.params, arpeggioMpeChannels: false };
    e.handleArpeggioNoteOn(76, 100);
    await sleep(20);
    e.params = { ...e.params, mpeEnabled: false };
    e.handleArpeggioNoteOff(76);
    await sleep(20);
    check('turning MPE off frees it', held() === 0, `${held()}`);
    e.panic(); await sleep(40);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
