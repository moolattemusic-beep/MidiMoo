import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ', n); } else { fail++; console.log('  FAIL ', n, d); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// One event per voice, all at the top of the cycle.
const ladderPattern = (voices: number[]) => JSON.stringify({
  name: 'T', lengthBeats: 4,
  events: voices.map((v, i) => ({ voice: v, start: i * 6, length: 48, velocity: 100 })),
});

const play = async (over: any, voices: number[], chord: number[]) => {
  const e = new OrchidEngine({ ...defaultParams, patternEnabled: true, patternBpm: 120, patternCustom: ladderPattern(voices), ...over });
  const ons: number[] = [];
  e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
  e.handleMidi(60, 100, true, false, false, false, true, chord);
  await sleep(420);
  e.panic();
  await sleep(60);
  return ons;
};

(async () => {
  const TRIAD = [60, 64, 67];

  console.log('\n=== Spread 1 keeps the existing behaviour ===');
  {
    const ons = await play({ patternSpread: 1 }, [1, 2, 3, 4, 5], TRIAD);
    check('voices wrap in place', JSON.stringify(ons) === JSON.stringify([60, 64, 67, 60, 64]), JSON.stringify(ons));
    check('never reaches past the chord', ons.every(p => TRIAD.includes(p)), JSON.stringify(ons));
  }

  console.log('\n=== Spread climbs the chord instead ===');
  {
    const two = await play({ patternSpread: 2 }, [1, 2, 3, 4, 5, 6, 7], TRIAD);
    check('spread 2 gives two octaves', JSON.stringify(two) === JSON.stringify([60, 64, 67, 72, 76, 79, 60]), JSON.stringify(two));
    const three = await play({ patternSpread: 3 }, [1, 2, 3, 4, 5, 6, 7, 8], TRIAD);
    check('spread 3 reaches a third octave', three.includes(84) && three.includes(88), JSON.stringify(three));
    check('three pitch classes throughout', new Set(three.map(p => p % 12)).size === 3, JSON.stringify([...new Set(three.map(p => p % 12))]));
  }

  console.log('\n=== Eight voices have somewhere to play ===');
  {
    const ons = await play({ patternSpread: 3 }, [1, 2, 3, 4, 5, 6, 7, 8], TRIAD);
    check('eight distinct notes from a triad', new Set(ons).size === 8, `${new Set(ons).size}`);
    check('and they ascend', ons.slice(0, 8).every((p, i, a) => i === 0 || p > a[i - 1]), JSON.stringify(ons));
  }

  console.log('\n=== Spread and inversion combine ===');
  {
    const ons = await play({ patternSpread: 2, patternInversion: 1 }, [1, 2, 3], TRIAD);
    check('inversion still rotates the tones', JSON.stringify(ons) === JSON.stringify([64, 67, 72]), JSON.stringify(ons));
  }

  console.log('\n=== Colour adds the tensions each quality wants ===');
  {
    const chordOf = (over: any, mods: (e: any) => void) => {
      // Room for every colour tone: MAX NOTES is a hard cap and is tested on its
      // own below, so it must not be what limits the chord here.
      const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, chordMaxNotes: 8, ...over });
      const ons: number[] = [];
      e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
      mods(e);
      e.handleMidi(60, 100, true);
      return [...new Set(ons)].sort((a, b) => a - b).map(p => p - 60);
    };
    const major = (c: number) => chordOf({ chordColor: c }, (e) => e.setModifiers(0, false, false, false, false));
    const minor = (c: number) => chordOf({ chordColor: c }, (e) => e.setModifiers(1, false, false, false, false));

    // A played voicing doubles notes across octaves, so the chord is compared
    // rather than the exact list of intervals it came out as.
    const chordOnly = (a: number[]) => [...new Set(a.map(i => ((i % 12) + 12) % 12))].sort((x, y) => x - y);
    check('dry major is a triad', JSON.stringify(chordOnly(major(0))) === JSON.stringify([0, 4, 7]), JSON.stringify(major(0)));
    check('major +1 adds a major 7th', major(1).includes(11), JSON.stringify(major(1)));
    check('major +2 adds the 9th', major(2).some(i => i % 12 === 2), JSON.stringify(major(2)));
    check('major +3 adds the 13th', major(3).some(i => i % 12 === 9), JSON.stringify(major(3)));
    check('major +4 adds a RAISED 11th, not a natural one', major(4).some(i => i % 12 === 6) && !major(4).some(i => i % 12 === 5), JSON.stringify(major(4)));

    check('dry minor is a triad', JSON.stringify(chordOnly(minor(0))) === JSON.stringify([0, 3, 7]), JSON.stringify(minor(0)));
    check('minor +1 adds a flat 7th', minor(1).includes(10), JSON.stringify(minor(1)));
    check('minor +2 adds the 9th', minor(2).some(i => i % 12 === 2), JSON.stringify(minor(2)));
    check('minor +3 adds a NATURAL 11th', minor(3).some(i => i % 12 === 5), JSON.stringify(minor(3)));
    check('minor +4 adds the 13th', minor(4).some(i => i % 12 === 9), JSON.stringify(minor(4)));

    check('colour survives the density thinning', major(4).length >= 6, `${major(4).length} notes`);
    check('richer really is more notes', major(4).length > major(0).length, `${major(0).length} -> ${major(4).length}`);

    // MAX NOTES is a cap, and it wins: colour asks for tones, the cap decides
    // how many of them are actually voiced.
    const capped = chordOf({ chordColor: 4, chordMaxNotes: 4 }, (e) => e.setModifiers(1, false, false, false, false));
    check('the cap wins over colour', capped.length === 4, `${capped.length} notes`);
    const roomy = chordOf({ chordColor: 4, chordMaxNotes: 8 }, (e) => e.setModifiers(1, false, false, false, false));
    check('raising the cap lets the colour through', roomy.length > capped.length, `${capped.length} -> ${roomy.length}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
