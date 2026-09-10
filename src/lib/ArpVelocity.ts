/**
 * How far across the strum pad decides how hard a note is struck.
 *
 * One function rather than the expression written out at each call site,
 * because the strip's CC1 mirror has to be the same number the note is played
 * at — a mirror that drifts from what it reflects is worse than no mirror.
 */
export function arpVelocity(xVal: number, maxVelocity: number): number {
  const max = Math.max(1, Math.min(127, Math.round(maxVelocity)));
  return Math.max(1, Math.min(max, Math.round(xVal * max)));
}
