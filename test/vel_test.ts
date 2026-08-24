import { VelocityModulator, stageDurationMs } from '../src/lib/VelocityModulator.ts';
import { MidiDeviceManager } from '../src/lib/MidiDeviceManager.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function mk(over: any = {}) {
  const params = { ...defaultParams, velModEnabled: true, ...over };
  const m = new VelocityModulator(params);
  const pitch: number[] = [], cc1: number[] = [];
  m.onPitchOffset = (v) => pitch.push(v);
  m.onCC1 = (v) => cc1.push(v);
  m.setParams(params);
  return { m, pitch, cc1, params };
}

async function main() {
  console.log('=== Envelope shape: rises then falls back to the anchor ===');
  {
    const { m, pitch } = mk({ velModPitchAmount: 12, velModPitchAttack: 40, velModPitchRelease: 60 });
    m.noteOn(127);
    await sleep(60);
    const peak = Math.max(...pitch);
    check('rises toward full depth at full velocity', peak > 8, `peak ${peak}`);
    await sleep(500);
    check('falls back to the anchor', pitch[pitch.length - 1] === 0, `ended at ${pitch[pitch.length - 1]}`);
    check('never exceeds the set depth', peak <= 12.001, `peak ${peak}`);
  }

  console.log('\n=== Velocity scales the depth ===');
  const peakFor = async (vel: number) => {
    const { m, pitch } = mk({ velModPitchAmount: 12, velModPitchAttack: 30, velModPitchRelease: 70 });
    m.noteOn(vel);
    await sleep(120);
    const p = Math.max(...pitch);
    m.disable();
    return p;
  };
  const soft = await peakFor(30), hard = await peakFor(127);
  check('soft note bends less than hard note', soft < hard * 0.5, `soft ${soft} hard ${hard}`);

  console.log('\n=== Sensitivity steepens the velocity response ===');
  {
    const peakAt = async (vel: number, sens: number) => {
      const { m, pitch } = mk({ velModPitchAmount: 12, velModPitchAttack: 30, velModPitchRelease: 80, velModSensitivity: sens });
      m.noteOn(vel);
      await sleep(140);
      const p = Math.max(...pitch);
      m.disable();
      return p;
    };

    // The whole point: a narrow band of playing must span more depth.
    for (const sens of [2, 3, 5]) {
      const soft = await peakAt(50, sens), hard = await peakAt(80, sens);
      const soft1 = await peakAt(50, 1), hard1 = await peakAt(80, 1);
      const spread = hard - soft, base = hard1 - soft1;
      console.log(`   x${sens}: velocity 50-80 spans ${spread.toFixed(2)}st (x1 spans ${base.toFixed(2)}st)`);
      check(`x${sens} widens the response over a narrow range`, spread > base * 1.5, `${spread} vs ${base}`);
      check(`x${sens} still distinguishes soft from hard`, spread > 0.5, `spread ${spread}`);
    }

    check('x1 is unchanged linear', Math.abs((await peakAt(64, 1)) - 6) < 1.2);
    check('mid velocity is the pivot', Math.abs((await peakAt(64, 6)) - (await peakAt(64, 1))) < 0.5);
    check('cannot exceed the set amount', (await peakAt(127, 8)) <= 12.001);
    check('cannot go below zero', (await peakAt(1, 8)) >= 0);
    check('silence stays silent', (await peakAt(0, 8)) === 0);
  }

  console.log('\n=== Chord window: a chord uses the first note only ===');
  {
    const { m, pitch } = mk({ velModPitchAmount: 12, velModPitchAttack: 50, velModPitchRelease: 90, velModChordThresholdMs: 80 });
    m.noteOn(20);            // quiet first note sets the depth
    await sleep(20);
    m.noteOn(127);           // rest of the chord must not retrigger
    await sleep(20);
    m.noteOn(127);
    await sleep(200);
    const peak = Math.max(...pitch);
    check('loud later notes do not raise the depth', peak < 12 * (40 / 127), `peak ${peak}`);
    m.disable();
  }
  {
    const { m, pitch } = mk({ velModPitchAmount: 12, velModPitchAttack: 50, velModPitchRelease: 90, velModChordThresholdMs: 40 });
    m.noteOn(10);
    await sleep(120);        // well past the window
    pitch.length = 0;
    m.noteOn(127);
    await sleep(150);
    check('a separate note does retrigger', Math.max(...pitch) > 3, `peak ${Math.max(...pitch)}`);
    m.disable();
  }

  console.log('\n=== Resting values ===');
  {
    const { m, pitch, cc1 } = mk({ velModCC1Anchor: 40, velModPitchAmount: 0, velModCC1Amount: 0 });
    m.noteOn(100);
    await sleep(80);
    check('pitch always rests at zero', pitch.every(v => v === 0), `${pitch.slice(0, 4)}`);
    check('CC1 rests at its anchor', cc1[cc1.length - 1] === 40, `${cc1[cc1.length - 1]}`);
    m.disable();
  }
  {
    const { m, pitch } = mk({ velModPitchAmount: 24 });
    m.noteOn(127);
    await sleep(400);
    check('amount reaches 24 semitones', Math.max(...pitch) > 20, `peak ${Math.max(...pitch)}`);
    check('returns to zero', pitch[pitch.length - 1] === 0, `${pitch[pitch.length - 1]}`);
    m.disable();
  }

  console.log('\n=== Mod wheel takes over the CC1 anchor ===');
  {
    const base = { ...defaultParams, velModEnabled: true, velModCC1Anchor: 10, velModCC1Amount: 0 };
    const m = new VelocityModulator(base);
    const cc1: number[] = [];
    m.onCC1 = (v) => cc1.push(v);
    m.setParams(base);
    m.noteOn(100);
    await sleep(60);
    check('starts at the slider anchor', cc1[cc1.length - 1] === 10, `${cc1[cc1.length - 1]}`);

    m.setWheelAnchor(90);
    await sleep(60);
    check('wheel overrides the slider anchor', cc1[cc1.length - 1] === 90, `${cc1[cc1.length - 1]}`);

    // Moving the slider is a change of value, and that reclaims the anchor.
    m.setParams({ ...base, velModCC1Anchor: 25 });
    await sleep(60);
    check('slider takes it back when moved', cc1[cc1.length - 1] === 25, `${cc1[cc1.length - 1]}`);

    m.setWheelAnchor(70);
    await sleep(60);
    check('wheel can take over again', cc1[cc1.length - 1] === 70, `${cc1[cc1.length - 1]}`);
    m.disable();
  }

  console.log('\n=== Disabling returns pitch to neutral ===');
  {
    const { m, pitch } = mk({ velModPitchAmount: 12, velModPitchAttack: 60, velModPitchRelease: 90 });
    m.noteOn(127);
    await sleep(120);
    check('offset applied while on', Math.max(...pitch) > 0, `${Math.max(...pitch)}`);
    m.setParams({ ...defaultParams, velModEnabled: false });
    await sleep(40);
    check('offset cleared when switched off', pitch[pitch.length - 1] === 0, `${pitch[pitch.length - 1]}`);
  }

  console.log('\n=== Disabled by default: emits nothing ===');
  {
    const params = { ...defaultParams };
    const m = new VelocityModulator(params);
    const seen: number[] = [];
    m.onPitchOffset = (v) => seen.push(v);
    m.onCC1 = (v) => seen.push(v);
    m.setParams(params);
    m.noteOn(127);
    await sleep(120);
    check('silent when the feature is off', seen.length === 0, `${seen.length} messages`);
  }

  console.log('\n=== Stage timing curve ===');
  {
    const pts = [0, 20, 50, 80, 95, 100].map(p => ({ p, ms: Math.round(stageDurationMs(p)) }));
    console.log('  ', JSON.stringify(pts));
    check('0 is instant', stageDurationMs(0) === 0);
    check('monotonically slower', pts.every((x, i) => i === 0 || x.ms >= pts[i-1].ms));
    check('capped at 10s', stageDurationMs(100) <= 10000);
  }

  console.log('\n=== Bend offset rides on top of glide, never replaces it ===');
  {
    const mgr: any = new MidiDeviceManager();
    const sent: number[][] = [];
    mgr.midiAccess = {} as any;
    mgr.selectedOutputId = 'x';
    mgr.outputs = [{ id: 'x', connection: 'open', send: (d: number[]) => sent.push([...d]) } as any];

    const bendOf = (msg: number[]) => (((msg[2] << 7) | msg[1]) - 8192) / 8192 * 48;
    mgr.sendMpePitchBend(3, 5, 48, 0);            // glide puts channel 3 at +5st
    check('glide bend sent as asked', Math.abs(bendOf(sent[0]) - 5) < 0.05, `${bendOf(sent[0])}`);

    sent.length = 0;
    mgr.setGlobalBendOffset(2);                    // velocity envelope adds +2st
    check('channel refreshed with glide + offset', sent.length === 1 && Math.abs(bendOf(sent[0]) - 7) < 0.05, `${sent.map(bendOf)}`);

    sent.length = 0;
    mgr.sendMpePitchBend(3, 6, 48, 0);            // glide moves on
    check('later glide keeps the offset', Math.abs(bendOf(sent[0]) - 8) < 0.05, `${bendOf(sent[0])}`);

    sent.length = 0;
    mgr.setGlobalBendOffset(0);
    check('removing the offset restores pure glide', Math.abs(bendOf(sent[0]) - 6) < 0.05, `${bendOf(sent[0])}`);

    sent.length = 0;
    mgr.sendMpePitchBend(5, -3, 48, 0);
    mgr.setGlobalBendOffset(1);
    check('every active channel is refreshed', sent.length === 3, `${sent.length} messages for 2 channels + 1 initial`);
  }

  console.log('\n=== Offset lands before anything has bent (MPE off) ===');
  {
    const mgr: any = new MidiDeviceManager();
    const sent: number[][] = [];
    mgr.midiAccess = {} as any;
    mgr.selectedOutputId = 'x';
    mgr.outputs = [{ id: 'x', connection: 'open', send: (d: number[]) => sent.push([...d]) } as any];
    const bendOf = (m: number[]) => (((m[2] << 7) | m[1]) - 8192) / 8192 * 48;

    // No note has bent, exactly the state at launch with MPE off.
    mgr.setGlobalBendOffset(3);
    check('offset reaches channel 1 with no prior bend', sent.length === 1, `${sent.length} messages`);
    check('on channel 1', sent.length > 0 && (sent[0][0] & 0x0F) === 0, `status ${sent[0]?.[0]}`);
    check('carries the offset', sent.length > 0 && Math.abs(bendOf(sent[0]) - 3) < 0.05, `${sent[0] && bendOf(sent[0])}`);

    // Once real channels exist, the master channel must not be doubled up.
    sent.length = 0;
    mgr.sendMpePitchBend(4, 0, 48, 0);
    sent.length = 0;
    mgr.setGlobalBendOffset(5);
    check('no extra master-channel bend once MPE channels exist', sent.length === 1, `${sent.length} messages`);
    check('sent on the MPE channel', (sent[0][0] & 0x0F) === 3, `status ${sent[0][0]}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
