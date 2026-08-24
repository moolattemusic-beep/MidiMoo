import { MidiDeviceManager } from '../src/lib/MidiDeviceManager.ts';
import { VelocityModulator } from '../src/lib/VelocityModulator.ts';
import { defaultParams } from '../src/types.ts';

// The MIDI layer timestamps sends off window.performance in the browser.
(globalThis as any).window = { performance: { now: () => Date.now() } };

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function mgrRig() {
  const mgr: any = new MidiDeviceManager();
  const raw: number[][] = [];
  mgr.midiAccess = {} as any;
  mgr.selectedOutputId = 'x';
  mgr.outputs = [{ id: 'x', connection: 'open', send: (d: number[]) => raw.push([...d]) } as any];
  return { mgr, raw };
}
// RPN 6 on a channel carries the bend range the synth is told to use
const rpnRange = (raw: number[][]) => {
  const m = raw.filter(x => (x[0] & 0xF0) === 0xB0 && x[1] === 6);
  return m.length ? m[m.length - 1][2] : null;
};
const isZoneMsg = (raw: number[][]) =>
  raw.some((x, i) => x[0] === 0xB0 && x[1] === 100 && x[2] === 6);

async function main() {
  console.log('=== The MPE + velocity mod bug ===');
  {
    // What the app now does in each combination.
    const mpeOn = mgrRig();
    mpeOn.mgr.setMpeBendRange(48);
    await sleep(60);
    check('MPE on: synth told the configured range', rpnRange(mpeOn.raw) === 48, `${rpnRange(mpeOn.raw)}`);
    check('MPE on: zone message sent, as before', isZoneMsg(mpeOn.raw));

    const velOnly = mgrRig();
    velOnly.mgr.setBendRangeOnly(48);
    await sleep(60);
    check('MPE off + vel mod: synth told the same range', rpnRange(velOnly.raw) === 48, `${rpnRange(velOnly.raw)}`);
    check('MPE off + vel mod: NO zone message', !isZoneMsg(velOnly.raw), 'must not put the synth into MPE mode');

    // With both told 48, the same offset now sounds the same either way.
    const decode = (m: number[], range: number) => (((m[2] << 7) | m[1]) - 8192) / 8192 * range;
    for (const [label, rig] of [['MPE on', mgrRig()], ['MPE off', mgrRig()]] as const) {
      if (label === 'MPE on') rig.mgr.sendMpePitchBend(2, 0, 48, 0);
      rig.raw.length = 0;
      rig.mgr.setGlobalBendOffset(6);
      const bends = rig.raw.filter(m => (m[0] & 0xF0) === 0xE0);
      const st = decode(bends[0], 48);
      console.log(`   ${label}: 6st offset -> ${st.toFixed(2)}st on the wire`);
      check(`${label}: offset lands at its true size`, Math.abs(st - 6) < 0.05, `${st}`);
    }
  }

  console.log('\n=== Per-layer switches ===');
  {
    const mk = (over: any) => {
      const params = { ...defaultParams, velModEnabled: true, velModPitchAmount: 6,
        velModPitchAttack: 40, velModPitchRelease: 90, velModCC1Amount: 80, velModCC1Anchor: 20, ...over };
      const m = new VelocityModulator(params);
      const pitch: number[] = [], cc1: number[] = [];
      m.onPitchOffset = (v) => pitch.push(v);
      m.onCC1 = (v) => cc1.push(v);
      m.setParams(params);
      return { m, pitch, cc1 };
    };

    const both = mk({});
    both.m.noteOn(127); await sleep(200);
    check('both layers active by default', Math.max(...both.pitch) > 1 && Math.max(...both.cc1) > 30);
    both.m.disable();

    const noPitch = mk({ velModPitchEnabled: false });
    noPitch.m.noteOn(127); await sleep(200);
    check('pitch layer off -> no pitch movement', noPitch.pitch.every(v => v === 0), `${noPitch.pitch.slice(0,4)}`);
    check('pitch off leaves CC1 working', Math.max(...noPitch.cc1) > 30, `${Math.max(...noPitch.cc1)}`);
    noPitch.m.disable();

    const noCC1 = mk({ velModCC1Enabled: false });
    noCC1.m.noteOn(127); await sleep(200);
    check('CC1 layer off -> no CC1 movement', noCC1.cc1.length === 0 || noCC1.cc1.every(v => v === 20), `${noCC1.cc1.slice(0,4)}`);
    check('CC1 off leaves pitch working', Math.max(...noCC1.pitch) > 1, `${Math.max(...noCC1.pitch)}`);
    noCC1.m.disable();
  }

  console.log('\n=== CC80 centre is adopted, depth is bipolar ===');
  {
    const mk = (over: any) => {
      const params = { ...defaultParams, velModEnabled: true, vibratoEnabled: true,
        vibratoDepth: 0, vibratoFadeMs: 0, vibratoRateHz: 5, vibratoCC80Depth: 30, ...over };
      const m = new VelocityModulator(params);
      const cc80: number[] = [];
      m.onCC80 = (v) => cc80.push(v);
      m.setParams(params);
      return { m, cc80 };
    };

    const def = mk({});
    def.m.noteOn(100); await sleep(700);
    const lo = Math.min(...def.cc80), hi = Math.max(...def.cc80);
    check('centres on the slider value', lo >= 30 && hi <= 98 && lo < 50 && hi > 78, `${lo}..${hi}`);
    def.m.disable();

    const set = mk({ vibratoCC80Center: 100 });
    set.m.noteOn(100); await sleep(700);
    const lo2 = Math.min(...set.cc80), hi2 = Math.max(...set.cc80);
    console.log(`   centre 100 -> range ${lo2}..${hi2}`);
    check('swings around the set centre', lo2 > 60 && hi2 > 110, `${lo2}..${hi2}`);
    set.m.disable();

    // A controller sending CC80 takes the centre over live; moving the slider
    // takes it back.
    const live = mk({ vibratoCC80Center: 40 });
    live.m.setCC80Center(100);
    live.m.noteOn(100); await sleep(500);
    check('controller overrides the slider centre', Math.max(...live.cc80) > 110, `${Math.max(...live.cc80)}`);
    live.m.setParams({ ...defaultParams, velModEnabled: true, vibratoEnabled: true,
      vibratoDepth: 0, vibratoFadeMs: 0, vibratoRateHz: 5, vibratoCC80Depth: 30, vibratoCC80Center: 50 });
    live.cc80.length = 0;
    live.m.noteOn(100); await sleep(500);
    check('moving the slider takes the centre back', Math.max(...live.cc80) < 90, `${Math.max(...live.cc80)}`);
    live.m.disable();

    // The reported bug: after the swing ends it must settle on the centre.
    const rest = mk({ vibratoCC80Center: 30 });
    rest.m.noteOn(100); await sleep(400);
    rest.m.noteOff(); await sleep(120);
    check('returns to the centre it was told, not 64', rest.cc80[rest.cc80.length - 1] === 30, `${rest.cc80[rest.cc80.length - 1]}`);
    rest.m.disable();

    // Negative depth must mirror positive depth
    const posSamples: { t: number; v: number }[] = [];
    const negSamples: { t: number; v: number }[] = [];
    for (const [depth, out] of [[30, posSamples], [-30, negSamples]] as const) {
      const params = { ...defaultParams, velModEnabled: true, vibratoEnabled: true,
        vibratoDepth: 0, vibratoFadeMs: 0, vibratoRateHz: 4, vibratoCC80Depth: depth };
      const m = new VelocityModulator(params);
      const t0 = Date.now();
      m.onCC80 = (v) => (out as any).push({ t: Date.now() - t0, v });
      m.setParams(params);
      m.noteOn(100);
      await sleep(500);
      m.disable();
    }
    const firstMove = (a: { t: number; v: number }[]) => a.find(x => Math.abs(x.v - 64) > 4);
    const p = firstMove(posSamples), n = firstMove(negSamples);
    console.log(`   first move: +30 -> ${p?.v}, -30 -> ${n?.v}`);
    check('negative depth flips the direction', !!p && !!n && (p.v > 64) !== (n.v > 64), `${p?.v} vs ${n?.v}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
