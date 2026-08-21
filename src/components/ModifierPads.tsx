import { CustomSlider } from './CustomSlider';
import React, { useEffect } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { OrchidParams } from '../types';

interface ModifierPadsProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  // Passing these so the component re-renders when state changes in parent
  manualBaseType: number;
  effectiveBaseType?: number;
  ext_m7: boolean;
  ext_M7: boolean;
  ext_6: boolean;
  ext_9: boolean;
  ext_alt: boolean;
  hideOctaveSlider?: boolean;
  hideHeader?: boolean;
  onBaseTypeChange?: (val: number) => void;
  onExtensionToggle?: (extId: string) => void;
}

export const ModifierPads: React.FC<ModifierPadsProps> = ({
  engine,
  params,
  setParams,
  manualBaseType,
  effectiveBaseType,
  ext_m7,
  ext_M7,
  ext_6,
  ext_9,
  ext_alt,
  hideOctaveSlider,
  hideHeader,
  onBaseTypeChange,
  onExtensionToggle
}) => {
  
  const isMomentaryBase = hideHeader ? false : params.momentaryBase;
  const isMomentaryExt = hideHeader ? false : params.momentaryExt;

  const updateParam = (key: keyof OrchidParams, value: any) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    if (engine) engine.params = newParams;
  };

  useEffect(() => {
    if (!engine) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.repeat) return;
      
      const key = e.key.toLowerCase();
      switch (key) {
        case 'q': e.preventDefault(); if (isMomentaryBase) engine.setBaseType(0); else engine.setBaseType(engine.manualBaseType === 0 ? -1 : 0); break;
        case 'w': e.preventDefault(); if (isMomentaryBase) engine.setBaseType(1); else engine.setBaseType(engine.manualBaseType === 1 ? -1 : 1); break;
        case 'e': e.preventDefault(); if (isMomentaryBase) engine.setBaseType(2); else engine.setBaseType(engine.manualBaseType === 2 ? -1 : 2); break;
        case 'r': e.preventDefault(); if (isMomentaryBase) engine.setBaseType(3); else engine.setBaseType(engine.manualBaseType === 3 ? -1 : 3); break;
        case 'a': e.preventDefault(); if (isMomentaryExt) { if (!engine.ext_m7) engine.toggleExtension('m7'); } else engine.toggleExtension('m7'); break;
        case 's': e.preventDefault(); if (isMomentaryExt) { if (!engine.ext_M7) engine.toggleExtension('M7'); } else engine.toggleExtension('M7'); break;
        case 'd': e.preventDefault(); if (isMomentaryExt) { if (!engine.ext_6) engine.toggleExtension('6'); } else engine.toggleExtension('6'); break;
        case 'f': e.preventDefault(); if (isMomentaryExt) { if (!engine.ext_9) engine.toggleExtension('9'); } else engine.toggleExtension('9'); break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      
      if (isMomentaryBase) {
        switch (key) {
          case 'q': engine.releaseBaseType(0); break;
          case 'w': engine.releaseBaseType(1); break;
          case 'e': engine.releaseBaseType(2); break;
          case 'r': engine.releaseBaseType(3); break;
        }
      }
      
      if (isMomentaryExt) {
        switch (key) {
          case 'a': engine.releaseExtension('m7'); break;
          case 's': engine.releaseExtension('M7'); break;
          case 'd': engine.releaseExtension('6'); break;
          case 'f': engine.releaseExtension('9'); break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [engine, isMomentaryBase, isMomentaryExt]);

  if (!engine) return null;

  const baseTypes = [
    { label: 'MAJOR', hotkey: '[Q]', val: 0 },
    { label: 'MINOR', hotkey: '[W]', val: 1 },
    { label: 'SUS', hotkey: '[E]', val: 2 },
    { label: ext_alt ? 'DOM' : 'DIM', hotkey: '[R]', val: 3 }
  ];
  
  const activeBaseType = effectiveBaseType ?? manualBaseType;
  const isDominant = ext_alt && activeBaseType === 3;

  return (
    <div className="pad-wrap module h-full flex flex-col">
      {!hideHeader && (
        <div className="flex justify-between items-center gap-2 mb-4 min-w-0">
          <p className="label-meta truncate">Chord Modifiers</p>
          <button
            onPointerDown={(e) => { 
              e.preventDefault(); 
              engine.toggleExtension('alt' as any);
            }}
            className={`analog-btn !py-[2px] !px-2 ${ext_alt ? '!bg-[var(--accent)] !text-black' : ''}`}
          >
            ALT
          </button>
        </div>
      )}
      


      <div className="flex justify-between items-center gap-2 mb-2 mt-2 min-w-0">
        <p className="label-meta">BASE TYPE</p>
        {!hideHeader && (
          <div className="flex items-center gap-2">
            <span className="momentary-label label-meta text-[10px]">MOMENTARY</span>
            <div 
              className={`toggle-switch shrink-0 ${params.momentaryBase ? 'on' : ''}`}
              onClick={() => updateParam('momentaryBase', !params.momentaryBase)}
            ></div>
          </div>
        )}
      </div>
      
      <div className="mb-6">
        <div className="pad-grid grid grid-cols-4 gap-4">
        {baseTypes.map((type) => {
          const isActive = activeBaseType === type.val;
          return (
            <button
              key={type.label}
              onPointerDown={(e) => {
                e.preventDefault();
                if (onBaseTypeChange) {
                   onBaseTypeChange(type.val);
                   return;
                }
                if (isMomentaryBase) {
                  engine.setBaseType(type.val);
                } else {
                  engine.setBaseType(isActive ? -1 : type.val);
                }
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                if (isMomentaryBase) engine.releaseBaseType(type.val);
              }}
              onPointerLeave={(e) => {
                e.preventDefault();
                if (isMomentaryBase) engine.releaseBaseType(type.val);
              }}
              className={`
                h-20 bg-[#1e1e1a] border-[3px] border-[#111] flex flex-col items-center justify-center rounded-sm relative cursor-pointer select-none touch-none
                ${isActive ? 'border-[var(--accent)] shadow-[0_0_15px_rgba(240,160,32,0.2)]' : 'hover:border-[#333]'}
              `}
            >
              <span className="pad-label font-['Oswald'] text-[var(--accent)] pointer-events-none">{type.label}</span>
              <span className="pad-hotkey absolute bottom-1 right-2 font-['Space_Mono'] text-[#555] pointer-events-none">{type.hotkey}</span>
            </button>
          );
        })}
        </div>
      </div>

      <div className="flex justify-between items-center gap-2 mb-2 mt-2 min-w-0">
        <p className="label-meta">EXTENSIONS</p>
        {!hideHeader && (
          <div className="flex items-center gap-2">
            <span className="momentary-label label-meta text-[10px]">MOMENTARY</span>
            <div 
              className={`toggle-switch shrink-0 ${params.momentaryExt ? 'on' : ''}`}
              onClick={() => updateParam('momentaryExt', !params.momentaryExt)}
            ></div>
          </div>
        )}
      </div>
      
      <div>
        <div className="pad-grid grid grid-cols-4 gap-4">
        {(isDominant ? [
          { id: 'm7', label: 'b9', hotkey: '[A]', active: ext_m7 },
          { id: 'M7', label: '#9', hotkey: '[S]', active: ext_M7 },
          { id: '6', label: 'b13', hotkey: '[D]', active: ext_6 },
          { id: '9', label: '#13', hotkey: '[F]', active: ext_9 }
        ] : [
          { id: 'M7', label: 'M7', hotkey: '[A]', active: ext_M7 },
          { id: 'm7', label: 'm7', hotkey: '[S]', active: ext_m7 },
          { id: '6', label: '6', hotkey: '[D]', active: ext_6 },
          { id: '9', label: '9', hotkey: '[F]', active: ext_9 }
        ]).map((ext) => (
          <button
            key={ext.id}
            onPointerDown={(e) => {
              e.preventDefault();
              if (onExtensionToggle) {
                 onExtensionToggle(ext.id);
                 return;
              }
              const momentary = isDominant ? false : isMomentaryExt;
              if (momentary) {
                if (!ext.active) engine.toggleExtension(ext.id as any);
              } else {
                engine.toggleExtension(ext.id as any);
              }
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              const momentary = isDominant ? false : isMomentaryExt;
              if (momentary && ext.active) engine.toggleExtension(ext.id as any);
            }}
            onPointerLeave={(e) => {
              e.preventDefault();
              const momentary = isDominant ? false : isMomentaryExt;
              if (momentary && ext.active) engine.toggleExtension(ext.id as any);
            }}
            className={`
              h-[60px] bg-[#1e1e1a] border-[3px] border-[#111] flex flex-col items-center justify-center rounded-sm relative cursor-pointer select-none touch-none
              ${ext.active ? 'border-[var(--accent)] shadow-[0_0_15px_rgba(240,160,32,0.2)]' : 'hover:border-[#333]'}
            `}
          >
            <span className="pad-label font-['Oswald'] text-[var(--accent)] pointer-events-none">{ext.label}</span>
            <span className="pad-hotkey absolute bottom-1 right-2 font-['Space_Mono'] text-[#555] pointer-events-none">{ext.hotkey}</span>
          </button>
        ))}
        </div>
      </div>
    </div>
  );
};
