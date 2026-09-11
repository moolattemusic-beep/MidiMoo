import {
  LeadOptions, candidateVoicings, invert, leadChain, leadNext, movement, retainedCommonTones,
} from '../src/lib/VoiceLeading.ts';
import { chooseVoicing, voicingQualityOf } from '../src/lib/Voicings.ts';
import { parseChordSymbol } from '../src/lib/ChordSymbol.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

const REGISTER = 48;
const WINDOW = { low: REGISTER - 12, high: REGISTER + 36, floor: REGISTER };
const opts = (mode: LeadOptions['mode'], anchor = 67): LeadOptions => ({ mode, window: WINDOW, anchor });

const pcs = (v: number[]) => [...new Set(v.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b).join(',');
const top = (v: number[]) => Math.max(...v);
const topMoves = (chain: Array<number[] | null>) => {
  const tops = chain.filter((c): c is number[] => !!c).map(top);
  return tops.slice(1).map((t, i) => Math.abs(t - tops[i]));
};

/**
 * A chord voiced exactly the way the engine voices a pad today: a Ripchord shape
 * for its quality, placed so its lowest note sits in the register's octave. This
 * is the thing being fixed, reproduced rather than idealised.
 */
function voicedLikeTheEngine(symbol: string): number[] {
  const parsed = parseChordSymbol(symbol)!;
  const required = new Set(parsed.intervals.map(i => ((i % 12) + 12) % 12));
  const shape = chooseVoicing(voicingQualityOf(required), required, 5, 0.5, 0.5);
  const intervals = shape ? shape.intervals : parsed.intervals;
  const rootPC = parsed.root;
  let base = REGISTER - (((REGISTER - rootPC) % 12) + 12) % 12;
  while (base + intervals[0] < REGISTER) base += 12;
  while (base + intervals[0] >= REGISTER + 12) base -= 12;
  return intervals.map(i => base + i);
}

const PROGRESSIONS: Record<string, string[]> = {
  'ii-V-I-vi': ['Dm7', 'G7', 'Cmaj7', 'Am7'],
  'pop': ['C', 'Am', 'F', 'G'],
  'distant roots': ['Cmaj7', 'Ebmaj7', 'Abmaj7', 'Dbmaj7'],
  'eight bars': ['Am', 'F', 'C', 'G', 'Em', 'Dm', 'E7', 'Am'],
  'rndm style': ['Cmaj7', 'Am7', 'Fmaj7', 'Bm7b5', 'E7', 'Am7', 'Dm7', 'G7'],
};

function main() {
  console.log('=== Turning a voicing over ===');
  {
    check('up once moves the bottom note up an octave', invert([48, 52, 55], 1).join() === '52,55,60');
    check('down once moves the top note down an octave', invert([48, 52, 55], -1).join() === '43,48,52');
    check('no turn changes nothing', invert([55, 48, 52], 0).join() === '48,52,55');
    // A played voicing doubles tones, so a lifted note can land on another.
    const doubled = [48, 55, 60, 64];
    const up = invert(doubled, 1);
    check('a lifted note never lands on one already sounding', new Set(up).size === up.length, up.join());
    check('and the chord keeps every note', up.length === doubled.length, up.join());
  }

  console.log('\n=== Candidates are the same chord, only placed differently ===');
  {
    const base = voicedLikeTheEngine('Cmaj7');
    const cands = candidateVoicings(base, WINDOW);
    check('there is a choice to make', cands.length > 3, `${cands.length}`);
    check('every one fits the window',
      cands.every(v => v.every(p => p >= WINDOW.low && p <= WINDOW.high)));
    check('every one states exactly the chord it came from',
      cands.every(v => pcs(v) === pcs(base)), `${pcs(base)}`);
    check('none loses a note', cands.every(v => v.length === base.length));
    check('none doubles a pitch', cands.every(v => new Set(v).size === v.length));
  }
  {
    // A window no placement fits must still produce a chord, not silence.
    const tight = { low: 60, high: 62, floor: 60 };
    const cands = candidateVoicings([48, 52, 55, 59], tight);
    check('a window too tight gives the chord back rather than nothing',
      cands.length === 1 && cands[0].join() === '48,52,55,59', JSON.stringify(cands));
  }

  console.log('\n=== The problem, measured: tops as the pads voice them today ===');
  const unledWorst: Record<string, number> = {};
  for (const [name, prog] of Object.entries(PROGRESSIONS)) {
    const unled = prog.map(voicedLikeTheEngine);
    unledWorst[name] = Math.max(...topMoves(unled));
    console.log(`     ${name.padEnd(14)} unled worst top jump ${unledWorst[name]} semitones`);
  }

  console.log('\n=== TOP LINE keeps the melody on top stepwise ===');
  for (const [name, prog] of Object.entries(PROGRESSIONS)) {
    const chain = leadChain(prog.map(voicedLikeTheEngine), opts('topLine'));
    const moves = topMoves(chain);
    const worst = Math.max(...moves);
    check(`${name}: no top jump bigger than a fourth`, worst <= 5, `worst ${worst}, moves ${moves.join(',')}`);
    check(`${name}: and never worse than it was`, worst <= unledWorst[name],
      `led ${worst} vs unled ${unledWorst[name]}`);
  }

  console.log('\n=== ANCHOR holds every top note near the anchor ===');
  for (const [name, prog] of Object.entries(PROGRESSIONS)) {
    const chain = leadChain(prog.map(voicedLikeTheEngine), opts('anchor', 67));
    const far = chain.filter((c): c is number[] => !!c).map(c => Math.abs(top(c) - 67));
    check(`${name}: every top within a fourth of G4`, Math.max(...far) <= 5,
      `distances ${far.join(',')}`);
  }
  {
    // Moving the anchor moves the whole line with it.
    const prog = PROGRESSIONS['pop'].map(voicedLikeTheEngine);
    const low = leadChain(prog, opts('anchor', 64)).map(c => top(c!));
    const high = leadChain(prog, opts('anchor', 72)).map(c => top(c!));
    check('a higher anchor raises every top note', high.every((t, i) => t > low[i]),
      `${low.join(',')} -> ${high.join(',')}`);
  }

  console.log('\n=== ALL VOICES moves the whole chord less ===');
  for (const [name, prog] of Object.entries(PROGRESSIONS)) {
    const unled = prog.map(voicedLikeTheEngine);
    const led = leadChain(unled, opts('allVoices'));
    const total = (c: Array<number[] | null>) => {
      const v = c.filter((x): x is number[] => !!x);
      return v.slice(1).reduce((s, x, i) => s + movement(v[i], x), 0);
    };
    check(`${name}: less total movement than unled`, total(led) <= total(unled),
      `led ${total(led)} vs unled ${total(unled)}`);
  }

  console.log('\n=== COMMON TONES keeps shared notes where they were ===');
  {
    let shared = 0, kept = 0, unledKept = 0;
    for (const prog of Object.values(PROGRESSIONS)) {
      const unled = prog.map(voicedLikeTheEngine);
      const led = leadChain(unled, opts('commonTones')) as number[][];
      for (let i = 1; i < led.length; i++) {
        const r = retainedCommonTones(led[i - 1], led[i]);
        shared += r.shared; kept += r.kept;
        unledKept += retainedCommonTones(unled[i - 1], unled[i]).kept;
      }
    }
    check('it keeps far more shared tones than the pads do today', kept > unledKept,
      `kept ${kept} vs unled ${unledKept} of ${shared}`);
    check('and most of them', kept / shared >= 0.7, `${kept}/${shared}`);
  }

  console.log('\n=== A pad always sounds the same ===');
  {
    const prog = PROGRESSIONS['rndm style'].map(voicedLikeTheEngine);
    for (const mode of ['topLine', 'anchor', 'allVoices', 'commonTones'] as const) {
      const a = JSON.stringify(leadChain(prog, opts(mode)));
      const b = JSON.stringify(leadChain(prog.map(c => [...c]), opts(mode)));
      check(`${mode}: recomputing gives the same voicings`, a === b);
    }
    // Candidate order must not decide the answer either.
    const base = voicedLikeTheEngine('G7');
    const prev = voicedLikeTheEngine('Dm7');
    const forward = leadNext(base, prev, opts('topLine'));
    const reversed = leadNext([...base].reverse(), prev, opts('topLine'));
    check('the order notes arrive in does not change the answer', forward.join() === reversed.join());
  }

  console.log('\n=== Seeding, which is what INVERSION does ===');
  {
    const prog = PROGRESSIONS['ii-V-I-vi'].map(voicedLikeTheEngine);
    const chain = leadChain(prog, opts('topLine'));
    check('the first pad keeps the placement it arrived with',
      chain[0]!.join() === [...prog[0]].sort((a, b) => a - b).join());
    // Turning the seed over — what INVERSION does to it — carries the line with it.
    const turned = [invert(prog[0], 1), ...prog.slice(1)];
    const reseeded = leadChain(turned, opts('topLine'));
    check('an inverted seed moves the line that follows it',
      top(reseeded[1]!) !== top(chain[1]!) || top(reseeded[2]!) !== top(chain[2]!),
      `${chain.map(c => top(c!)).join(',')} vs ${reseeded.map(c => top(c!)).join(',')}`);
    check('and it still leads smoothly from there',
      Math.max(...topMoves(reseeded)) <= 5, `${topMoves(reseeded).join(',')}`);
  }

  console.log('\n=== Empty pads are stepped over ===');
  {
    const prog = PROGRESSIONS['pop'].map(voicedLikeTheEngine);
    const gappy = [prog[0], null, prog[1], null, null, prog[2]];
    const chain = leadChain(gappy, opts('topLine'));
    check('an empty pad stays empty', chain[1] === null && chain[3] === null && chain[4] === null);
    check('and the line carries across it', Math.abs(top(chain[2]!) - top(chain[0]!)) <= 5
      && Math.abs(top(chain[5]!) - top(chain[2]!)) <= 5,
      `${top(chain[0]!)} ${top(chain[2]!)} ${top(chain[5]!)}`);
    check('a row of nothing is a row of nothing', leadChain([null, null], opts('topLine')).every(c => c === null));
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
