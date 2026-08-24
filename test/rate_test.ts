import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const ONE = JSON.stringify({ name: 'T', lengthBeats: 4, events: [{ voice: 1, start: 0, length: 24, velocity: 100 }] });
const CHORD = [60, 64, 67];

const countHits = async (over: any, ms: number) => {
  const e = new OrchidEngine({ ...defaultParams, patternEnabled: true, patternBpm: 240, patternCustom: ONE, ...over });
  let hits = 0;
  e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) hits++; };
  e.handleMidi(60, 100, true, false, false, false, true, CHORD);
  await sleep(ms);
  e.panic();
  await sleep(60);
  return hits;
};

(async () => {
  console.log('\n=== Half and double time ===');
  {
    // One beat is 250ms at 240bpm, so a 4-beat cycle is 1s.
    const normal = await countHits({ patternRate: 1 }, 2100);
    const double = await countHits({ patternRate: 2 }, 2100);
    const half = await countHits({ patternRate: 0.5 }, 2100);
    check('double time plays about twice as often', double >= normal * 1.6, `${normal} -> ${double}`);
    check('half time plays about half as often', half < normal, `${normal} -> ${half}`);
    check('and they are ordered', half < normal && normal < double, `${half} < ${normal} < ${double}`);
  }

  console.log('\n=== Chord layer ===');
  {
    const withLayer = async (on: boolean) => {
      const e = new OrchidEngine({ ...defaultParams, patternEnabled: true, patternBpm: 240, patternCustom: ONE, patternChordLayer: on });
      const ons: number[] = [];
      e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
      e.handleMidi(60, 100, true, false, false, false, true, CHORD);
      await sleep(1100);
      const before = [...ons];
      e.handleMidi(60, 0, false, false, false, false, true, []);
      await sleep(200);
      const offs: number[] = [];
      e.onOutputNote = (ev: any) => { if (!ev.isOn && !ev.isPitchBend && !ev.isCC) offs.push(ev.pitch); };
      e.panic();
      await sleep(80);
      return { ons: before, stray: offs.length };
    };
    const off = await withLayer(false);
    const on = await withLayer(true);
    check('without it only the pattern voice sounds', new Set(off.ons).size === 1, JSON.stringify([...new Set(off.ons)]));
    check('with it the whole chord sounds too', new Set(on.ons).size === 3, JSON.stringify([...new Set(on.ons)]));
    check('the chord is the voicing', [60, 64, 67].every(p => on.ons.includes(p)), JSON.stringify([...new Set(on.ons)]));
    check('nothing is left ringing after release', on.stray === 0, `${on.stray}`);
  }

  console.log('\n=== Colour on dominant chords ===');
  {
    const chordOf = (over: any, mods: (e: any) => void) => {
      const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, chordMaxNotes: 8, ...over });
      const ons: number[] = [];
      e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
      mods(e);
      e.handleMidi(60, 100, true);
      return [...new Set(ons)].sort((a, b) => a - b).map(p => ((p - 60) % 12 + 12) % 12);
    };
    // A major third with a flat seventh, played by hand: a dominant however it arrived.
    const dom = (c: number) => chordOf({ chordColor: c }, (e) => e.setModifiers(0, true, false, false, false));

    check('the chord really is a dominant', dom(0).includes(4) && dom(0).includes(10), JSON.stringify(dom(0)));
    check('colour never adds a major 7th to it', [1, 2, 3, 4].every(c => !dom(c).includes(11)),
      [1, 2, 3, 4].map(c => JSON.stringify(dom(c))).join(' '));
    check('+1 adds a b9', dom(1).includes(1), JSON.stringify(dom(1)));
    check('+2 adds a #9', dom(2).includes(3), JSON.stringify(dom(2)));
    check('+3 adds a b13', dom(3).includes(8), JSON.stringify(dom(3)));
    check('+4 adds a #11', dom(4).includes(6), JSON.stringify(dom(4)));

    // The same chord arriving from the key rather than the pads.
    const keyDom = (c: number) => chordOf(
      { chordColor: c, keyboardMapping: 2, keyRoot: 5, keyScale: 0, alwaysAdd7th: true },
      () => {}
    );
    check('a key-mode dominant is treated the same', !keyDom(1).includes(11) || !keyDom(1).includes(10),
      JSON.stringify(keyDom(1)));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
