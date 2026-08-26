import React from 'react';

/**
 * Marks for the settings sections. They are built from the same few primitives
 * — a circle, a bar, a line — at one stroke weight, so the column reads as a
 * set rather than as seven unrelated pictures, and each one describes what its
 * section does to the note rather than illustrating the name.
 *
 * Drawn on a 16 unit grid and rendered at the cap height of the label beside
 * them; everything inherits currentColor so a section lights up with its text.
 */
const ICONS: Record<string, React.ReactNode> = {
  WALK: (
    <>
      <path d="M4 12.5h2.5" />
      <path d="M6 9.5h2.5" />
      <path d="M8 6.5h2.5" />
      <path d="M10 3.5h2.5" />
    </>
  ),
  // A globe: the mapping applies across the whole keyboard.
  'Global Mapping': (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12" />
      <path d="M8 2a8 8 0 0 1 0 12a8 8 0 0 1 0-12z" />
    </>
  ),

  // Stacked bands, the middle one picked out: a register chosen from a range.
  'Register Control': (
    <>
      <path d="M2 4h12" />
      <path d="M2 8h8" />
      <path d="M2 12h12" />
      <circle cx="12.5" cy="8" r="1.25" fill="currentColor" stroke="none" />
    </>
  ),

  // One pitch bending into another, held at each end.
  'MPE GLIDE': (
    <>
      <path d="M3 12.5c4 0 6-9 10-9" />
      <circle cx="3" cy="12.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="13" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),

  // A cycle riding on the note: the modulation shape.
  'VELOCITY MOD': (
    <>
      <path d="M1.5 8c1.6-4.5 3.2-4.5 4.8 0s3.2 4.5 4.8 0" />
      <path d="M11.1 8c.9 2.6 1.9 3.4 3.4 1.6" />
    </>
  ),

  // Strings taken in one pass. Three is as many as reads at this size — four
  // closed up into a hatch.
  'STRUM ENGINE': (
    <>
      <path d="M4 2.5v11" />
      <path d="M8 2.5v11" />
      <path d="M12 2.5v11" />
      <path d="M1.5 11L14.5 5" />
    </>
  ),

  // Harder strikes standing taller.
  'VELOCITY ENGINE': (
    <>
      <path d="M2.5 13.5v-2.5" />
      <path d="M6 13.5v-5.5" />
      <path d="M9.5 13.5v-8" />
      <path d="M13 13.5v-11" />
    </>
  ),

  // The swept plate, radiating out from the struck chord.
  'OMNICHORD MODE': (
    <>
      <circle cx="3.5" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <path d="M7 3.5a6 6 0 0 1 0 9" />
      <path d="M11 2a8.5 8.5 0 0 1 0 12" />
    </>
  ),
};

export const SectionIcon: React.FC<{ title: string }> = ({ title }) => {
  const glyph = ICONS[title];
  if (!glyph) return null;
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
};
