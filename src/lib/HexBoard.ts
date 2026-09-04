/**
 * HEX — an isomorphic hexagonal keyboard, after the HexBoard controller
 * (git.sr.ht/~earboxer/HexBoard, by Jared and Zach DeCook and Nicholas Fox).
 *
 * The idea worth borrowing is how little it takes to describe one of these
 * keyboards. A layout is two numbers: how many semitones you move going one
 * hex east, and how many going one hex down-left. Every other key falls out of
 * those, which is what "isomorphic" means in practice — a chord shape is the
 * same shape wherever you play it, because the distances never change.
 *
 * Only the twelve-tone layouts are here. The firmware also offers 17, 19, 22,
 * 31, 53 and other equal divisions, and those are genuinely out of reach: a
 * 31-EDO note is not a MIDI note, and this board feeds the ordinary chord
 * engine as though it were another keyboard plugged in.
 *
 * Coordinates follow the firmware's doubled-width scheme: `col` advances by two
 * between neighbours in a row, and odd rows are offset by one, so a hex's six
 * neighbours are E (+2,0), W (-2,0) and the four diagonals (±1,±1). Those are
 * pointy-top hexagons — flat vertical sides east and west, vertices top and
 * bottom.
 */

export interface HexLayout {
  name: string;
  /** Semitones moving one hex east. */
  across: number;
  /** Semitones moving one hex down-left. */
  dnLeft: number;
}

/**
 * The twelve-tone layouts, with the firmware's own step values. Wicki-Hayden
 * first because it is the one most people mean by "hex keyboard": a whole tone
 * across, a fifth down-left, so a major chord is a compact triangle.
 */
export const HEX_LAYOUTS: HexLayout[] = [
  { name: 'WICKI-HAYDEN', across: 2, dnLeft: -7 },
  { name: 'HARMONIC TABLE', across: -7, dnLeft: 3 },
  { name: 'GERHARD', across: -1, dnLeft: -3 },
  { name: 'JANKO', across: 1, dnLeft: -2 },
  { name: 'BOSANQUET-WILSON', across: -1, dnLeft: -1 },
  { name: 'COMPRESSED JANKO', across: -1, dnLeft: -2 },
  { name: 'COMPR. BOSANQUET', across: 1, dnLeft: -3 },
  { name: 'ACCORDION C-SYS', across: 2, dnLeft: -3 },
  { name: 'ACCORDION B-SYS', across: 1, dnLeft: -3 },
  { name: 'CHROMATIC', across: 12, dnLeft: -1 },
  { name: 'FULL GAMUT', across: 1, dnLeft: -9 },
];

export interface HexOrientation {
  /** Sixths of a turn, 0-5. Six rotations return the layout to itself. */
  rotation: number;
  mirrorLR: boolean;
  mirrorUD: boolean;
}

/**
 * Turn and flip a layout. Reflections and rotations of an isomorphic layout are
 * still isomorphic — only the direction your hand travels changes — so the whole
 * operation is on the two step values rather than on the board.
 */
export function orientLayout(layout: HexLayout, o: HexOrientation): HexLayout {
  let across = layout.across;
  let dnLeft = layout.dnLeft;

  if (o.mirrorUD) dnLeft = -(across + dnLeft);
  if (o.mirrorLR) { dnLeft = across + dnLeft; across = -across; }

  const turns = ((o.rotation % 6) + 6) % 6;
  for (let i = 0; i < turns; i++) {
    const nextAcross = across + dnLeft;
    dnLeft = -across;
    across = nextAcross;
  }
  return { ...layout, across, dnLeft };
}

/**
 * Semitones from the centre hex.
 *
 * The halving is always exact: in doubled-width coordinates a hex's column and
 * row share a parity, so the two products are either both even or both odd, and
 * their sum is even either way.
 */
export function hexSteps(dCol: number, dRow: number, layout: HexLayout): number {
  return (dCol * layout.across + dRow * (layout.across + 2 * layout.dnLeft)) / 2;
}

export interface HexCell {
  /** Doubled-width coordinates, relative to the centre hex. */
  col: number;
  row: number;
  /** MIDI note, or -1 when the layout puts this hex outside 0-127. */
  pitch: number;
  /** Centre of the hexagon in pixels, relative to the board's top left. */
  x: number;
  y: number;
}

export interface HexBoardSpec {
  width: number;
  height: number;
  /** Circumradius of one hexagon, in pixels: the zoom control moves this. */
  radius: number;
  layout: HexLayout;
  orientation: HexOrientation;
  /** The MIDI note under the middle of the board. */
  centreNote: number;
}

export interface HexBoard {
  cells: HexCell[];
  /** Width of one hexagon, for drawing. */
  hexWidth: number;
  hexHeight: number;
}

/**
 * Fill a viewport with hexagons.
 *
 * The board is generated to fit rather than scrolled, so there is no panning to
 * fight with playing: zoom out to reach more of it, and move the centre note to
 * go somewhere else. A pointy-top hexagon of circumradius r is r*sqrt(3) wide
 * and 2r tall, rows sit 1.5r apart, and odd rows are offset by half a width —
 * which in doubled-width coordinates is just one column step.
 */
export function buildHexBoard(spec: HexBoardSpec): HexBoard {
  const r = Math.max(4, spec.radius);
  const hexWidth = Math.sqrt(3) * r;
  const hexHeight = 2 * r;
  const stepX = hexWidth / 2; // one doubled-width column
  const stepY = 1.5 * r;

  const layout = orientLayout(spec.layout, spec.orientation);
  const cells: HexCell[] = [];

  // Enough rows and columns to cover the viewport, plus a ring so the edges are
  // filled rather than showing a ragged margin.
  const rowReach = Math.ceil(spec.height / (2 * stepY)) + 1;
  const colReach = Math.ceil(spec.width / (2 * hexWidth)) + 1;
  const cx = spec.width / 2;
  const cy = spec.height / 2;

  for (let row = -rowReach; row <= rowReach; row++) {
    // Odd rows are offset half a hex, which the doubled coordinates express as
    // an odd column: every hex in the row keeps the row's parity.
    const parity = ((row % 2) + 2) % 2;
    for (let c = -colReach; c <= colReach; c++) {
      const col = 2 * c + parity;
      const x = cx + col * stepX;
      const y = cy + row * stepY;
      // Anything wholly off the edge is not worth drawing or touching.
      if (x < -hexWidth || x > spec.width + hexWidth) continue;
      if (y < -hexHeight || y > spec.height + hexHeight) continue;

      const steps = hexSteps(col, row, layout);
      const pitch = spec.centreNote + steps;
      cells.push({ col, row, pitch: pitch >= 0 && pitch <= 127 ? pitch : -1, x, y });
    }
  }
  return { cells, hexWidth, hexHeight };
}

/** The six corners of a pointy-top hexagon, as an SVG points string. */
export function hexPoints(cx: number, cy: number, radius: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    // Start at the top vertex and go round; pointy-top means a corner at 90°.
    const angle = (Math.PI / 180) * (60 * i - 90);
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function hexNoteName(pitch: number): string {
  if (pitch < 0 || pitch > 127) return '';
  return NOTE_NAMES[pitch % 12];
}

export function hexNoteFull(pitch: number): string {
  if (pitch < 0 || pitch > 127) return '';
  return `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}
