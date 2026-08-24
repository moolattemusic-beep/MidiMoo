import { MidiDeviceManager } from '../src/lib/MidiDeviceManager.ts';
import { VelocityModulator } from '../src/lib/VelocityModulator.ts';
import { defaultParams } from '../src/types.ts';
(globalThis as any).window = { performance: { now: () => Date.now() } };

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function mgrRig() {
  const mgr: any = new MidiDeviceManager();
  const raw: number[][] = [];
  mgr.midiAccess = {} as any; mgr.selectedOutputId = 'x';
  mgr.outputs = [{ id: 'x', connection: 'open', send: (d: number[]) => raw.push([...d]) } as any];
  return { mgr, raw };
}
const bendCh = (m: number[]) => (m[0] & 0x0F) + 1;
const bendSt = (m: number[]) => (((m[2] << 7) | m[1]) - 8192) / 8192 * 48;

async function main() {
  console.log('=== Toggling MPE must not leave the offset on dead channels ===');
  {
    const { mgr, raw } = mgrRig();
    // MPE session: notes register channels 2 and 3
    mgr.sendMpePitchBend(2, 0, 48, 0);
    mgr.sendMpePitchBend(3, 0, 48, 0);
    raw.length = 0;
    mgr.setGlobalBendOffset(4);
    check('MPE on: every voice channel gets the offset',
      raw.filter(m => (m[0] & 0xF0) === 0xE0).every(m => Math.abs(bendSt(m) - 4) < 0.05) && raw.length === 2, `${raw.length}`);

    // Now MPE goes off. App clears the offset and the channel memory.
    mgr.setGlobalBendOffset(0);
    mgr.clearBendMemory();
    raw.length = 0;

    // Non-MPE notes live on channel 1 — the offset has to land there.
    mgr.setGlobalBendOffset(4);
    const bends = raw.filter(m => (m[0] & 0xF0) === 0xE0);
    console.log(`   after toggling off: ${bends.length} bend(s), channel ${bends.map(bendCh)}`);
    check('MPE off: offset goes to channel 1', bends.length === 1 && bendCh(bends[0]) === 1, `${bends.map(bendCh)}`);
    check('MPE off: same depth as MPE on', Math.abs(bendSt(bends[0]) - 4) < 0.05, `${bendSt(bends[0])}`);
    check('MPE off: nothing sent to the dead MPE channels', !bends.some(m => bendCh(m) > 1));
  }

  console.log('\n=== Without the clear, the bug reproduces ===');
  {
    const { mgr, raw } = mgrRig();
    mgr.sendMpePitchBend(2, 0, 48, 0);
    raw.length = 0;
    mgr.setGlobalBendOffset(4);   // no clearBendMemory: old behaviour
    const bends = raw.filter(m => (m[0] & 0xF0) === 0xE0);
    check('offset would go only to the stale MPE channel', bends.length === 1 && bendCh(bends[0]) === 2,
      'confirms the diagnosis: notes on ch1 would hear nothing');
  }

  console.log('\n=== Vibrato fade can start part way up ===');
  {
    const mk = (start: number) => {
      const params = { ...defaultParams, velModEnabled: true, vibratoEnabled: true,
        vibratoDepth: 1, vibratoRateHz: 6, vibratoFadeMs: 1200, vibratoFadeStart: start };
      const m = new VelocityModulator(params);
      const s: number[] = [];
      m.onPitchOffset = (v) => s.push(Math.abs(v));
      m.setParams(params);
      return { m, s };
    };
    for (const start of [0, 50, 100]) {
      const { m, s } = mk(start);
      m.noteOn(100);
      await sleep(220);       // early, well inside the fade
      const early = Math.max(...s);
      await sleep(1400);
      const full = Math.max(...s);
      console.log(`   start ${start}%: early swing ${early.toFixed(2)}st, full ${full.toFixed(2)}st`);
      check(`start ${start}%: begins near ${start}% of depth`, Math.abs(early - start / 100) < 0.3, `${early}`);
      check(`start ${start}%: still reaches full depth`, Math.abs(full - 1) < 0.1, `${full}`);
      m.disable();
    }
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
