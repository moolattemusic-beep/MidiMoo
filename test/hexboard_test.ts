import {
  HEX_LAYOUTS, buildHexBoard, continuousPitch, hexSteps, orientLayout, hexNoteFull, hexPoints,
} from '../src/lib/HexBoard.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { console.log(`  PASS  ${n}`); pass++; } else { console.log(`  FAIL  ${n} ${d}`); fail++; } };

const byName = (n: string) => HEX_LAYOUTS.find(l => l.name === n)!;
const flat = { rotation: 0, mirrorLR: false, mirrorUD: false };

function main() {
  console.log('=== The six neighbours move by the layout\'s own steps ===');
  {
    // This is what isomorphic means: the interval between two hexes depends
    // only on how far apart they are, never on where they are.
    for (const layout of HEX_LAYOUTS) {
      const east = hexSteps(2, 0, layout);
      const dnLeft = hexSteps(-1, 1, layout);
      const dnRight = hexSteps(1, 1, layout);
      check(`${layout.name}: east is ${layout.across}`, east === layout.across, `${east}`);
      check(`${layout.name}: down-left is ${layout.dnLeft}`, dnLeft === layout.dnLeft, `${dnLeft}`);
      check(`${layout.name}: down-right is the sum`,
        dnRight === layout.across + layout.dnLeft, `${dnRight}`);
    }
  }

  console.log('\n=== Wicki-Hayden is where the shapes come from ===');
  {
    const w = byName('WICKI-HAYDEN');
    check('a whole tone across', hexSteps(2, 0, w) === 2);
    check('two across is a major third', hexSteps(4, 0, w) === 4);
    check('a fifth down-left', hexSteps(-1, 1, w) === -7);
    // Up-right is the inverse of down-left, so the fifth above sits there.
    check('a fifth up-right', hexSteps(1, -1, w) === 7);
    // The reason people like it: the major triad is three adjacent hexes.
    const root = hexSteps(0, 0, w);
    const third = hexSteps(4, 0, w);
    const fifth = hexSteps(1, -1, w);
    check('root, third and fifth are one compact shape',
      third - root === 4 && fifth - root === 7, `${third - root}, ${fifth - root}`);
  }

  console.log('\n=== The Lumatone own orientation ===');
  {
    // Measured from the Lumatone's factory layout files, where every key of the
    // Harmonic Table agrees on a major third across and a minor third down to
    // the right, and the Wicki-Hayden on a whole tone across. Getting the
    // orientation wrong still gives an isomorphic layout with all the right
    // notes and none of the right shapes, which is the whole point of matching.
    const h = byName('HARMONIC TABLE');
    check('Lumatone Harmonic Table: a major third across',
      hexSteps(2, 0, h) === 4, `${hexSteps(2, 0, h)}`);
    check('and a minor third down-right',
      hexSteps(1, 1, h) === -3, `${hexSteps(1, 1, h)}`);
    check('so a fifth down-left', hexSteps(-1, 1, h) === -7, `${hexSteps(-1, 1, h)}`);
    // Its defining property survives the orientation: root, third and fifth
    // meet at one point, so major is a triangle and minor is it inverted.
    check('major triad is one triangle: root, +4 across, +7 up-right',
      hexSteps(2, 0, h) === 4 && hexSteps(1, -1, h) === 7);
    check('minor triad is the same triangle inverted: root, +3, +7',
      hexSteps(-1, -1, h) === 3 && hexSteps(1, -1, h) === 7,
      `${hexSteps(-1, -1, h)}, ${hexSteps(1, -1, h)}`);

    const w = byName('WICKI-HAYDEN');
    check('Lumatone Wicki-Hayden: a whole tone across', hexSteps(2, 0, w) === 2);
    check('and a fifth down-left', hexSteps(-1, 1, w) === -7);
  }

  console.log('\n=== Every hex is reachable in one interval, everywhere ===');
  {
    // Isomorphism as a property rather than a claim: the same offset gives the
    // same interval no matter which hex you start from.
    const w = byName('WICKI-HAYDEN');
    let same = true;
    for (const [dc, dr] of [[2, 0], [-1, 1], [1, 1], [4, -2], [-3, 3]] as const) {
      const reference = hexSteps(dc, dr, w);
      for (let row = -4; row <= 4; row++) {
        const parity = ((row % 2) + 2) % 2;
        for (let c = -4; c <= 4; c++) {
          const col = 2 * c + parity;
          const here = hexSteps(col, row, w);
          const there = hexSteps(col + dc, row + dr, w);
          if (there - here !== reference) same = false;
        }
      }
    }
    check('an offset always means the same interval', same);
  }

  console.log('\n=== Turning and flipping ===');
  {
    const w = byName('WICKI-HAYDEN');
    check('no turn changes nothing', orientLayout(w, flat).across === w.across
      && orientLayout(w, flat).dnLeft === w.dnLeft);

    const six = orientLayout(w, { ...flat, rotation: 6 });
    check('six sixths of a turn is where it started',
      six.across === w.across && six.dnLeft === w.dnLeft, `${six.across},${six.dnLeft}`);

    const one = orientLayout(w, { ...flat, rotation: 1 });
    check('one turn is across+dnLeft, -across',
      one.across === w.across + w.dnLeft && one.dnLeft === -w.across, `${one.across},${one.dnLeft}`);

    const three = orientLayout(w, { ...flat, rotation: 3 });
    check('half a turn inverts both, which is the board upside down',
      three.across === -w.across && three.dnLeft === -w.dnLeft, `${three.across},${three.dnLeft}`);

    const lr = orientLayout(w, { ...flat, mirrorLR: true });
    check('a left-right flip reverses the direction across', lr.across === -w.across);
    // Mirroring must not stop it being isomorphic, only change which way a
    // shape leans, so the six neighbours still have to agree with the table.
    check('and the flipped layout is still consistent',
      hexSteps(2, 0, lr) === lr.across && hexSteps(-1, 1, lr) === lr.dnLeft);
  }

  console.log('\n=== Filling a screen ===');
  {
    const board = buildHexBoard({
      width: 800, height: 500, radius: 34,
      layout: byName('WICKI-HAYDEN'), orientation: flat, centreNote: 60,
    });
    check('the board has hexes', board.cells.length > 40, `${board.cells.length}`);
    check('a pointy-top hex is wider than half its height',
      Math.abs(board.hexWidth - Math.sqrt(3) * 34) < 0.01 && board.hexHeight === 68);

    const centre = board.cells.find(c => c.col === 0 && c.row === 0)!;
    check('the centre hex is the centre note', centre.pitch === 60);
    check('and sits in the middle of the viewport',
      Math.abs(centre.x - 400) < 0.01 && Math.abs(centre.y - 250) < 0.01);

    check('every hex keeps its row\'s parity',
      board.cells.every(c => (((c.col % 2) + 2) % 2) === (((c.row % 2) + 2) % 2)));
    check('no two hexes share a position',
      new Set(board.cells.map(c => `${c.col}:${c.row}`)).size === board.cells.length);
  }
  {
    // Zooming out must show more of the board, which is the whole point of
    // having a zoom on a screen you cannot change the size of.
    const wide = buildHexBoard({ width: 800, height: 500, radius: 18, layout: byName('JANKO'), orientation: flat, centreNote: 60 });
    const close = buildHexBoard({ width: 800, height: 500, radius: 60, layout: byName('JANKO'), orientation: flat, centreNote: 60 });
    check('zoomed out reaches more notes', wide.cells.length > close.cells.length,
      `${wide.cells.length} vs ${close.cells.length}`);
  }
  {
    // A layout with a big step runs off the end of MIDI quickly, and a hex with
    // no note must be inert rather than sending something nonsensical.
    const board = buildHexBoard({
      width: 900, height: 600, radius: 20,
      layout: byName('CHROMATIC'), orientation: flat, centreNote: 60,
    });
    check('hexes outside MIDI are marked dead',
      board.cells.some(c => c.pitch === -1), 'expected some out of range');
    check('and nothing live is out of range',
      board.cells.every(c => c.pitch === -1 || (c.pitch >= 0 && c.pitch <= 127)));
  }
  {
    const board = buildHexBoard({
      width: 400, height: 300, radius: 30,
      layout: byName('WICKI-HAYDEN'), orientation: flat, centreNote: 72,
    });
    check('moving the centre moves the whole board',
      board.cells.find(c => c.col === 0 && c.row === 0)!.pitch === 72);
  }

  console.log('\n=== A finger between hexes has a pitch of its own ===');
  {
    const spec = {
      width: 800, height: 500, radius: 34,
      layout: byName('WICKI-HAYDEN'), orientation: flat, centreNote: 60,
    };
    const board = buildHexBoard(spec);
    const centre = board.cells.find(c => c.col === 0 && c.row === 0)!;
    check('over a hex it is that hex\'s note',
      Math.abs(continuousPitch(centre.x, centre.y, spec) - 60) < 1e-9,
      `${continuousPitch(centre.x, centre.y, spec)}`);

    const east = board.cells.find(c => c.col === 2 && c.row === 0)!;
    check('over the next hex east it is that one\'s',
      Math.abs(continuousPitch(east.x, east.y, spec) - 62) < 1e-9,
      `${continuousPitch(east.x, east.y, spec)}`);
    check('and halfway between them it is halfway in pitch',
      Math.abs(continuousPitch((centre.x + east.x) / 2, centre.y, spec) - 61) < 1e-9,
      `${continuousPitch((centre.x + east.x) / 2, centre.y, spec)}`);

    // Which is what makes mode B land in tune rather than approximately.
    const target = board.cells.find(c => c.col === -1 && c.row === 1)!;
    check('sliding to a hex arrives exactly at its note',
      Math.abs(continuousPitch(target.x, target.y, spec) - target.pitch) < 1e-9);
    check('and every hex on the board agrees with the continuous reading',
      board.cells.filter(c => c.pitch >= 0)
        .every(c => Math.abs(continuousPitch(c.x, c.y, spec) - c.pitch) < 1e-9));
  }
  {
    // Zoom must not change what a note is, only how big it is to hit.
    const near = { width: 600, height: 400, radius: 20, layout: byName('HARMONIC TABLE'), orientation: flat, centreNote: 60 };
    const far = { ...near, radius: 70 };
    check('the centre is the centre note at any zoom',
      Math.abs(continuousPitch(300, 200, near) - 60) < 1e-9
      && Math.abs(continuousPitch(300, 200, far) - 60) < 1e-9);
  }

  console.log('\n=== Drawing ===');
  {
    const pts = hexPoints(100, 100, 20).split(' ').map(p => p.split(',').map(Number));
    check('a hexagon has six corners', pts.length === 6);
    check('all of them one radius from the centre',
      pts.every(([x, y]) => Math.abs(Math.hypot(x - 100, y - 100) - 20) < 0.01));
    // Pointy-top: a vertex directly above the centre, not a flat edge.
    check('with a point at the top',
      pts.some(([x, y]) => Math.abs(x - 100) < 0.01 && y < 100));
  }
  {
    check('notes are named for the player', hexNoteFull(60) === 'C4' && hexNoteFull(61) === 'C#4');
    check('nothing is named for a dead hex', hexNoteFull(-1) === '');
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
