import { MidiDeviceManager } from '../src/lib/MidiDeviceManager.ts';
(globalThis as any).window = { performance: { now: () => Date.now() } };

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

function rig() {
  const mgr: any = new MidiDeviceManager();
  const raw: number[][] = [];
  mgr.midiAccess = {} as any;
  mgr.selectedOutputId = 'x';
  mgr.outputs = [{ id: 'x', connection: 'open', send: (d: number[]) => raw.push([...d]) } as any];
  return { mgr, raw };
}

function main() {
  console.log('=== Global bypass silences every send path ===');
  {
    const { mgr, raw } = rig();
    check('starts off', mgr.bypassed === false);

    mgr.bypassed = true;
    mgr.sendNote(60, 100, true);
    mgr.sendControlChange(74, 64);
    mgr.sendControlChangeAllChannels(1, 64);
    mgr.setMpeMode(true);
    mgr.sendMpeExpression(2, 64);
    mgr.sendMpePitchBend(2, 3, 48);
    mgr.setGlobalBendOffset(2);
    check('nothing reaches the wire while bypassed', raw.length === 0, `${raw.length} messages leaked`);
  }

  console.log('\n=== Unbypassing restores normal sending ===');
  {
    const { mgr, raw } = rig();
    mgr.bypassed = true;
    mgr.sendNote(60, 100, true);
    check('blocked while on', raw.length === 0);

    mgr.bypassed = false;
    mgr.sendNote(60, 100, true);
    check('note reaches the wire once off', raw.some(m => (m[0] & 0xF0) === 0x90 && m[1] === 60));
  }

  console.log('\n=== panic() sent before the gate closes still reaches the wire ===');
  {
    const { mgr, raw } = rig();
    mgr.sendNote(60, 100, true);
    raw.length = 0;

    // Matches the app's engage sequence: panic first, then close the gate —
    // a note already sounding downstream must still get its note-off, since
    // nothing sent after this point will.
    mgr.panic();
    const noteOffs = raw.filter(m => (m[0] & 0xF0) === 0x80);
    check('panic reached the wire', noteOffs.length > 0);

    mgr.bypassed = true;
    raw.length = 0;
    mgr.panic();
    check('panic itself is silenced once bypassed', raw.length === 0);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
