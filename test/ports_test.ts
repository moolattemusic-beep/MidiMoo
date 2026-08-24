import { MidiDeviceManager } from '../src/lib/MidiDeviceManager.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };

// A stand-in for the Web MIDI API, so the selection logic can be exercised
// without hardware.
class FakePort {
  onmidimessage: any = null;
  sent: number[][] = [];
  state = 'connected';
  connection = 'closed';
  constructor(public id: string, public name: string) {}
  async open() { this.connection = 'open'; return this; }
  send(data: number[]) { this.sent.push([...data]); }
}

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};
(globalThis as any).window = { performance: { now: () => 0 } };

const makeAccess = (ins: FakePort[], outs: FakePort[]) => ({
  inputs: new Map(ins.map(p => [p.id, p])),
  outputs: new Map(outs.map(p => [p.id, p])),
  onstatechange: null as any,
});

const clearStore = () => { for (const k of Object.keys(store)) delete store[k]; };

const setup = async (ins: string[][], outs: string[][]) => {
  const inPorts = ins.map(([id, name]) => new FakePort(id, name));
  const outPorts = outs.map(([id, name]) => new FakePort(id, name));
  // navigator is a getter-only global in Node, so it is redefined rather than
  // assigned.
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { requestMIDIAccess: async () => makeAccess(inPorts, outPorts) },
  });
  const m = new MidiDeviceManager();
  await m.refreshDevices();
  return { m, inPorts, outPorts };
};

const RIG_IN: string[][] = [
  ['i1', 'IAC Driver Bus 1'],
  ['i2', 'A Series Midi Keyboard Port 1'],
  ['i3', 'TouchOSC Bridge'],
  ['i4', 'Scarlett 4i4 USB'],
];
const RIG_OUT: string[][] = [
  ['o1', 'IAC Driver Bus 1'],
  ['o2', 'Logic Pro Virtual In'],
  ['o3', 'Scarlett 4i4 USB'],
];

(async () => {
  console.log('\n=== The usual rig is chosen by default ===');
  {
    clearStore();
    const { m, inPorts } = await setup(RIG_IN, RIG_OUT);
    check('both controllers are live', m.selectedInputIds.has('i2') && m.selectedInputIds.has('i3'),
      JSON.stringify([...m.selectedInputIds]));
    check('and nothing else is', m.selectedInputIds.size === 2, JSON.stringify([...m.selectedInputIds]));
    check('Logic is the output', m.selectedOutputIds.has('o2') && m.selectedOutputIds.size === 1,
      JSON.stringify([...m.selectedOutputIds]));
    check('both inputs are actually listening',
      !!inPorts[1].onmidimessage && !!inPorts[2].onmidimessage);
    check('the others are not', !inPorts[0].onmidimessage && !inPorts[3].onmidimessage);
  }

  console.log('\n=== An unticked input stops playing at once ===');
  {
    clearStore();
    const { m, inPorts } = await setup(RIG_IN, RIG_OUT);
    m.setInputEnabled('i2', false);
    check('its listener is detached', !inPorts[1].onmidimessage);
    check('the other one carries on', !!inPorts[2].onmidimessage);
    m.setInputEnabled('i1', true);
    check('a newly ticked input starts listening', !!inPorts[0].onmidimessage);
  }

  console.log('\n=== An unticked output is silenced on the way out ===');
  {
    clearStore();
    const { m, outPorts } = await setup(RIG_IN, RIG_OUT);
    outPorts[1].sent.length = 0;
    m.setOutputEnabled('o2', false);
    const allNotesOff = outPorts[1].sent.filter(msg => msg[1] === 123).length;
    const pedalUp = outPorts[1].sent.filter(msg => msg[1] === 64 && msg[2] === 0).length;
    check('all notes off on every channel', allNotesOff === 16, `${allNotesOff}`);
    check('and the pedal is released', pedalUp === 16, `${pedalUp}`);
    check('it is no longer selected', !m.selectedOutputIds.has('o2'));
  }

  console.log('\n=== Several outputs are fed at once ===');
  {
    clearStore();
    const { m, outPorts } = await setup(RIG_IN, RIG_OUT);
    m.setOutputEnabled('o3', true);
    outPorts[1].sent.length = 0; outPorts[2].sent.length = 0;
    m.sendNote(60, 100, true, 0, 1);
    check('the first output got the note', outPorts[1].sent.length > 0, `${outPorts[1].sent.length}`);
    check('and so did the second', outPorts[2].sent.length > 0, `${outPorts[2].sent.length}`);
    check('with the same bytes', JSON.stringify(outPorts[1].sent) === JSON.stringify(outPorts[2].sent));
  }

  console.log('\n=== The choice survives a reload ===');
  {
    clearStore();
    const first = await setup(RIG_IN, RIG_OUT);
    first.m.setInputEnabled('i3', false);
    first.m.setOutputEnabled('o3', true);
    const wantedIn = [...first.m.selectedInputIds];
    // A fresh manager, and ids shuffled the way a driver would on a new session.
    const shuffled: string[][] = [
      ['x9', 'Scarlett 4i4 USB'],
      ['x7', 'A Series Midi Keyboard Port 1'],
      ['x8', 'TouchOSC Bridge'],
    ];
    const shuffledOut: string[][] = [['y5', 'Scarlett 4i4 USB'], ['y6', 'Logic Pro Virtual In']];
    const second = await setup(shuffled, shuffledOut);
    check('the keyboard is found again under a new id', second.m.selectedInputIds.has('x7'),
      JSON.stringify([...second.m.selectedInputIds]));
    check('the input that was switched off stays off', !second.m.selectedInputIds.has('x8'),
      JSON.stringify([...second.m.selectedInputIds]));
    check('both chosen outputs come back',
      second.m.selectedOutputIds.has('y5') && second.m.selectedOutputIds.has('y6'),
      JSON.stringify([...second.m.selectedOutputIds]));
    check('the first session kept the keyboard', wantedIn.includes('i2'), JSON.stringify(wantedIn));
  }

  console.log('\n=== An unfamiliar rig still makes a sound ===');
  {
    clearStore();
    const { m } = await setup([['a', 'Some Other Keyboard']], [['b', 'Some Other Synth']]);
    check('it falls back to the first ports', m.selectedInputIds.has('a') && m.selectedOutputIds.has('b'));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
