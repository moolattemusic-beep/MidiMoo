import { CustomSlider } from './CustomSlider';
import { SectionIcon } from './SectionIcon';
import React, { useState } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { OrchidParams } from '../types';
import { stageDurationMs } from '../lib/VelocityModulator';

interface SettingsPanelProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  onResendMpeConfig?: () => void;
}


// Sensitivity is a multiplier, so it wants equal proportional steps rather
// than equal numeric ones — otherwise 1x would sit crammed against the left.
const SENS_MIN = 1;
const SENS_MAX = 8;
const SENS_TICKS = 1000;
const sensToSlider = (g: number) =>
  Math.round(Math.log(Math.max(SENS_MIN, g) / SENS_MIN) / Math.log(SENS_MAX / SENS_MIN) * SENS_TICKS);
const sliderToSens = (pos: number) => {
  const g = SENS_MIN * Math.pow(SENS_MAX / SENS_MIN, pos / SENS_TICKS);
  return Math.min(SENS_MAX, Math.max(SENS_MIN, Math.round(g * 20) / 20));
};

// Vibrato depth wants proportional steps: the difference between 0.1 and 0.2
// semitones matters far more than between 11 and 12.
const VDEP_MIN = 0.02;
const VDEP_MAX = 12;
const VDEP_TICKS = 1000;
const vdepToSlider = (st: number) =>
  st <= 0 ? 0 : Math.round(Math.log(Math.max(VDEP_MIN, st) / VDEP_MIN) / Math.log(VDEP_MAX / VDEP_MIN) * VDEP_TICKS);
const sliderToVdep = (pos: number) => {
  if (pos <= 0) return 0;
  const st = VDEP_MIN * Math.pow(VDEP_MAX / VDEP_MIN, pos / VDEP_TICKS);
  const grain = st < 0.5 ? 0.01 : st < 2 ? 0.05 : 0.1;
  return Math.min(VDEP_MAX, Math.round(st / grain) * grain);
};

// Attack/Release use the Logic script's curve; show the time it works out to.
/** A MIDI note as a player would name it, so a range reads as pitches. */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (n: number): string =>
  `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;

const fmtStage = (p: number) => {
  const ms = stageDurationMs(p);
  if (ms <= 0) return 'INSTANT';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}S` : `${Math.round(ms)}MS`;
};

/**
 * Sections behave as an accordion: opening one closes its siblings, so the
 * panel never grows past a screenful. Nesting is respected — opening a
 * subsection must not collapse the section containing it — so each level keeps
 * its own "which one is open", keyed by group.
 */
const AccordionContext = React.createContext<{
  openByGroup: Record<string, string | null>;
  setOpen: (group: string, title: string | null) => void;
}>({ openByGroup: {}, setOpen: () => {} });

const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  extraHeader?: React.ReactNode;
  group?: string;
}> = ({ title, children, extraHeader, group = 'root' }) => {
  const { openByGroup, setOpen } = React.useContext(AccordionContext);
  const isOpen = openByGroup[group] === title;

  const toggle = () => setOpen(group, isOpen ? null : title);

  // Top-level sections behave as a drill-in list rather than an accordion: the
  // headers read as buttons, and choosing one hands it the whole column while
  // the others step aside. That way a section is never fighting six headers for
  // room, which is what forced scrolling before.
  const openTitle = openByGroup[group];
  const drillIn = group === 'root';
  if (drillIn && openTitle && !isOpen) return null;

  return (
    <div className="module !py-3 flex flex-col shrink-0">
      <div
        className={`shrink-0 flex justify-between items-center cursor-pointer select-none ${isOpen && drillIn ? 'pb-1' : ''}`}
        onClick={toggle}
      >
        <p className="label-meta flex items-center gap-2">
          {isOpen && drillIn && <span className="text-[var(--accent)] text-[10px]">◀</span>}
          {/* Only the top-level list is marked. The subsections sit inside an
              already-identified section, where a second rank of icons would be
              decoration rather than a way of finding anything. */}
          {drillIn && (
            <span className={isOpen ? 'text-[var(--accent)]' : 'opacity-70'}>
              <SectionIcon title={title} />
            </span>
          )}
          {title}
        </p>
        <div className="flex items-center gap-3">
          {extraHeader && <div onClick={(e) => e.stopPropagation()}>{extraHeader}</div>}
          <span className="text-[var(--accent)] opacity-80 text-[10px]">
            {isOpen ? (drillIn ? 'BACK' : '▲') : '▼'}
          </span>
        </div>
      </div>
      {isOpen && (
        <div className="mt-3 pt-3 border-t border-white/5">
          {children}
        </div>
      )}
    </div>
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ engine, params, setParams, onResendMpeConfig }) => {
  const [openByGroup, setOpenByGroup] = useState<Record<string, string | null>>(() => {
    try { return JSON.parse(localStorage.getItem('orchid-open-sections') || '{}'); } catch { return {}; }
  });
  const setOpen = React.useCallback((group: string, title: string | null) => {
    setOpenByGroup(prev => {
      const next = { ...prev, [group]: title };
      localStorage.setItem('orchid-open-sections', JSON.stringify(next));
      return next;
    });
  }, []);
  const accordion = React.useMemo(() => ({ openByGroup, setOpen }), [openByGroup, setOpen]);

  
  const updateParam = (key: keyof OrchidParams, value: any) => {
    let newParams = { ...params, [key]: value };

    // Free MOO is the glide engine for Free mode, so pick it automatically as
    // soon as both switches line up. Still overridable by hand afterwards.
    const enteringFreeMoo =
      (key === 'keyboardMapping' && value === 3 && newParams.mpeEnabled) ||
      (key === 'mpeEnabled' && value === true && newParams.keyboardMapping === 3);
    if (enteringFreeMoo) newParams = { ...newParams, mpeGlideMode: 3 };

    setParams(newParams);
    if (engine) {
      if (key === 'chordRegisterStart') {
        engine.updateRegister(value);
      } else if (key === 'chordInversion') {
        engine.updateInversion(value);
      } else if (key === 'outputRangeLow' || key === 'outputRangeHigh') {
        // The range is a setting rather than something played: it takes effect
        // on what comes next and never re-sounds what is already held.
        engine.params = newParams;
      } else if (key === 'chordMaxNotes' || key === 'chordColor') {
        engine.params = newParams;
        engine.retriggerHeldKeys(true);
      } else if (key === 'mpeEnabled' || key === 'mpeGlideMode' || key === 'keyboardMapping') {
        engine.params = newParams;
        // Switching engines must not strand notes parked by the previous one.
        engine.flushGlideCarry();
      } else {
        engine.params = newParams;
      }
    }
  };

  const keyRoots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
  
  return (
    <AccordionContext.Provider value={accordion}>
      <CollapsibleSection title="Global Mapping">
        <div className="grid grid-cols-4 gap-2">
          {["CLASSIC", "CIRCLE 5TH", "KEY MODE", "FREE MODE"].map((mode, idx) => (
            <button
              key={mode}
              onClick={() => updateParam('keyboardMapping', idx)}
              className={`analog-btn ${params.keyboardMapping === idx ? 'active' : ''}`}
            >
              {mode}
            </button>
          ))}
        </div>
        
        <div className={`transition-opacity duration-300 ${params.keyboardMapping === 2 ? 'opacity-100 mt-4' : 'opacity-30 mt-4 pointer-events-none'}`}>
          <div className="mb-4">
            <p className="label-meta mb-2">ROOT NOTE</p>
            <select 
              value={params.keyRoot}
              onChange={(e) => updateParam('keyRoot', parseInt(e.target.value))}
              className="w-full bg-black text-[var(--accent)] border border-[#444] px-2 py-1 font-['Space_Mono'] text-xs rounded-sm outline-none"
            >
              {keyRoots.map((note, i) => <option key={i} value={i}>{note}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <p className="label-meta mb-2">SCALE</p>
            <select 
              value={params.keyScale}
              onChange={(e) => updateParam('keyScale', parseInt(e.target.value))}
              className="w-full bg-black text-[var(--accent)] border border-[#444] px-2 py-1 font-['Space_Mono'] text-xs rounded-sm outline-none"
            >
              <option value={0}>MAJOR</option>
              <option value={1}>NAT MINOR</option>
              <option value={2}>MEL MINOR</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="auto7"
              checked={params.alwaysAdd7th}
              onChange={(e) => updateParam('alwaysAdd7th', e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <label htmlFor="auto7" className="label-meta !text-[var(--ink)] cursor-pointer">Auto-add diatonic 7ths</label>
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Register Control">
        <div className="flex justify-between items-center mb-3">
          <span className="label-meta">SILENT</span>
          <div
            className={`toggle-switch sm ${params.registerSilent ? 'on' : ''}`}
            title="Silent: moving REGISTER sets up the next chord instead of playing"
            onClick={() => updateParam('registerSilent', !params.registerSilent)}
          ></div>
        </div>
        <p className="help-text label-meta !text-[0.6rem] opacity-75 mb-4 leading-relaxed">
          REGISTER MOVES THE CHORD AND INVERTS IT AS IT GOES: NOTES THAT FALL BELOW
          IT ARE LIFTED AN OCTAVE, SO SLIDING WALKS THROUGH THE INVERSIONS AND ON
          INTO THE NEXT REGISTER. SILENT: MOVING IT MAKES NO SOUND, IT ONLY SETS
          WHERE THE NEXT CHORD IS VOICED. OFF: IT RE-VOICES WHAT IS SOUNDING, AND
          UNDER THE SUSTAIN PEDAL EACH VOICING IS KEPT, SO IT STACKS THEM INTO AN
          ARPEGGIO.
        </p>
        <div className="mb-6 h-[50px]">
          <div className="fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">REGISTER</span>
              <span className="label-meta !text-[var(--accent)]">{params.chordRegisterStart}</span>
            </div>
            <CustomSlider
              min={24}
              max={96}
              step={1}
              value={params.chordRegisterStart}
              onChange={(val) => updateParam('chordRegisterStart', val)}
            />
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <span className="label-meta">INVERSION</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateParam('chordInversion', Math.max(-8, (params.chordInversion ?? 0) - 1))}
              className="analog-btn !text-[11px] !px-3 !py-[3px]"
              title="Take the top note down an octave"
            >
              −
            </button>
            <span className="label-meta !text-[var(--accent)] w-6 text-center">{params.chordInversion ?? 0}</span>
            <button
              onClick={() => updateParam('chordInversion', Math.min(8, (params.chordInversion ?? 0) + 1))}
              className="analog-btn !text-[11px] !px-3 !py-[3px]"
              title="Take the bottom note up an octave"
            >
              +
            </button>
            <button
              onClick={() => updateParam('chordInversion', 0)}
              className="analog-btn !text-[9px] !px-2 !py-[3px] ml-1"
              title="Back to root position"
            >
              0
            </button>
          </div>
        </div>

        <div className="mb-6 h-[50px]">
          <div className="fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">MAX NOTES</span>
              <span className="label-meta !text-[var(--accent)]">{params.chordMaxNotes ?? 6}</span>
            </div>
            <CustomSlider
              min={1}
              max={8}
              step={1}
              value={params.chordMaxNotes ?? 6}
              onChange={(val) => updateParam('chordMaxNotes', val)}
            />
          </div>
        </div>

        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta">RANGE</span>
            <span className="label-meta !text-[var(--accent)]">
              {noteName(params.outputRangeLow ?? 24)} – {noteName(params.outputRangeHigh ?? 96)}
            </span>
          </div>
          {/* Two handles on one line: everything the app sends is moved by
              octaves until it sits between them, so no part strays into a
              register it was never meant to reach.

              Both tracks ignore clicks and only the thumbs answer them. They
              are stacked full-width, so a track that accepted a click would let
              the upper input win anywhere along it — reaching for the high
              handle and missing would send the low one to meet it, collapsing
              the range into the top of the keyboard. */}
          <div className="relative h-[26px]">
            <input
              type="range" min={0} max={127}
              value={params.outputRangeLow ?? 24}
              onChange={(e) => {
                const v = Math.min(parseInt(e.target.value, 10), (params.outputRangeHigh ?? 96) - 12);
                updateParam('outputRangeLow', v);
              }}
              className="range-sm w-full absolute inset-0 accent-[var(--accent)] pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto"
            />
            <input
              type="range" min={0} max={127}
              value={params.outputRangeHigh ?? 96}
              onChange={(e) => {
                const v = Math.max(parseInt(e.target.value, 10), (params.outputRangeLow ?? 24) + 12);
                updateParam('outputRangeHigh', v);
              }}
              className="range-sm w-full absolute inset-0 accent-[var(--accent)] pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto"
            />
          </div>
          <p className="help-text label-meta !text-[0.6rem] opacity-75 mt-1 leading-relaxed">
            EVERYTHING LEAVING THE APP IS MOVED BY WHOLE OCTAVES UNTIL IT FITS BETWEEN
            THESE, SO A NOTE KEEPS ITS NAME AND ONLY CHANGES REGISTER.
          </p>
        </div>

        <p className="label-meta mb-2">AUTO BASS</p>
        <div className="grid grid-cols-4 gap-2">
          {["OFF", "C0", "C1", "C2"].map((val, idx) => (
            <button
              key={val}
              onClick={() => updateParam('autoBassRegister', idx)}
              className={`analog-btn ${params.autoBassRegister === idx ? 'active' : ''}`}
            >
              {val}
            </button>
          ))}
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="MPE GLIDE" extraHeader={<div
            className={`toggle-switch ${params.mpeEnabled ? 'on' : ''}`}
            onClick={() => updateParam('mpeEnabled', !params.mpeEnabled)}
          ></div>}>
        {params.mpeEnabled && (
          <div className="fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">GLIDE TIME</span>
              <span className="label-meta !text-[var(--accent)]">{params.mpeGlideTimeMs}MS</span>
            </div>
            <CustomSlider
              min={0}
              max={1500}
              step={10}
              value={params.mpeGlideTimeMs}
              onChange={(val) => updateParam('mpeGlideTimeMs', val)}
            />

            <p className="label-meta mt-4 mb-2">BEND RANGE (MATCH YOUR SYNTH)</p>
            <div className="grid grid-cols-4 gap-2">
              {[2, 12, 24, 48].map((val) => (
                <button
                  key={val}
                  onClick={() => updateParam('mpeBendRange', val)}
                  className={`analog-btn ${params.mpeBendRange === val ? 'active' : ''}`}
                >
                  ±{val}
                </button>
              ))}
            </div>
            <p className="help-text label-meta !text-[0.6rem] opacity-75 mt-2 leading-relaxed">
              GLIDED NOTES SOUND AT THE WRONG PITCH UNLESS THIS MATCHES THE
              RECEIVING SYNTH. ±48 IS THE MPE DEFAULT; NON-MPE SYNTHS USE ±2.
            </p>
            <button
              onClick={() => onResendMpeConfig?.()}
              className="analog-btn w-full !py-2 mt-2"
              title="Re-send the pitch bend range to the synth"
            >
              SEND CONFIG TO SYNTH
            </button>
            <p className="help-text label-meta !text-[0.6rem] opacity-75 mt-1 leading-relaxed">
              PRESS AFTER LOADING A NEW PLUGIN. NOT AUTOMATIC: THE CONFIG
              CONTAINS CC 6, WHICH AN ARMED MIDI-LEARN WOULD GRAB.
            </p>

            <p className="label-meta mt-4 mb-2">GLIDE ENGINE</p>
            <div className="grid grid-cols-4 gap-2">
              {["LEGATO", "GRACE", "HOLD", "FREE MOO"].map((val, idx) => (
                <button
                  key={val}
                  onClick={() => updateParam('mpeGlideMode', idx)}
                  className={`analog-btn ${params.mpeGlideMode === idx ? 'active' : ''}`}
                >
                  {val}
                </button>
              ))}
            </div>
            <p className="help-text label-meta !text-[0.6rem] opacity-75 mt-2 leading-relaxed">
              {params.mpeGlideMode === 0 && 'GLIDES ONLY WHILE CHORDS OVERLAP OR SUSTAIN IS HELD'}
              {params.mpeGlideMode === 1 && 'CHORDS STAY ALIVE BRIEFLY AFTER RELEASE SO THE NEXT ONE GLIDES'}
              {params.mpeGlideMode === 2 && 'CHORDS RING UNTIL THE NEXT ONE GLIDES IN — PANIC TO STOP'}
              {params.mpeGlideMode === 3 && (params.keyboardMapping === 3
                ? 'FIXED VOICE POOL — ONE NOTE MOVES A VOICE, A CHORD RE-VOICES THEM ALL'
                : 'FREE MOO ONLY APPLIES IN FREE MODE — OTHER MAPPINGS GLIDE AS LEGATO')}
            </p>

            {params.mpeGlideMode === 1 && (
              <div className="fade-in mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="label-meta">GRACE WINDOW</span>
                  <span className="label-meta !text-[var(--accent)]">{params.mpeGraceMs}MS</span>
                </div>
                <CustomSlider
                  min={50}
                  max={2000}
                  step={10}
                  value={params.mpeGraceMs}
                  onChange={(val) => updateParam('mpeGraceMs', val)}
                />
              </div>
            )}

            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="label-meta">MAX VOICES</span>
                <span className="label-meta !text-[var(--accent)]">{params.mpeMaxVoices}</span>
              </div>
              <CustomSlider
                min={1}
                max={8}
                step={1}
                value={params.mpeMaxVoices}
                onChange={(val) => updateParam('mpeMaxVoices', val)}
              />
              <p className="help-text label-meta !text-[0.6rem] opacity-75 mt-1 leading-relaxed">
                THE SIZE OF THE FREE MOO VOICE POOL, AND HOW MANY NOTES A MEMORY
                CHORD IS VOICED WITH. THE 5TH IS DROPPED BEFORE ANY ALTERATION.
              </p>
            </div>

            {params.mpeGlideMode === 3 && (
              <div className="fade-in mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="label-meta">CHORD WINDOW</span>
                  <span className="label-meta !text-[var(--accent)]">{params.mpeChordWindowMs}MS</span>
                </div>
                <CustomSlider
                  min={10}
                  max={300}
                  step={5}
                  value={params.mpeChordWindowMs}
                  onChange={(val) => updateParam('mpeChordWindowMs', val)}
                />
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="VELOCITY MOD" extraHeader={<div
            className={`toggle-switch ${params.velModEnabled ? 'on' : ''}`}
            onClick={() => updateParam('velModEnabled', !params.velModEnabled)}
          ></div>}>
        <p className="help-text label-meta !text-[0.6rem] opacity-75 mb-4 leading-relaxed">
          HOW HARD YOU PLAY SWEEPS PITCH AND CC1 AND LETS THEM FALL BACK.
          THE FIRST NOTE OF A CHORD SETS THE DEPTH. MIDI OUT ONLY.
        </p>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta">SENSITIVITY</span>
            <span className="label-meta !text-[var(--accent)]">×{(params.velModSensitivity ?? 1).toFixed(2)}</span>
          </div>
          <CustomSlider
            min={0} max={SENS_TICKS} step={1}
            value={sensToSlider(params.velModSensitivity ?? 1)}
            onChange={(pos) => updateParam('velModSensitivity', sliderToSens(pos))}
          />
          <p className="help-text label-meta !text-[0.6rem] opacity-75 mt-1 leading-relaxed">
            STEEPENS THE VELOCITY RESPONSE FOR BOTH PITCH AND CC1, PIVOTING
            AROUND MID VELOCITY. AT ×{(params.velModSensitivity ?? 1).toFixed(2)} THE FULL DEPTH IS SPANNED
            BETWEEN VELOCITY {Math.round(127 * Math.max(0, 0.5 - 0.5 / (params.velModSensitivity ?? 1)))} AND {Math.round(127 * Math.min(1, 0.5 + 0.5 / (params.velModSensitivity ?? 1)))}.
          </p>
        </div>

        <CollapsibleSection group="velmod" title="VEL PITCH" extraHeader={<div
              className={`toggle-switch ${params.velModPitchEnabled ? 'on' : ''}`}
              onClick={() => updateParam('velModPitchEnabled', !params.velModPitchEnabled)}
            ></div>}>
          {([
            ['AMOUNT', 'velModPitchAmount', -24, 24, 0.5, (v: number) => `${v > 0 ? '+' : ''}${v}ST`],
            ['ATTACK', 'velModPitchAttack', 0, 100, 1, fmtStage],
            ['RELEASE', 'velModPitchRelease', 0, 100, 1, fmtStage],
          ] as const).map(([label, key, min, max, step, fmt]) => (
            <div className="mb-3" key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="label-meta">{label}</span>
                <span className="label-meta !text-[var(--accent)]">{fmt(params[key] as number)}</span>
              </div>
              <CustomSlider min={min} max={max} step={step} value={params[key] as number}
                onChange={(v) => updateParam(key, v)} />
            </div>
          ))}
          <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
            PITCH ALWAYS RESTS AT ZERO — ONLY THE ENVELOPE MOVES IT.
          </p>
        </CollapsibleSection>

        <CollapsibleSection group="velmod" title="VIBRATO" extraHeader={<div
              className={`toggle-switch ${params.vibratoEnabled ? 'on' : ''}`}
              onClick={() => updateParam('vibratoEnabled', !params.vibratoEnabled)}
            ></div>}>
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="label-meta">PITCH DEPTH</span>
              <span className="label-meta !text-[var(--accent)]">{(params.vibratoDepth ?? 0).toFixed(2)}ST</span>
            </div>
            <CustomSlider
              min={0} max={VDEP_TICKS} step={1}
              value={vdepToSlider(params.vibratoDepth ?? 0)}
              onChange={(pos) => updateParam('vibratoDepth', sliderToVdep(pos))}
            />
          </div>
          {([
            ['RATE', 'vibratoRateHz', 0.5, 12, 0.1, (v: number) => `${v.toFixed(1)}HZ`],
            ['FADE IN', 'vibratoFadeMs', 0, 5000, 50, (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}S` : `${v}MS`)],
            ['FADE FROM', 'vibratoFadeStart', 0, 100, 1, (v: number) => `${v}%`],
            ['CC80 DEPTH', 'vibratoCC80Depth', -127, 127, 1, (v: number) => `${v > 0 ? '+' : ''}${v}`],
            ['CC80 CENTRE', 'vibratoCC80Center', 0, 127, 1, (v: number) => `${v}`],
          ] as const).map(([label, key, min, max, step, fmt]) => (
            <div className="mb-3" key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="label-meta">{label}</span>
                <span className="label-meta !text-[var(--accent)]">{fmt(params[key] as number)}</span>
              </div>
              <CustomSlider min={min} max={max} step={step} value={params[key] as number}
                onChange={(v) => updateParam(key, v)} />
            </div>
          ))}
          <button
            onClick={() => engine?.wiggleCC(80)}
            className="analog-btn w-full !py-2 mb-2"
            title="Send CC80 back and forth so the plugin can learn it"
          >
            SEND CC80 FOR MAPPING
          </button>
          <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
            CC80 RIDES THE SAME LFO, SO TREMOLO STAYS LOCKED TO THE PITCH. HIT
            LEARN IN YOUR SYNTH, PRESS THE BUTTON, THEN SET DEPTH. CENTRE IS
            WHERE THE PARAMETER RESTS BETWEEN NOTES — SENDING CC80 FROM A
            CONTROLLER MOVES IT LIVE. NEGATIVE DEPTH FLIPS THE DIRECTION.
          </p>
        </CollapsibleSection>

        <CollapsibleSection group="velmod" title="VEL CC1" extraHeader={<div
              className={`toggle-switch ${params.velModCC1Enabled ? 'on' : ''}`}
              onClick={() => updateParam('velModCC1Enabled', !params.velModCC1Enabled)}
            ></div>}>
          {([
            ['ANCHOR', 'velModCC1Anchor', 0, 127, 1, (v: number) => `${v}`],
            ['AMOUNT', 'velModCC1Amount', -100, 100, 1, (v: number) => `${v}%`],
            ['ATTACK', 'velModCC1Attack', 0, 100, 1, fmtStage],
            ['RELEASE', 'velModCC1Release', 0, 100, 1, fmtStage],
          ] as const).map(([label, key, min, max, step, fmt]) => (
            <div className="mb-3" key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="label-meta">{label}</span>
                <span className="label-meta !text-[var(--accent)]">{fmt(params[key] as number)}</span>
              </div>
              <CustomSlider min={min} max={max} step={step} value={params[key] as number}
                onChange={(v) => updateParam(key, v)} />
            </div>
          ))}
          <button
            onClick={() => engine?.wiggleCC(1)}
            className="analog-btn w-full !py-2 mb-2"
            title="Send CC1 back and forth so the plugin can learn it"
          >
            SEND CC1 FOR MAPPING
          </button>
          <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
            HIT LEARN IN YOUR SYNTH, PRESS THE BUTTON, THEN SET AMOUNT.
            MOVING THE PHYSICAL MOD WHEEL TAKES OVER THE ANCHOR.
            MOVING THIS SLIDER TAKES IT BACK.
          </p>
        </CollapsibleSection>

        <CollapsibleSection group="velmod" title="VEL CC74" extraHeader={<div
              className={`toggle-switch ${params.velModCC74Enabled ? 'on' : ''}`}
              onClick={() => updateParam('velModCC74Enabled', !params.velModCC74Enabled)}
            ></div>}>
          {([
            ['ANCHOR', 'velModCC74Anchor', 0, 127, 1, (v: number) => `${v}`],
            ['AMOUNT', 'velModCC74Amount', -100, 100, 1, (v: number) => `${v}%`],
            ['ATTACK', 'velModCC74Attack', 0, 100, 1, fmtStage],
            ['RELEASE', 'velModCC74Release', 0, 100, 1, fmtStage],
          ] as const).map(([label, key, min, max, step, fmt]) => (
            <div className="mb-3" key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="label-meta">{label}</span>
                <span className="label-meta !text-[var(--accent)]">{fmt(params[key] as number)}</span>
              </div>
              <CustomSlider min={min} max={max} step={step} value={params[key] as number}
                onChange={(v) => updateParam(key, v)} />
            </div>
          ))}
          <button
            onClick={() => engine?.wiggleCC(74)}
            className="analog-btn w-full !py-2 mb-2"
            title="Send CC74 back and forth so the plugin can learn it"
          >
            SEND CC74 FOR MAPPING
          </button>
          <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
            CC74 IS THE ONE EXPRESSION MPE DEFINES PER NOTE, SO IT IS WHAT CARRIES
            THE PER-VOICE MODULATION. WITH MPE OFF IT GOES OUT ON THE MASTER CHANNEL.
            THE MAPPING SWEEP ALWAYS GOES OUT ON THE MASTER, WHICH IS WHERE A
            PLUGIN LISTENS WHEN IT IS LEARNING.
          </p>
        </CollapsibleSection>

        <div className="mt-5 flex justify-between items-center">
          <span className="label-meta">PER VOICE (MPE)</span>
          <div
            className={`toggle-switch ${params.velModPerVoice ? 'on' : ''}`}
            onClick={() => updateParam('velModPerVoice', !params.velModPerVoice)}
          ></div>
        </div>
        <p className="help-text label-meta !text-[0.6rem] opacity-75 mt-1 leading-relaxed">
          EACH MPE VOICE RUNS ITS OWN VELOCITY ENVELOPE FROM ITS OWN NOTE, SO A
          STRUMMED CHORD MODULATES UNEVENLY ACROSS IT. VIBRATO STAYS ONE SHAPE
          ACROSS THE WHOLE INSTRUMENT EITHER WAY.
        </p>

        <div className="mt-5">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta">CHORD WINDOW</span>
            <span className="label-meta !text-[var(--accent)]">{params.velModChordThresholdMs}MS</span>
          </div>
          <CustomSlider min={0} max={300} step={5} value={params.velModChordThresholdMs}
            onChange={(v) => updateParam('velModChordThresholdMs', v)} />
          <p className="help-text label-meta !text-[0.6rem] opacity-75 mt-1 leading-relaxed">
            NOTES CLOSER TOGETHER THAN THIS COUNT AS ONE CHORD AND DO NOT RETRIGGER.
            KEEP IT ABOVE YOUR STRUM SPEED.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="STRUM ENGINE" extraHeader={<div
            className={`toggle-switch ${params.strumEngine === 1 ? 'on' : ''}`}
            onClick={() => updateParam('strumEngine', params.strumEngine === 1 ? 0 : 1)}
          ></div>}>
        <div className={`transition-opacity duration-300 ${params.strumEngine === 1 ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">SPEED</span>
              <span className="label-meta !text-[var(--accent)]">{params.strumSpeedMs}MS</span>
            </div>
            <CustomSlider
              min={0}
              max={360}
              step={5}
              value={params.strumSpeedMs}
              onChange={(val) => updateParam('strumSpeedMs', val)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              onClick={() => updateParam('strumDirection', 0)}
              className={`analog-btn ${params.strumDirection === 0 ? 'active' : ''}`}
            >
              UP
            </button>
            <button
              onClick={() => updateParam('strumDirection', 1)}
              className={`analog-btn ${params.strumDirection === 1 ? 'active' : ''}`}
            >
              DOWN
            </button>
            <button
              onClick={() => updateParam('strumDirection', 2)}
              className={`analog-btn ${params.strumDirection === 2 ? 'active' : ''}`}
            >
              RND
            </button>
          </div>
          <div className="mt-4">
            <button
              onClick={() => updateParam('strumAlternate', !params.strumAlternate)}
              className={`analog-btn w-full ${params.strumAlternate ? 'active' : ''}`}
            >
              ALTERNATE DIRECTION
            </button>
          </div>
          <div className="mt-4 flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-white/70">Inversion Repeat: {params.inversionRepeat === 0 ? 'OFF' : params.inversionRepeat}</span>
          </div>
          <CustomSlider
            min={0}
            max={8}
            step={1}
            value={params.inversionRepeat}
            onChange={(val) => updateParam('inversionRepeat', val)}
          />
        </div>
      </CollapsibleSection>


      <CollapsibleSection title="VELOCITY ENGINE">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta">HUMAN VELOCITY</span>
            <span className="label-meta !text-[var(--accent)]">{params.velHumanize}</span>
          </div>
          <CustomSlider min={0} max={50} step={1} value={params.velHumanize} onChange={(val) => updateParam('velHumanize', val)} />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta">HIGH REG. PAD</span>
            <span className="label-meta !text-[var(--accent)]">{params.velHighRegisterPad}</span>
          </div>
          <CustomSlider min={0} max={100} step={1} value={params.velHighRegisterPad} onChange={(val) => updateParam('velHighRegisterPad', val)} />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta">GLIDE INVERSION PAD</span>
            <span className="label-meta !text-[var(--accent)]">{params.velGlideInversion}</span>
          </div>
          <CustomSlider min={0} max={50} step={1} value={params.velGlideInversion} onChange={(val) => updateParam('velGlideInversion', val)} />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta">CHORD CHANGE PAD</span>
            <span className="label-meta !text-[var(--accent)]">{params.velGlideChord}</span>
          </div>
          <CustomSlider min={0} max={50} step={1} value={params.velGlideChord} onChange={(val) => updateParam('velGlideChord', val)} />
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="OMNICHORD MODE" extraHeader={<div 
            className={`toggle-switch ${params.omnichordMode ? 'on' : ''}`}
            onClick={() => {
              const newVal = !params.omnichordMode;
              if (newVal) {
                // When turning on Omnichord Mode, force momentary modifiers OFF
                setParams({ ...params, omnichordMode: true, momentaryBase: false, momentaryExt: false });
                if (engine) engine.params = { ...params, omnichordMode: true, momentaryBase: false, momentaryExt: false };
              } else {
                updateParam('omnichordMode', false);
              }
            }}
          ></div>}>
        <div className="flex justify-between items-center mb-6">
          <label className="label-meta flex-1">Split Monitor (Synth / MIDI)</label>
          <div 
            className={`toggle-switch ${params.omnichordSynthMonitor ? 'on' : ''}`}
            onClick={() => updateParam('omnichordSynthMonitor', !params.omnichordSynthMonitor)}
          ></div>
        </div>
      </CollapsibleSection>
    </AccordionContext.Provider>
  );
};
