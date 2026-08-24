import { MidiDeviceManager } from '../src/lib/MidiDeviceManager.ts';
(globalThis as any).window = { performance: { now: () => Date.now() } };

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

function rig() {
  const mgr: any = new MidiDeviceManager();
  const raw: number[][] = [];
  mgr.midiAccess = {} as any; mgr.selectedOutputId = 'x';
  mgr.outputs = [{ id: 'x', connection: 'open', send: (d: number[]) => raw.push([...d]) } as any];
  return { mgr, raw };
}
const bends = (raw: number[][]) => raw.filter(m => (m[0] & 0xF0) === 0xE0);
const ch = (m: number[]) => (m[0] & 0x0F) + 1;
const st = (m: number[]) => (((m[2] << 7) | m[1]) - 8192) / 8192 * 48;

function main() {
  console.log('=== MPE: the master channel must never carry the offset ===');
  {
    const { mgr, raw } = rig();
    mgr.setMpeMode(true);
    raw.length = 0;

    // Offset arrives before any note has registered a member channel.
    mgr.setGlobalBendOffset(3);
    check('no bend at all until a voice exists', bends(raw).length === 0, `${bends(raw).map(m => `ch${ch(m)} ${st(m).toFixed(2)}st`)}`);
    check('nothing on the master channel', !bends(raw).some(m => ch(m) === 1));

    // A voice appears; only it should carry the offset.
    raw.length = 0;
    mgr.sendMpePitchBend(2, 0, 48, 0);
    const perVoice = bends(raw);
    check('member channel carries it once', perVoice.length === 1 && ch(perVoice[0]) === 2 && Math.abs(st(perVoice[0]) - 3) < 0.05,
      `${perVoice.map(m => `ch${ch(m)} ${st(m).toFixed(2)}st`)}`);
  }

  console.log('\n=== Non-MPE: channel 1 is where the notes are ===');
  {
    const { mgr, raw } = rig();
    mgr.setMpeMode(false);
    raw.length = 0;
    mgr.setGlobalBendOffset(3);
    const b = bends(raw);
    check('offset lands on channel 1', b.length === 1 && ch(b[0]) === 1 && Math.abs(st(b[0]) - 3) < 0.05,
      `${b.map(m => `ch${ch(m)} ${st(m).toFixed(2)}st`)}`);
  }

  console.log('\n=== Switching modes leaves no stuck master bend ===');
  {
    const { mgr, raw } = rig();
    mgr.setMpeMode(false);
    mgr.setGlobalBendOffset(-4);        // a real offset sitting on channel 1
    raw.length = 0;

    mgr.setMpeMode(true);               // now go MPE
    const neutral = bends(raw).filter(m => ch(m) === 1);
    check('master channel is centred on the way in', neutral.length === 1 && Math.abs(st(neutral[0])) < 0.001,
      `${neutral.map(m => st(m))}`);

    // And the depth a voice sees is the offset once, not twice.
    mgr.setGlobalBendOffset(0);
    mgr.sendMpePitchBend(3, 0, 48, 0);
    raw.length = 0;
    mgr.setGlobalBendOffset(2);
    const after = bends(raw);
    check('one voice, one bend, single depth',
      after.length === 1 && ch(after[0]) === 3 && Math.abs(st(after[0]) - 2) < 0.05,
      `${after.map(m => `ch${ch(m)} ${st(m).toFixed(2)}st`)}`);
  }

  console.log('\n=== Old MPE channels stop receiving once MPE is off ===');
  {
    const { mgr, raw } = rig();
    mgr.setMpeMode(true);
    mgr.sendMpePitchBend(2, 0, 48, 0);
    mgr.sendMpePitchBend(3, 0, 48, 0);
    mgr.setMpeMode(false);
    raw.length = 0;
    mgr.setGlobalBendOffset(5);
    const b = bends(raw);
    check('only channel 1 now', b.length === 1 && ch(b[0]) === 1, `${b.map(m => ch(m))}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
