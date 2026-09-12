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

  console.log('\n=== A playing style adds what a keyboard player would ===');
  {
    const chordOf = (over: any, mods: (e: any) => void) => {
      // Room for anything a style might add: MAX NOTES is a hard cap and is
      // tested on its own below, so it must not be what limits the chord here.
      const e = new OrchidEngine({ ...defaultParams, strumEngine: 0, chordMaxNotes: 8, ...over });
      const ons: number[] = [];
      e.onOutputNote = (ev: any) => { if (ev.isOn && !ev.isPitchBend && !ev.isCC) ons.push(ev.pitch); };
      mods(e);
      e.handleMidi(60, 100, true);
      return [...new Set(ons)].sort((a, b) => a - b).map(p => p - 60);
    };
    // A played voicing doubles notes across octaves, so what the chord states is
    // compared rather than the exact list of intervals it came out as.
    const tones = (a: number[]) => [...new Set(a.map(i => ((i % 12) + 12) % 12))].sort((x, y) => x - y);
    const major = (playStyle: string) => tones(chordOf({ playStyle }, (e) => e.setModifiers(0, false, false, false, false)));
    const minor = (playStyle: string) => tones(chordOf({ playStyle }, (e) => e.setModifiers(1, false, false, false, false)));

    check('NORMAL plays the triad it was written as',
      JSON.stringify(major('normal')) === JSON.stringify([0, 4, 7]), JSON.stringify(major('normal')));
    check('POP adds the ninth', major('pop').includes(2), JSON.stringify(major('pop')));
    check('and POP never adds a seventh of either kind',
      !major('pop').includes(10) && !major('pop').includes(11), JSON.stringify(major('pop')));
    check('GOSPEL adds the ninth and the sixth',
      major('gospel').includes(2) && major('gospel').includes(9), JSON.stringify(major('gospel')));
    check('and GOSPEL still adds no seventh to a triad',
      !major('gospel').includes(11), JSON.stringify(major('gospel')));
    check('JAZZ adds the seventh itself', major('jazz').includes(11), JSON.stringify(major('jazz')));

    check('NORMAL minor is the triad',
      JSON.stringify(minor('normal')) === JSON.stringify([0, 3, 7]), JSON.stringify(minor('normal')));
    check('POP minor adds the ninth', minor('pop').includes(2), JSON.stringify(minor('pop')));
    check('JAZZ minor takes a flat seventh, not a major one',
      minor('jazz').includes(10) && !minor('jazz').includes(11), JSON.stringify(minor('jazz')));
    check('a style really is more notes',
      major('jazz').length > major('normal').length, `${major('normal').length} -> ${major('jazz').length}`);

    // MAX NOTES is the ceiling, and it wins: a style adds what there is room for
    // and the notes that were written are never dropped to make space for colour.
    const minorTriad = (e: any) => e.setModifiers(1, false, false, false, false);
    const capped = chordOf({ playStyle: 'jazz', chordMaxNotes: 3 }, minorTriad);
    const uncoloured = chordOf({ playStyle: 'normal', chordMaxNotes: 3 }, minorTriad);
    check('the cap wins over the style', capped.length === 3, JSON.stringify(capped));
    check('and with no room to add, a style sounds exactly as NORMAL does',
      JSON.stringify(capped) === JSON.stringify(uncoloured), `${JSON.stringify(capped)} vs ${JSON.stringify(uncoloured)}`);
    const roomy = tones(chordOf({ playStyle: 'jazz', chordMaxNotes: 8 }, minorTriad));
    check('raising the cap lets the style through', roomy.length > tones(capped).length,
      `${tones(capped).length} -> ${roomy.length}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
})();
