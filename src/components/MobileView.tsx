import { CustomSlider } from './CustomSlider';
import React from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { OrchidParams } from '../types';
import { MemorySlots, MemorySlot } from './MemorySlots';
import { ModifierPads } from './ModifierPads';
import { PerformanceKeyboard } from './PerformanceKeyboard';
import { ArpeggioXYPad } from './ArpeggioXYPad';

interface MobileViewProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  engineState: any;
  memorySlots: MemorySlot[];
  playingSlotIndex: number | null;
  activeNotes: number[];
  onClose: () => void;
  onPlaySlot: (index: number) => void;
  onStopSlot: (index: number) => void;
  onSaveSlot: (index: number, chord: MemorySlot | null) => void;
  onUpdateSlots: (slots: MemorySlot[]) => void;
  lastPlayedChord: MemorySlot | null;
  onPanic?: () => void;
}

export function MobileView({
  engine,
  params,
  setParams,
  engineState,
  memorySlots,
  playingSlotIndex,
  activeNotes,
  onClose,
  onPlaySlot,
  onStopSlot,
  onSaveSlot,
  onUpdateSlots,
  lastPlayedChord,
  onPanic
}: MobileViewProps) {
  return (
    <div className="fixed inset-0 bg-[#000] z-50 flex flex-col overflow-hidden text-white font-['Space_Mono']">
      <div className="flex justify-between items-center p-2 bg-[var(--wood)] border-b-2 border-black shrink-0">
        <span className="font-bold tracking-widest uppercase text-black text-sm">MOBILE PERFORMANCE</span>
        <div className="flex items-center gap-2">
          {onPanic && (
            <button 
              onClick={onPanic}
              className="px-2 h-8 flex items-center justify-center bg-red-900/80 text-red-100 border border-red-500 rounded-sm text-xs font-bold"
            >
              PANIC
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-black text-[var(--accent)] border border-black rounded-sm">
            X
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col p-2 gap-4 overflow-y-auto min-h-0">
        
        {/* Top row: memory pads */}
        <div className="shrink-0">
          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            playingSlotIndex={playingSlotIndex}
            hideHeader={true}
            onPlaySlot={onPlaySlot}
            onStopSlot={onStopSlot}
            onSaveSlot={onSaveSlot}
            onUpdateSlots={onUpdateSlots}
            lastPlayedChord={lastPlayedChord}
            isEditMode={false}
            onToggleEditMode={() => {}}
            activeEditSlotIndex={null}
            onSelectEditSlot={() => {}}
            memoryVelocity={params.memoryVelocity || 100}
            onMemoryVelocityChange={() => {}}
            isFreeEditMode={false}
            onToggleFreeEditMode={() => {}}
            armedSlotIndex={null}
            onArmSlot={() => {}}
          />
        </div>
        
        {/* Middle row: Base type and extensions */}
        <div className="shrink-0">
          <ModifierPads 
            engine={engine}
            params={params}
            setParams={setParams}
            manualBaseType={engineState.manualBaseType}
            effectiveBaseType={engineState.effectiveBaseType}
            ext_m7={engineState.ext_m7}
            ext_M7={engineState.ext_M7}
            ext_6={engineState.ext_6}
            ext_9={engineState.ext_9}
            ext_alt={engineState.ext_alt}
            hideOctaveSlider={true}
            hideHeader={true}
          />
        </div>
        
        <div className="shrink-0 h-[260px]">
           <ArpeggioXYPad engine={engine} params={params} setParams={setParams} />
        </div>
        
        {/* Bottom row: Keyboard and interval (inversion) slider */}
        <div className="mt-auto shrink-0 flex flex-col gap-2 module bg-[var(--surface-deep)] border border-white/10 p-2 rounded-sm pb-6">
          <div className="flex justify-between items-center px-2">
            <span className="label-meta shrink-0">INVERSION</span>
            <span className="label-meta !text-[var(--accent)]">{params.chordInversion}</span>
          </div>
          
          <div className="flex items-center gap-3 px-2 mb-4">
            <CustomSlider className="flex-1" min={0} max={16} step={1} value={params.chordInversion} onChange={(val) => {
                setParams({...params, chordInversion: val});
                if (engine) engine.updateInversion(val);
              }} />
          </div>

          <div className="flex justify-between items-center mb-1 mt-2">
            <span className="label-meta">PERFORMANCE (1 OCT)</span>
          </div>
          <PerformanceKeyboard 
            engine={engine} 
            params={params} 
            activeNotes={activeNotes} 
            numKeysOverride={13} 
          />
        </div>
        
      </div>
    </div>
  );
}
