/**
 * Which settings section is open, remembered between sessions.
 *
 * The top-level list drills in: opening a section hands it the whole column and
 * hides its siblings. That makes the remembered title load-bearing — if it names
 * a section that no longer exists, nothing matches it, every sibling hides
 * itself, and the column comes up empty with no header left to click. Renaming
 * a section is enough to do it, which is exactly how it happened.
 *
 * So the stored state is checked against the sections that actually exist
 * before it is trusted.
 */

export type OpenSections = Record<string, string | null>;

/**
 * Drop a remembered section that nothing answers to any more.
 *
 * Only the root group drills in, so only it can strand the column; the nested
 * groups behave as ordinary accordions where an unmatched title merely means
 * nothing is open. `knownRootTitles` must be the sections that mounted — an
 * empty set means nothing has reported yet, and pruning then would throw away
 * a perfectly good choice.
 */
export function pruneOpenSections(stored: OpenSections, knownRootTitles: Set<string>): OpenSections {
  const open = stored.root;
  if (!open) return stored;
  if (knownRootTitles.size === 0) return stored;
  if (knownRootTitles.has(open)) return stored;
  return { ...stored, root: null };
}
