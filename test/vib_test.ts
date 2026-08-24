import { VelocityModulator } from '../src/lib/VelocityModulator.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function mk(over: any = {}) {
  const params = {
    ...defaultParams, velModEnabled: true, vibratoEnabled: true,
    vibratoDepth: 1, vibratoRateHz: 6, vibratoFadeMs: 600, ...over,
  };
  const m = new VelocityModulator(params);
  const samples: { t: number; v: number }[] = [];
  const cc80: { t: number; v: number }[] = [];
  const t0 = Date.now();
  m.onPitchOffset = (v) => samples.push({ t: Date.now() - t0, v });
  m.onCC80 = (v) => cc80.push({ t: Date.now() - t0, v });
  m.setParams(params);
  return { m, samples, cc80 };
}
// Peak absolute deviation inside a time window
const swing = (s: { t: number; v: number }[], from: number, to: number) => {
  const w = s.filter(x => x.t >= from && x.t <= to).map(x => Math.abs(x.v));
  return w.length ? Math.max(...w) : 0;
};
// Count zero crossings to estimate LFO speed
const crossings = (s: { t: number; v: number }[], from: number, to: number) => {
  const w = s.filter(x => x.t >= from && x.t <= to);
  let n = 0;
  for (let i = 1; i < w.length; i++) if ((w[i - 1].v < 0) !== (w[i].v < 0)) n++;
  return n;
};

async function main() {
  console.log('=== Fades in rather than arriving fully formed ===');
  {
    const { m, samples } = mk({ vibratoFadeMs: 800 });
    m.noteOn(100);
    await sleep(1200);
    const early = swing(samples, 0, 120);
    const mid = swing(samples, 350, 500);
    const late = swing(samples, 850, 1150);
    console.log(`   swing: early ${early.toFixed(2)}st, mid ${mid.toFixed(2)}st, late ${late.toFixed(2)}st`);
    check('starts near silent', early < 0.25, `${early}`);
    check('grows through the fade', mid > early * 1.8, `${early} -> ${mid}`);
    check('reaches full depth', Math.abs(late - 1) < 0.12, `${late}`);
    check('never exceeds depth', Math.max(...samples.map(s => Math.abs(s.v))) <= 1.001);
    m.disable();
  }

  console.log('\n=== Rate starts at half speed and winds up ===');
  {
    // Count over full seconds: a 500ms window is only ~8 crossings wide, so a
    // single boundary landing either side of a crossing swings the result 14%.
    const { m, samples } = mk({ vibratoFadeMs: 2000, vibratoRateHz: 8, vibratoDepth: 1 });
    m.noteOn(100);
    await sleep(4600);
    // 8Hz is 16 crossings/sec at full speed, 8/sec at the half-speed start.
    const early = crossings(samples, 50, 1050);
    const late = crossings(samples, 3400, 4400);
    console.log(`   crossings per second: early ${early}, late ${late}`);
    check('speeds up as it intensifies', late > early * 1.3, `${early} -> ${late}`);
    check('settles near the set rate', Math.abs(late - 16) <= 3, `${late} (expect ~16)`);
    check('starts near half the set rate', early >= 8 && early <= 14, `${early}`);
    m.disable();
  }

  console.log('\n=== Zero fade is immediate ===');
  {
    const { m, samples } = mk({ vibratoFadeMs: 0, vibratoDepth: 1 });
    m.noteOn(100);
    await sleep(300);
    check('full depth straight away', swing(samples, 0, 200) > 0.85, `${swing(samples, 0, 200)}`);
    m.disable();
  }

  console.log('\n=== A new note restarts the swell ===');
  {
    const { m, samples } = mk({ vibratoFadeMs: 900 });
    m.noteOn(100);
    await sleep(1100);
    const before = swing(samples, 900, 1100);
    samples.length = 0;
    m.noteOff();
    m.noteOn(100);          // fresh note
    await sleep(140);
    const after = swing(samples, 0, 130);
    check('was at full depth', Math.abs(before - 1) < 0.15, `${before}`);
    check('drops back to near zero on a new note', after < 0.3, `${after}`);
    m.disable();
  }

  console.log('\n=== Stops when nothing is sounding ===');
  {
    const { m, samples } = mk();
    m.noteOn(100);
    await sleep(500);
    check('running while a note sounds', swing(samples, 200, 500) > 0.1);
    samples.length = 0;
    m.noteOff();
    await sleep(300);
    const last = samples[samples.length - 1];
    check('returns to zero', last === undefined || last.v === 0, `${last?.v}`);
    check('stops emitting once silent', samples.filter(s => s.t > 120).length <= 1, `${samples.length} messages after release`);
  }

  console.log('\n=== Layers with the velocity envelope ===');
  {
    const { m, samples } = mk({ vibratoDepth: 0.5, vibratoFadeMs: 0, velModPitchAmount: 6, velModPitchAttack: 0, velModPitchRelease: 95 });
    m.noteOn(127);
    await sleep(200);
    const peak = Math.max(...samples.map(s => s.v));
    check('sums both layers', peak > 6, `peak ${peak} (envelope 6 + vibrato 0.5)`);
    check('stays within the sum', peak <= 6.6, `${peak}`);
    m.disable();
  }

  console.log('\n=== Off by default and when disabled ===');
  {
    const params = { ...defaultParams, velModEnabled: true };
    const m = new VelocityModulator(params);
    const seen: number[] = [];
    m.onPitchOffset = (v) => seen.push(v);
    m.setParams(params);
    m.noteOn(100);
    await sleep(300);
    check('silent with vibrato off', seen.every(v => v === 0), `${seen.slice(0, 5)}`);
    m.disable();
  }

  console.log('\n=== CC80 tremolo rides the same LFO ===');
  {
    const { m, samples, cc80 } = mk({
      vibratoDepth: 1, vibratoCC80Depth: 40, vibratoCC80Anchor: 64,
      vibratoFadeMs: 0, vibratoRateHz: 5,
    });
    m.noteOn(100);
    await sleep(1600);
    m.noteOff();
    await sleep(80);

    check('CC80 is being sent', cc80.length > 10, `${cc80.length} messages`);
    check('stays inside 0-127', cc80.every(c => c.v >= 0 && c.v <= 127));
    const lo = Math.min(...cc80.map(c => c.v)), hi = Math.max(...cc80.map(c => c.v));
    console.log(`   CC80 range ${lo}..${hi} around centre 64`);
    check('swings both sides of centre', lo < 40 && hi > 88, `${lo}..${hi}`);
    check('does not exceed the set depth', lo >= 24 - 2 && hi <= 104 + 2, `${lo}..${hi}`);

    // Phase lock: CC80 above centre must line up with positive pitch offset.
    let agree = 0, compared = 0;
    for (const c of cc80.filter(x => x.t > 200 && x.t < 1400 && Math.abs(x.v - 64) > 8)) {
      const near = samples.reduce((best, s) =>
        Math.abs(s.t - c.t) < Math.abs(best.t - c.t) ? s : best, samples[0]);
      if (Math.abs(near.v) < 0.15) continue;
      compared++;
      if ((c.v > 64) === (near.v > 0)) agree++;
    }
    console.log(`   phase agreement ${agree}/${compared}`);
    check('tremolo is in phase with the vibrato', compared > 20 && agree / compared > 0.9, `${agree}/${compared}`);

    check('returns to centre when notes stop', cc80[cc80.length - 1].v === 64, `${cc80[cc80.length - 1].v}`);
    m.disable();
  }

  console.log('\n=== CC80 message rate is capped ===');
  {
    const { m, cc80 } = mk({ vibratoDepth: 0, vibratoCC80Depth: 60, vibratoFadeMs: 0, vibratoRateHz: 10 });
    m.noteOn(100);
    await sleep(2000);
    const perSec = cc80.filter(c => c.t > 200).length / 1.8;
    console.log(`   ${perSec.toFixed(0)} CC80 messages/sec at 10Hz`);
    check('throttled to about 50/sec or less', perSec <= 60, `${perSec}`);
    check('still enough for a smooth sweep', perSec > 25, `${perSec}`);
    m.disable();
  }

  console.log('\n=== CC80 depth 0 sends nothing ===');
  {
    const { m, cc80 } = mk({ vibratoDepth: 1, vibratoCC80Depth: 0 });
    m.noteOn(100);
    await sleep(400);
    check('silent when CC80 depth is zero', cc80.length === 0, `${cc80.length} messages`);
    m.disable();
  }

  console.log('\n=== Bigger pitch depth is available ===');
  {
    const { m, samples } = mk({ vibratoDepth: 10, vibratoFadeMs: 0 });
    m.noteOn(100);
    await sleep(500);
    const peak = Math.max(...samples.map(s => Math.abs(s.v)));
    check('reaches 10 semitones', peak > 9.5, `${peak}`);
    m.disable();
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
