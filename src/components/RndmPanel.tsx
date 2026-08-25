import React, { useState } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { MemorySlot } from './MemorySlots';
import { parseChordSymbol } from '../lib/ChordSymbol';
import {
  CHORD_TYPE_GROUPS, ChordTypeGroup, NOTES, NOTE_ROLES,
  chordIntervalsWithCommonNotes, generateProgression, generateSingleChord,
  getAllCommonChordTones,
} from '../lib/RndmEngine';

interface Props {
  engine: OrchidEngine | null;
  memoryVelocity: number;
  onCommit: (slots: MemorySlot[], required: string[]) => void;
  onClose: () => void;
}

interface Settings {
  commonNotes: string[];
  roles: number[];
  types: ChordTypeGroup[];
  count: number;
  mood: number;
  allowRepeats: boolean;
  addCommonNotes: boolean;
}

const DEFAULTS: Settings = {
  commonNotes: [],
  roles: Array.from({ length: 12 }, (_, i) => i),
  types: ['major', 'minor', 'dominant'],
  count: 8,
  mood: 5,
  allowRepeats: false,
  addCommonNotes: true,
};

const load = (): Settings => {
  try {
    const saved = localStorage.getItem('orchid-rndm');
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
};

/** A generated chord as the instrument will play it. */
const toSlot = (symbol: string, commonNotes: string[], addCommonNotes: boolean): MemorySlot => {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return null;
  const intervals = addCommonNotes
    ? chordIntervalsWithCommonNotes(parsed.root, parsed.intervals, commonNotes)
    : parsed.intervals;
  return {
    rootPitch: 60 + parsed.root,
    baseType: -1,
    ext_m7: false, ext_M7: false, ext_6: false, ext_9: false,
    symbol,
    chordIntervals: intervals,
  };
};

/**
 * RNDM: chords chosen by the notes they must be able to hold.
 *
 * You name the notes you want running through the whole set, and it looks for
 * chords whose implied scale can carry them on a degree you have allowed — so
 * the same note can be a ninth in one chord and a third in the next, and which
 * of those you will accept is yours to say.
 *
 * Nothing reaches the pads until you send it, so the set can be heard and
 * individual chords re-rolled first.
 */
export const RndmPanel: React.FC<Props> = ({ engine, memoryVelocity, onCommit, onClose }) => {
  const [settings, setSettings] = useState<Settings>(load);
  const [chords, setChords] = useState<string[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try { localStorage.setItem('orchid-rndm', JSON.stringify(next)); } catch { /* private mode */ }
  };

  const roll = () => {
    const result = generateProgression({
      count: settings.count,
      commonNotes: settings.commonNotes,
      mood: settings.mood,
      allowRepeats: settings.allowRepeats,
      types: settings.types,
      allowedFunctions: settings.roles,
    });
    setChords(result.chords);
    setSelected(null);
    setNote(result.fallback
      ? 'NOTHING FITS THOSE NOTES AND ROLES — WIDEN THEM'
      : null);
  };

  const reroll = (index: number) => {
    const replacement = generateSingleChord(
      settings.commonNotes, settings.mood, settings.types, chords, settings.roles);
    setChords(previous => previous.map((chord, i) => (i === index ? replacement : chord)));
  };

  // Held rather than tapped, so a chord sounds for as long as it is wanted.
  const preview = (index: number) => {
    const slot = toSlot(chords[index], settings.commonNotes, settings.addCommonNotes);
    if (!engine || !slot) return;
    if (held !== null) release();
    engine.handleMidi(slot.rootPitch, memoryVelocity, true, false, false, false, true, undefined, slot.chordIntervals);
    setHeld(index);
  };
  const release = () => {
    if (held === null) return;
    const slot = toSlot(chords[held], settings.commonNotes, settings.addCommonNotes);
    if (engine && slot) {
      engine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, undefined, slot.chordIntervals);
    }
    setHeld(null);
  };

  const commit = () => {
    release();
    const slots: MemorySlot[] = Array(8).fill(null);
    chords.slice(0, 8).forEach((chord, i) => {
      slots[i] = toSlot(chord, settings.commonNotes, settings.addCommonNotes);
    });
    onCommit(slots, settings.commonNotes);
    onClose();
  };

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter(x => x !== value) : [...list, value];

  const extra = getAllCommonChordTones(chords).filter(n => !settings.commonNotes.includes(n));

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="module w-[860px] max-w-full max-h-[92vh] overflow-y-auto settings-scroll !bg-[var(--surface)] flex flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="label-meta !text-[var(--accent)]">RNDM — CHORDS THAT CAN HOLD YOUR NOTES</p>
          <div className="flex items-center gap-2">
            <button onClick={roll} className="analog-btn !px-5 !py-2 !text-[11px] tracking-[0.18em] active">
              RANDOMOO
            </button>
            <button onClick={onClose} className="analog-btn !text-[9px] !px-3 !py-[5px]">CLOSE</button>
          </div>
        </div>

        {/* What was asked for, and what the set turned out to share anyway. */}
        <div className="flex items-center gap-3 flex-wrap border-y border-white/10 py-2">
          <span className="label-meta !text-[9px] opacity-50">REQUIRED</span>
          <span className="font-['Space_Mono'] text-[12px] text-[var(--accent)]">
            {settings.commonNotes.length ? settings.commonNotes.join('  ') : 'NONE'}
          </span>
          {extra.length > 0 && (
            <>
              <span className="label-meta !text-[9px] opacity-50">ALSO SHARED</span>
              <span className="font-['Space_Mono'] text-[12px] text-white/60">{extra.join('  ')}</span>
            </>
          )}
          {note && <span className="label-meta !text-[9px] !text-[#D9534F] ml-auto">{note}</span>}
        </div>

        {/* The chords. Hold one to hear it; ⟳ replaces just that one. */}
        <div className="grid grid-cols-4 gap-2">
          {(chords.length ? chords : Array(settings.count).fill(null)).map((chord, i) => (
            <div key={i} className="relative">
              <button
                disabled={!chord}
                onPointerDown={() => { if (chord) { setSelected(i); preview(i); } }}
                onPointerUp={release}
                onPointerLeave={release}
                onPointerCancel={release}
                className={`w-full h-14 rounded-sm border-2 font-['Space_Mono'] text-[13px] px-1 leading-tight touch-none select-none
                  ${held === i ? '!bg-white !text-black border-white'
                    : chord ? 'bg-[var(--accent)] text-black border-[var(--ink)]'
                    : 'bg-[var(--surface-deep)] text-white/25 border-white/10'}`}
              >
                {chord ?? '—'}
              </button>
              {chord && (
                <button
                  onClick={() => reroll(i)}
                  title="Replace just this chord"
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--surface-deep)] border border-white/25 text-[10px] text-white/70 flex items-center justify-center"
                >
                  ⟳
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Section title="COMMON NOTES" hint="THE NOTES EVERY CHORD MUST BE ABLE TO HOLD">
            <div className="grid grid-cols-6 gap-1">
              {NOTES.map(name => (
                <button
                  key={name}
                  onClick={() => update({ commonNotes: toggle(settings.commonNotes, name) })}
                  className={`h-9 rounded-[2px] border font-['Space_Mono'] text-[11px] ${
                    settings.commonNotes.includes(name)
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
                      : 'bg-[var(--surface-deep)] border-white/15 text-white/70'}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </Section>

          <Section title="NOTE ROLE" hint="WHICH DEGREES A COMMON NOTE MAY LAND ON">
            <div className="flex flex-wrap gap-1">
              {NOTE_ROLES.map((role, i) => (
                <Chip
                  key={role}
                  label={role}
                  on={settings.roles.includes(i)}
                  onClick={() => update({ roles: toggle(settings.roles, i) })}
                />
              ))}
            </div>
          </Section>

          <Section title="CHORD TYPES" hint="THE FAMILIES IT MAY CHOOSE FROM">
            <div className="flex flex-wrap gap-1">
              {CHORD_TYPE_GROUPS.map(group => (
                <Chip
                  key={group.id}
                  label={group.label}
                  on={settings.types.includes(group.id)}
                  onClick={() => update({ types: toggle(settings.types, group.id) })}
                />
              ))}
            </div>
          </Section>

          <Section title="PARAMETERS">
            <Slider label="COUNT" min={2} max={8} value={settings.count}
              onChange={v => update({ count: v })} />
            <Slider label="MOOD" min={0} max={10} value={settings.mood}
              format={v => (v < 5 ? `${v} DARK` : v > 5 ? `${v} BRIGHT` : `${v} EVEN`)}
              onChange={v => update({ mood: v })} />
            <Switch label="REPEAT ROOTS" on={settings.allowRepeats}
              onClick={() => update({ allowRepeats: !settings.allowRepeats })} />
            <Switch label="ADD COMMON NOTES" on={settings.addCommonNotes}
              onClick={() => update({ addCommonNotes: !settings.addCommonNotes })} />
          </Section>
        </div>

        <p className="help-text label-meta !text-[0.6rem] opacity-70 leading-relaxed">
          A COMMON NOTE IS ONLY REQUIRED TO <em>FIT</em> — TO BELONG TO THE SCALE THE CHORD
          IMPLIES — NOT TO BE STATED BY IT. ADD COMMON NOTES PUTS ANY THE CHORD DOES NOT
          STATE AN OCTAVE ABOVE ITS ROOT, WHICH IS WHAT MAKES THEM AUDIBLE THROUGH THE
          WHOLE SET. THE CHORDS ARRIVE AS SYMBOLS, SO THEY STILL FOLLOW REGISTER,
          INVERSION AND THE VOICING DISK.
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={commit}
            disabled={chords.length === 0}
            className={`analog-btn flex-1 !py-3 !text-[11px] tracking-[0.2em] ${chords.length ? 'active' : 'opacity-40'}`}
          >
            SEND {Math.min(chords.length, 8) || ''} TO MEMORY PADS
          </button>
          <button onClick={onClose} className="analog-btn !px-5 !py-3 !text-[11px] tracking-[0.2em]">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="bg-[var(--surface-deep)] border border-white/10 rounded-[2px] p-3 flex flex-col gap-2">
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="label-meta !text-[9px] !text-[var(--accent)]">{title}</span>
      {hint && <span className="label-meta !text-[8px] opacity-40">{hint}</span>}
    </div>
    {children}
  </div>
);

const Chip: React.FC<{ label: string; on: boolean; onClick: () => void }> = ({ label, on, onClick }) => (
  <button
    onClick={onClick}
    className={`px-[10px] py-[5px] rounded-full font-['Space_Mono'] text-[10px] border ${
      on ? 'bg-[var(--accent)] border-[var(--accent)] text-black' : 'bg-transparent border-white/20 text-white/60'}`}
  >
    {label}
  </button>
);

const Slider: React.FC<{
  label: string; min: number; max: number; value: number;
  format?: (v: number) => string; onChange: (v: number) => void;
}> = ({ label, min, max, value, format, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="label-meta !text-[9px] w-20 shrink-0">{label}</span>
    <input
      type="range" min={min} max={max} step={1} value={value}
      onChange={e => onChange(parseInt(e.target.value, 10))}
      className="range-sm !w-28 shrink-0 accent-[var(--accent)]"
    />
    <span className="label-meta !text-[9px] !text-[var(--accent)]">{format ? format(value) : value}</span>
  </div>
);

const Switch: React.FC<{ label: string; on: boolean; onClick: () => void }> = ({ label, on, onClick }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="label-meta !text-[9px]">{label}</span>
    <div className={`toggle-switch sm ${on ? 'on' : ''}`} onClick={onClick} />
  </div>
);
