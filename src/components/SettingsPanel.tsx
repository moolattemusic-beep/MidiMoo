import { CustomSlider } from './CustomSlider';
import React, { useState } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { OrchidParams } from '../types';

interface SettingsPanelProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
}


const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; extraHeader?: React.ReactNode }> = ({ title, children, extraHeader }) => {
  const storageKey = `orchid-collapse-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? saved === 'true' : false; // Default collapsed
  });

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem(storageKey, String(next));
  };

  return (
    <div className="module overflow-hidden">
      <div className="flex justify-between items-center cursor-pointer select-none" onClick={toggle}>
        <p className="label-meta">{title}</p>
        <div className="flex items-center gap-3">
          {extraHeader && <div onClick={(e) => e.stopPropagation()}>{extraHeader}</div>}
          <span className="text-[var(--accent)] opacity-50 text-[10px]">
            {isOpen ? '▲' : '▼'}
          </span>
        </div>
      </div>
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-white/5">
          {children}
        </div>
      )}
    </div>
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ engine, params, setParams }) => {
  
  const updateParam = (key: keyof OrchidParams, value: any) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    if (engine) {
      if (key === 'chordRegisterStart') {
        engine.updateRegister(value);
      } else if (key === 'chordInversion') {
        engine.updateInversion(value);
      } else if (key === 'registerMode' || key === 'chordDensity' || key === 'voicingRange') {
        engine.params = newParams;
        engine.retriggerHeldKeys(true);
      } else {
        engine.params = newParams;
      }
    }
  };

  const keyRoots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
  
  return (
    <>
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
        <div className="mb-6 h-[50px]">
          <div className="fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">CHORD START</span>
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

        <div className="mb-6 h-[50px]">
          <div className="fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">INVERSION</span>
              <span className="label-meta !text-[var(--accent)]">{params.chordInversion}</span>
            </div>
            <CustomSlider
              min={0}
              max={16}
              step={1}
              value={params.chordInversion}
              onChange={(val) => updateParam('chordInversion', val)}
            />
          </div>
        </div>

        <div className="mb-6 h-[50px]">
          <div className="fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">MAX NOTES</span>
              <span className="label-meta !text-[var(--accent)]">{['3', '4', '5', '3-5', '4-6'][params.chordDensity ?? 4]}</span>
            </div>
            <CustomSlider
              min={0}
              max={4}
              step={1}
              value={params.chordDensity ?? 4}
              onChange={(val) => updateParam('chordDensity', val)}
            />
          </div>
        </div>

        
        <div className="mb-6 h-[50px]">
          <div className="fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">VOICING RANGE</span>
              <span className="label-meta !text-[var(--accent)]">{params.voicingRange}</span>
            </div>
            <CustomSlider
              min={12}
              max={36}
              step={1}
              value={params.voicingRange}
              onChange={(val) => updateParam('voicingRange', val)}
            />
          </div>
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
      <div className="module">
        <div className="flex justify-between items-center mb-4">
          <p className="label-meta">MPE GLIDE</p>
          <div 
            className={`toggle-switch ${params.mpeEnabled ? 'on' : ''}`}
            onClick={() => updateParam('mpeEnabled', !params.mpeEnabled)}
          ></div>
        </div>
        
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
          </div>
        )}
      </div>

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
    </>
  );
};
