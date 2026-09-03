import { MidiDeviceManager } from '../src/lib/MidiDeviceManager.ts';
(globalThis as any).window = { performance: { now: () => Date.now() } };
(globalThis as any).localStorage = {
  _s: {} as Record<string, string>,
  getItem(k: string) { return this._s[k] ?? null; },
  setItem(k: string, v: string) { this._s[k] = v; },
};

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

/** Two ports: one the DAW listens on, one with the synth hanging off it. */
function rig() {
  const mgr: any = new MidiDeviceManager();
  const daw: number[][] = [];
  const synth: number[][] = [];
  mgr.midiAccess = {} as any;
  mgr.outputs = [
    { id: 'daw', name: 'Logic Pro Virtual In', connection: 'open', send: (d: number[]) => daw.push([...d]) },
    { id: 'sc', name: 'Scarlett 4i4 USB', connection: 'open', send: (d: number[]) => synth.push([...d]) },
    { id: 'op', name: 'OP-1 Midi Device', connection: 'open', send: (d: number[]) => synth.push([...d]) },
  ] as any;
  mgr.selectedOutputId = 'daw';
  return { mgr, daw, synth };
}

const notes = (raw: number[][]) => raw.filter(m => (m[0] & 0xF0) === 0x90 || (m[0] & 0xF0) === 0x80);
const chan = (m: number[]) => (m[0] & 0x0F) + 1;

function main() {
  console.log('=== The synth port is separate from the main bus ===');
  {
    const { mgr, daw, synth } = rig();
    mgr.setExtSynthOutput('sc');

    mgr.sendNote(60, 100, true);
    check('a main-bus note goes to the DAW only',
      notes(daw).length === 1 && notes(synth).length === 0, `daw ${notes(daw).length} synth ${notes(synth).length}`);

    daw.length = 0; synth.length = 0;
    mgr.sendExtSynthNote(60, 100, true);
    check('an external-synth note goes to the synth only',
      notes(synth).length === 1 && notes(daw).length === 0, `daw ${notes(daw).length} synth ${notes(synth).length}`);
  }

  console.log('\n=== Preset port matching ===');
  {
    const { mgr } = rig();
    check('the Model D preset finds the Scarlett', mgr.findOutputByName('scarlett') === 'sc');
    check('the OP-1 preset finds the OP-1', mgr.findOutputByName('op-1') === 'op');
    check('matching ignores case', mgr.findOutputByName('SCARLETT') === 'sc');
    check('an absent device is reported rather than guessed',
      mgr.findOutputByName('prophet') === null);
  }

  console.log('\n=== Channel ===');
  {
    const { mgr, synth } = rig();
    mgr.setExtSynthOutput('op');
    mgr.extSynthChannel = 5;
    mgr.sendExtSynthNote(60, 100, true);
    check('notes leave on the chosen channel', chan(notes(synth)[0]) === 5, `${chan(notes(synth)[0])}`);
  }

  console.log('\n=== Switching port releases the one being left ===');
  {
    const { mgr, synth } = rig();
    mgr.setExtSynthOutput('sc');
    mgr.sendExtSynthNote(60, 100, true);
    synth.length = 0;
    mgr.setExtSynthOutput('op');
    check('all-notes-off went out before the change',
      synth.some(m => (m[0] & 0xF0) === 0xB0 && m[1] === 123), `${JSON.stringify(synth.slice(0, 3))}`);
  }

  console.log('\n=== BYPASS covers the synth port too ===');
  {
    const { mgr, synth } = rig();
    mgr.setExtSynthOutput('sc');
    mgr.bypassed = true;
    mgr.sendExtSynthNote(60, 100, true);
    mgr.sendExtSynth([0xB0, 1, 64]);
    mgr.panicExtSynth();
    check('nothing reaches the synth while bypassed', synth.length === 0, `${synth.length} leaked`);

    mgr.bypassed = false;
    mgr.sendExtSynthNote(60, 100, true);
    check('and it comes back once lifted', notes(synth).length === 1);
  }

  console.log('\n=== No port chosen ===');
  {
    const { mgr, daw } = rig();
    mgr.setExtSynthOutput(null);
    mgr.sendExtSynthNote(60, 100, true);
    check('nothing is sent, and nothing leaks onto the main bus', notes(daw).length === 0);
  }

  console.log('\n=== The port is remembered by name ===');
  {
    const { mgr } = rig();
    mgr.setExtSynthOutput('sc');
    const saved = JSON.parse((globalThis as any).localStorage.getItem('orchid-midi-ports'));
    check('saved by name, not by the id the driver handed out',
      saved.extSynth === 'Scarlett 4i4 USB', `${JSON.stringify(saved)}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
