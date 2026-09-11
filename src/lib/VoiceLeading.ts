/**
 * VOICE LEADING — choosing where each chord sits from the chord before it.
 *
 * Every chord arrives here already voiced: the shape is whatever the voicing
 * disk picked, placed so its lowest note sits at the register. That placement is
 * why the memory pads wander — shapes span anything from eleven to thirty-four
 * semitones, so with the bottom pinned the top lands wherever the shape happens
 * to reach, and the line along the top of a progression jumps about by up to two
 * octaves.
 *
 * This keeps the shape and moves only its placement: the same notes turned over
 * or moved by an octave, whichever continues most smoothly from the previous
 * chord. The disk still decides what a chord sounds like; this decides where.
 *
 * Pure throughout, so a pad's voicing is a function of the pads and the settings
 * and nothing else — the same pad always sounds the same.
 */

export type LeadMode = 'topLine' | 'anchor' | 'allVoices' | 'commonTones';

export interface LeadWindow {
  /** Every note of a candidate must fit between these. */
  low: number;
  high: number;
  /** The register. Soft: a voicing may dip below it, at a cost, to keep a line. */
  floor: number;
}

export interface LeadOptions {
  mode: LeadMode;
  window: LeadWindow;
  /** Where the top note is held, in ANCHOR. Already shifted by any inversion. */
  anchor: number;
}

const sortAsc = (v: number[]) => [...v].sort((a, b) => a - b);
const pc = (p: number) => ((p % 12) + 12) % 12;
const top = (v: number[]) => Math.max(...v);
const bottom = (v: number[]) => Math.min(...v);

/**
 * Turn a voicing over, the bottom note up an octave (k > 0) or the top note down
 * one (k < 0), |k| times.
 *
 * The same rule as the engine's own inversion, collision handling included: a
 * played voicing states a tone in more than one octave, so lifting a note by one
 * can land exactly on another, and it has to carry on until it finds room or the
 * chord comes back a note short.
 */
export function invert(pitches: number[], k: number): number[] {
  const out = sortAsc(pitches);
  for (let i = 0; i < Math.abs(k); i++) {
    if (k > 0) {
      const from = out.shift()!;
      let lifted = from + 12;
      while (out.includes(lifted) && lifted + 12 <= 127) lifted += 12;
      if (lifted > 127 || out.includes(lifted)) { out.unshift(from); break; }
      out.push(lifted);
    } else {
      const from = out.pop()!;
      let dropped = from - 12;
      while (out.includes(dropped) && dropped - 12 >= 0) dropped -= 12;
      if (dropped < 0 || out.includes(dropped)) { out.push(from); break; }
      out.unshift(dropped);
    }
    out.sort((a, b) => a - b);
  }
  return out;
}

/**
 * Every placement of this shape that fits the window: each inversion either way,
 * each moved an octave up, down or not at all.
 *
 * Never an empty answer. A window too tight for any placement gets the voicing as
 * it arrived, so a chord is never silenced by the attempt to lead it.
 */
export function candidateVoicings(base: number[], window: LeadWindow): number[][] {
  if (base.length === 0) return [];
  const seen = new Set<string>();
  const out: number[][] = [];
  const n = base.length;
  for (let k = -n; k <= n; k++) {
    const turned = invert(base, k);
    for (const shift of [-12, 0, 12]) {
      const v = turned.map(p => p + shift);
      if (v.some(p => p < window.low || p > window.high)) continue;
      if (new Set(v).size !== v.length) continue;
      const key = v.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out.length > 0 ? out : [sortAsc(base)];
}

/**
 * How far one chord moves to become another.
 *
 * Each note's distance to the nearest note of the other chord, counted both
 * ways. That compares chords of different sizes fairly — a four-note chord
 * becoming a five-note one is not charged for the extra voice having nowhere to
 * come from, only for how far everything has to travel.
 */
export function movement(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const nearest = (p: number, set: number[]) => {
    let best = Infinity;
    for (const q of set) best = Math.min(best, Math.abs(p - q));
    return best;
  };
  let total = 0;
  for (const x of b) total += nearest(x, a);
  for (const y of a) total += nearest(y, b);
  return total;
}

/** Shared pitch classes the next chord keeps at exactly the same pitch. */
export function retainedCommonTones(prev: number[], next: number[]): { shared: number; kept: number } {
  const nextPcs = new Set(next.map(pc));
  const sharedPcs = [...new Set(prev.map(pc))].filter(c => nextPcs.has(c));
  const kept = sharedPcs.filter(c => prev.some(p => pc(p) === c && next.includes(p))).length;
  return { shared: sharedPcs.length, kept };
}

/**
 * What a candidate costs, in the mode's own terms. Lower is better.
 *
 * Each mode puts most of its weight on the one thing it is for, and keeps a
 * little on overall movement and on the middle of the window — enough to break
 * ties sensibly and to stop a long progression drifting to one edge, not enough
 * to outvote the mode's own goal.
 */
export function leadCost(prev: number[] | null, next: number[], opts: LeadOptions): number {
  const { floor, high } = opts.window;
  const centre = (floor + high) / 2;
  // Below the register is allowed, because pinning the bottom is what made the
  // top wander in the first place, but it is not free.
  const belowFloor = Math.max(0, floor - bottom(next)) * 2;
  const pull = Math.abs(top(next) - centre);

  switch (opts.mode) {
    case 'anchor':
      return Math.abs(top(next) - opts.anchor) * 10
        + (prev ? movement(prev, next) * 0.3 : 0)
        + belowFloor;
    case 'topLine':
      if (!prev) return pull * 0.3 + belowFloor;
      return Math.abs(top(next) - top(prev)) * 10
        + movement(prev, next) * 0.5
        + pull * 0.3
        + belowFloor;
    case 'allVoices':
      if (!prev) return pull * 0.3 + belowFloor;
      return movement(prev, next) * 5 + pull * 0.2 + belowFloor;
    case 'commonTones': {
      if (!prev) return pull * 0.3 + belowFloor;
      const { shared, kept } = retainedCommonTones(prev, next);
      return (shared - kept) * 40 + movement(prev, next) + pull * 0.2 + belowFloor;
    }
  }
}

/**
 * The best placement, with a tie-break that never depends on the order the
 * candidates arrived in — so recomputing a pad gives the same answer every time.
 */
export function pickLed(candidates: number[][], prev: number[] | null, opts: LeadOptions): number[] {
  if (candidates.length === 0) return [];
  const spread = (v: number[]) => top(v) - bottom(v);
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
  const scored = candidates.map(v => ({ v, cost: leadCost(prev, v, opts) }));
  scored.sort((a, b) =>
    (a.cost - b.cost)
    || (spread(a.v) - spread(b.v))
    || (top(a.v) - top(b.v))
    || (sum(a.v) - sum(b.v)));
  return scored[0].v;
}

/**
 * One step: where the next chord goes, given the last.
 *
 * With nothing to lead from, the chord is the seed and keeps the placement it
 * arrived with — which already carries the inversion, and is how turning
 * INVERSION re-seeds a line. ANCHOR has no need of a seed: it places every chord,
 * the first included, against the anchor.
 */
export function leadNext(base: number[], prev: number[] | null, opts: LeadOptions): number[] {
  if (base.length === 0) return [];
  if (prev === null && opts.mode !== 'anchor') return sortAsc(base);
  return pickLed(candidateVoicings(base, opts.window), prev, opts);
}

/** A whole row of pads in order, each led from the one before. Gaps are skipped. */
export function leadChain(bases: Array<number[] | null>, opts: LeadOptions): Array<number[] | null> {
  const out: Array<number[] | null> = bases.map(() => null);
  let prev: number[] | null = null;
  bases.forEach((base, i) => {
    if (!base || base.length === 0) return;
    out[i] = leadNext(base, prev, opts);
    prev = out[i];
  });
  return out;
}
