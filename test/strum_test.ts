/**
 * The strum speed is a maximum, not a metronome.
 *
 * One gap is drawn per strum and used for all of that strum's notes, so a strum
 * is even in itself and it is the next one that comes at its own speed.
 */
import { OrchidEngine, strumGap } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function main() {
  console.log('\n=== The draw ===');
  {
    const draws = Array.from({ length: 4000 }, () => strumGap(100, 0.8, Math.random()));
    check('no strum is ever slower than the setting', draws.every(g => g <= 100), `${Math.max(...draws)}`);
    check('and none is faster than the variation allows', draws.every(g => g >= 20 - 1e-9),
      `${Math.min(...draws)}`);
    const nearMax = draws.filter(g => g >= 100 - 100 / 6).length / draws.length;
    check('about four in ten come near the maximum', nearMax > 0.3 && nearMax < 0.5,
      `${(nearMax * 100).toFixed(0)}%`);
    const quick = draws.filter(g => g <= 50).length / draws.length;
    check('and a fair few are twice as quick or better', quick > 0.1, `${(quick * 100).toFixed(0)}%`);
  }
  {
    const even = Array.from({ length: 200 }, () => strumGap(80, 0, Math.random()));
    check('at no variation every strum is exactly the setting', even.every(g => g === 80));
    check('the ends of the draw are the ends of the range',
      strumGap(100, 1, 0) === 100 && strumGap(100, 1, 1) === 0,
      `${strumGap(100, 1, 0)} ${strumGap(100, 1, 1)}`);
    check('a maximum of nothing is still nothing', strumGap(0, 0.8, 0.5) === 0);
  }

  console.log('\n=== As the engine plays it ===');
  {
    const rig = (over: Record<string, unknown>) => {
      const engine = new OrchidEngine({
        ...defaultParams, mpeEnabled: false, autoBassRegister: 0, patternEnabled: false,
        strumEngine: 1, strumSpeedMs: 60, ...over,
      } as any);
      const at: number[] = [];
      let started = 0;
      engine.onOutputNote = (e: any) => {
        if (e.isCC || e.isExpression || e.isPitchBend) return;
        if (e.isOn && e.velocity > 0) at.push(Date.now() - started);
      };
      return {
        /** Strum a chord and hand back the gaps between its notes, in order. */
        strum: async () => {
          at.length = 0;
          started = Date.now();
          engine.handleMidi(60, 100, true, false, false, false, true, undefined, [0, 4, 7, 11]);
          await sleep(300);
          engine.handleMidi(60, 0, false, false, false, false, true, undefined, [0, 4, 7, 11]);
          return at.slice(1).map((t, i) => t - at[i]);
        },
      };
    };

    return (async () => {
      const varied = rig({ strumVariation: 80 });
      const runs: number[][] = [];
      for (let i = 0; i < 10; i++) runs.push(await varied.strum());
      check('every strum sounds all of its notes', runs.every(g => g.length === 3),
        JSON.stringify(runs.map(g => g.length)));
      check('no strum is slower than MAX SPEED', runs.every(g => g.every(x => x <= 60 + 12)),
        JSON.stringify(runs));
      // Within one strum the notes are evenly spaced: the speed changes between
      // strums, not inside them. Timers are not exact, hence the tolerance.
      check('each strum is even in itself',
        runs.every(g => Math.max(...g) - Math.min(...g) <= 14), JSON.stringify(runs));
      const firsts = runs.map(g => g[0]);
      check('and they are not all the same speed',
        Math.max(...firsts) - Math.min(...firsts) > 8, JSON.stringify(firsts));

      const even = rig({ strumVariation: 0 });
      const flat = [await even.strum(), await even.strum(), await even.strum()];
      check('at no variation the strum is the setting, as it always was',
        flat.every(g => g.every(x => Math.abs(x - 60) <= 12)), JSON.stringify(flat));

      const off = rig({ strumEngine: 0 });
      const together = await off.strum();
      check('with the strum off the chord still arrives at once',
        together.every(x => x <= 5), JSON.stringify(together));

      console.log(`\n${pass} passed, ${fail} failed\n`);
      process.exit(fail > 0 ? 1 : 0);
    })();
  }
}

main();
