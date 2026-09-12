/**
 * A preset pad carries both readings of its chord: the notes the progression was
 * written with, and the chord those notes spell. AS WRITTEN chooses between
 * them, so a preset either keeps the voicing it came with or is voiced by the
 * disk like anything else on the pads — and the switch re-voices what is already
 * on the board rather than only what is loaded after it.
 */
import { OrchidEngine } from '../src/lib/OrchidEngine.ts';
import { defaultParams } from '../src/types.ts';
import { CHORD_PRESETS, presetPad } from '../src/lib/ChordPresets.ts';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
};

const pcs = (notes: number[]) =>
  [...new Set(notes.map(n => ((n % 12) + 12) % 12))].sort((a, b) => a - b).join();
const gaps = (notes: number[]) =>
  [...notes].sort((a, b) => a - b).slice(1).map((n, i) => n - [...notes].sort((a, b) => a - b)[i]).join();

type Pad = ReturnType<typeof presetPad>;

function rig(over: Record<string, unknown> = {}) {
  const engine = new OrchidEngine({
    ...defaultParams,
    mpeEnabled: false, strumEngine: 0, autoBassRegister: 0, patternEnabled: false,
    inversionRepeat: 0, chordInversion: 0, chordRegisterStart: 48,
    voiceLeadEnabled: false, voicingPlayed: true, ...over,
  } as any);
  const events: Array<{ on: boolean; pitch: number }> = [];
  engine.onOutputNote = (e: any) => {
    if (e.isCC || e.isExpression || e.isPitchBend) return;
    events.push({ on: !!e.isOn && e.velocity > 0, pitch: e.pitch });
  };
  const sounding = () => {
    const last = new Map<number, boolean>();
    for (const e of events) last.set(e.pitch, e.on);
    return [...last].filter(([, on]) => on).map(([p]) => p).sort((a, b) => a - b);
  };
  const down = (pad: Pad) =>
    engine.handleMidi(pad.rootPitch, 100, true, false, false, false, true, pad.customVoicing, pad.chordIntervals, 0);
  const up = (pad: Pad) =>
    engine.handleMidi(pad.rootPitch, 0, false, false, false, false, true, pad.customVoicing, pad.chordIntervals, 0);
  /** Press a preset pad and hand back what it sounded. */
  const play = (pad: Pad) => { events.length = 0; down(pad); const heard = sounding(); up(pad); return heard; };
  return { engine, events, sounding, down, up, play };
}

function main() {
  const pads = CHORD_PRESETS.flatMap(preset => preset.chords.map(presetPad));
  const written = CHORD_PRESETS.flatMap(preset => preset.chords.map(c => [...c.notes].sort((a, b) => a - b)));

  console.log(`\n=== Both readings of ${pads.length} preset chords ===`);
  {
    check('every pad names a root', pads.every(p => p.rootPitch >= 60 && p.rootPitch <= 71),
      `${pads.filter(p => p.rootPitch < 60 || p.rootPitch > 71).length} outside`);
    const spelt = pads.filter((p, i) =>
      pcs(p.chordIntervals.map(i2 => p.rootPitch + i2)) === pcs(written[i]));
    check('and spells exactly the notes it was written with, nothing added or lost',
      spelt.length === pads.length, `${pads.length - spelt.length} differ`);
    check('the written notes are kept as they were',
      pads.every((p, i) => p.customVoicing.join() === written[i].join()));
    check('and the name it was labelled with is kept',
      pads.every((p, i) => p.symbol === CHORD_PRESETS.flatMap(s => s.chords)[i].symbol));
  }

  console.log('\n=== What a preset pad sounds ===');
  {
    const disk = rig({ presetAsWritten: false });
    const asWritten = rig({ presetAsWritten: true });
    // A pad carrying nothing but its voicing is what a preset used to be, and it
    // still takes the written path — so it is what AS WRITTEN has to match.
    const frozen = rig({ presetAsWritten: false });
    let sameNotes = 0, asBefore = 0;
    const wrong: string[] = [];
    pads.forEach((pad, i) => {
      const voiced = disk.play(pad);
      const kept = asWritten.play(pad);
      const old = frozen.play({ ...pad, chordIntervals: undefined } as any);
      if (pcs(voiced) === pcs(written[i])) sameNotes++;
      else wrong.push(`${pad.symbol}: ${voiced} vs written ${written[i]}`);
      if (kept.join() === old.join()) asBefore++;
    });
    check('voiced by the disk, a preset still sounds its own notes',
      sameNotes === pads.length, `${pads.length - sameNotes} differ | ${wrong.slice(0, 2).join(' | ')}`);
    check('AS WRITTEN sounds exactly as a frozen preset always did',
      asBefore === pads.length, `${pads.length - asBefore} differ`);
  }

  console.log('\n=== The disk reaches them ===');
  {
    // With PLAYED VOICINGS on, the disk chooses a library shape — which it can
    // only do for a chord the library states exactly as written. Most presets
    // are ninth chords it has no exact shape for, and those are built plain.
    const close = rig({ presetAsWritten: false, voicingX: -1, voicingY: 0 });
    const wide = rig({ presetAsWritten: false, voicingX: 1, voicingY: 0 });
    const moved = pads.filter(pad => close.play(pad).join() !== wide.play(pad).join()).length;
    console.log(`     CLOSE to WIDE, played voicings on: ${moved} of ${pads.length} presets re-voiced`);
    check('the disk re-voices the presets the library can state', moved > pads.length * 0.15,
      `${moved}/${pads.length}`);

    // With it off the disk is the drop voicings, which act on any chord at all.
    const closed = rig({ presetAsWritten: false, voicingPlayed: false, voicingX: 0, voicingY: -1 });
    const drop2 = rig({ presetAsWritten: false, voicingPlayed: false, voicingX: 0.951, voicingY: -0.309 });
    const dropped = pads.filter(pad => closed.play(pad).join() !== drop2.play(pad).join()).length;
    console.log(`     CLOSED to DROP 2, played voicings off: ${dropped} of ${pads.length} presets re-voiced`);
    check('and with played voicings off it reaches nearly all of them',
      dropped > pads.length * 0.8, `${dropped}/${pads.length}`);

    const frozenClose = rig({ presetAsWritten: true, voicingX: -1, voicingY: 0 });
    const frozenWide = rig({ presetAsWritten: true, voicingX: 1, voicingY: 0 });
    const frozenMoved = pads.filter(pad => frozenClose.play(pad).join() !== frozenWide.play(pad).join()).length;
    check('and AS WRITTEN keeps them where the disk cannot reach them', frozenMoved === 0,
      `${frozenMoved} moved`);
  }

  console.log('\n=== The switch acts on pads already loaded ===');
  {
    const pad = presetPad(CHORD_PRESETS[0].chords[0]);
    const r = rig({ presetAsWritten: false });
    r.events.length = 0;
    r.down(pad);
    const voiced = r.sounding();
    r.engine.params = { ...r.engine.params, presetAsWritten: true };
    r.engine.retriggerHeldKeys(true);
    const afterSwitch = r.sounding();
    const fresh = rig({ presetAsWritten: true }).play(pad);
    check('flipping it re-voices the pad that is sounding', afterSwitch.join() !== voiced.join(),
      `${afterSwitch} vs ${voiced}`);
    check('to the voicing it was written with', gaps(afterSwitch) === gaps(fresh),
      `${afterSwitch} vs ${fresh}`);
    r.up(pad);
    check('and nothing is left sounding afterwards', r.sounding().length === 0, `${r.sounding()}`);
  }

  console.log('\n=== What the switch must not touch ===');
  {
    // A MIDI import or a chord saved by hand carries a voicing and nothing else,
    // so there is no second reading to voice it from: it plays as it was saved.
    const imported = { rootPitch: 60, customVoicing: [52, 55, 60, 64], chordIntervals: undefined, symbol: 'C' } as any;
    const off = rig({ presetAsWritten: false }).play(imported);
    const on = rig({ presetAsWritten: true }).play(imported);
    check('a pad saved as a voicing sounds the same either way', off.join() === on.join(),
      `${off} vs ${on}`);
    check('and keeps its own shape', gaps(off) === gaps([52, 55, 60, 64]), `${off}`);
  }
  {
    // A chord pasted as a symbol has no written voicing at all, and was always
    // the disk's to voice.
    const typed = { rootPitch: 60, customVoicing: undefined, chordIntervals: [0, 4, 7, 11], symbol: 'Cmaj7' } as any;
    const before = rig({ presetAsWritten: false }).play(typed);
    const after = rig({ presetAsWritten: true }).play(typed);
    check('a typed chord is untouched by the switch', before.join() === after.join(),
      `${before} vs ${after}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
