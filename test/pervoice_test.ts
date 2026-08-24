import { VelocityModulator } from '../src/lib/VelocityModulator.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log('  PASS ', name); }
  else { fail++; console.log('  FAIL ', name, detail); }
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const mk = (over: any) => {
  const params = { ...defaultParams, velModEnabled: true, ...over };
  const m = new VelocityModulator(params);
  const voicePitch: Array<[number, number]> = [];
  const voiceCC74: Array<[number, number]> = [];
  const globalPitch: number[] = [];
  const globalCC74: number[] = [];
  m.onVoicePitchOffset = (ch, v) => voicePitch.push([ch, v]);
  m.onVoiceCC74 = (ch, v) => voiceCC74.push([ch, v]);
  m.onPitchOffset = (v) => globalPitch.push(v);
  m.onCC74 = (v) => globalCC74.push(v);
  m.setParams(params);
  return { m, voicePitch, voiceCC74, globalPitch, globalCC74 };
};

(async () => {
  console.log('\n=== Per voice: each channel modulates from its own velocity ===');
  {
    const { m, voicePitch } = mk({ mpeEnabled: true, velModPerVoice: true,
      velModPitchAmount: 12, velModPitchAttack: 55, velModPitchRelease: 90 });
    m.noteOn(127, 2);
    m.noteOn(40, 3);
    await sleep(150);
    const ch2 = Math.max(...voicePitch.filter(([c]) => c === 2).map(([, v]) => v));
    const ch3 = Math.max(...voicePitch.filter(([c]) => c === 3).map(([, v]) => v));
    check('both channels modulated', ch2 > 0 && ch3 > 0, `ch2=${ch2} ch3=${ch3}`);
    check('harder note bends further', ch2 > ch3, `ch2=${ch2} ch3=${ch3}`);
  }

  console.log('\n=== Per voice: vibrato stays global, not per channel ===');
  {
    const { m, voicePitch, globalPitch } = mk({ mpeEnabled: true, velModPerVoice: true,
      velModPitchAmount: 0, vibratoEnabled: true, vibratoDepth: 2, vibratoRateHz: 8, vibratoFadeMs: 0, vibratoFadeStart: 100 });
    m.noteOn(100, 2);
    await sleep(200);
    check('vibrato on the global offset', globalPitch.some(v => Math.abs(v) > 0), `${globalPitch.length} sent`);
    check('vibrato not duplicated per voice', voicePitch.every(([, v]) => v === 0), `${JSON.stringify(voicePitch.slice(0,3))}`);
  }

  console.log('\n=== Per voice: CC74 goes to the voice channel ===');
  {
    const { m, voiceCC74 } = mk({ mpeEnabled: true, velModPerVoice: true,
      velModCC74Enabled: true, velModCC74Amount: 100, velModCC74Attack: 55, velModCC74Release: 90 });
    m.noteOn(127, 4);
    await sleep(150);
    check('CC74 sent on its channel', voiceCC74.some(([c, v]) => c === 4 && v > 0), `${JSON.stringify(voiceCC74.slice(0,3))}`);
  }

  console.log('\n=== Channel handed back at rest ===');
  {
    const { m, voicePitch } = mk({ mpeEnabled: true, velModPerVoice: true,
      velModPitchAmount: 12, velModPitchAttack: 0, velModPitchRelease: 5 });
    m.noteOn(127, 5);
    await sleep(30);
    m.noteOff(5);
    await sleep(250);
    const last = voicePitch.filter(([c]) => c === 5).map(([, v]) => v).pop();
    check('returns to neutral when released', last === 0, `${last}`);
  }

  console.log('\n=== MPE off: unchanged single-envelope path ===');
  {
    const { m, voicePitch, globalPitch, globalCC74 } = mk({ mpeEnabled: false,
      velModPitchAmount: 12, velModPitchAttack: 55, velModPitchRelease: 90,
      velModCC74Enabled: true, velModCC74Amount: 100, velModCC74Attack: 55 });
    m.noteOn(127, 2); // channel offered but MPE is off
    await sleep(150);
    check('no per-voice output', voicePitch.length === 0, `${voicePitch.length}`);
    check('pitch on the global offset', globalPitch.some(v => v > 0), `${globalPitch.length}`);
    check('CC74 on the master channel', globalCC74.some(v => v > 0), `${globalCC74.length}`);
  }

  console.log('\n=== Per voice off under MPE: shared envelope ===');
  {
    const { m, voicePitch, globalPitch } = mk({ mpeEnabled: true, velModPerVoice: false,
      velModPitchAmount: 12, velModPitchAttack: 55, velModPitchRelease: 90 });
    m.noteOn(127, 2);
    await sleep(150);
    check('no per-voice output', voicePitch.length === 0, `${voicePitch.length}`);
    check('pitch on the global offset', globalPitch.some(v => v > 0), `${globalPitch.length}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  // The modulator's ticker keeps the loop alive; nothing left to wait for.
  process.exit(0);
})();
