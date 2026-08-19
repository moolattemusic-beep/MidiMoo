import React, { useState } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';

export type MemorySlot = {
  rootPitch: number;
  baseType: number;
  ext_m7: boolean;
  ext_M7: boolean;
  ext_6: boolean;
  ext_9: boolean;
  customVoicing?: number[];
} | null;

interface MemorySlotsProps {
  engine: OrchidEngine | null;
  slots: MemorySlot[];
  playingSlotIndex: number | null;
  onPlaySlot: (index: number) => void;
  onStopSlot: (index: number) => void;
  onSaveSlot: (index: number, chord: MemorySlot | null) => void;
  onUpdateSlots: (slots: MemorySlot[]) => void;
  lastPlayedChord?: MemorySlot | null;
  hideHeader?: boolean;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  activeEditSlotIndex: number | null;
  onSelectEditSlot: (index: number) => void;
  memoryVelocity: number;
  onMemoryVelocityChange: (vel: number) => void;
  isFreeEditMode: boolean;
  onToggleFreeEditMode: () => void;
  armedSlotIndex: number | null;
  onArmSlot: (index: number) => void;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BASE_NAMES = ["MAJ", "MIN", "SUS/Q", "DIM"];

function formatSlot(slot: MemorySlot, isEditMode: boolean, lastPlayedChord?: MemorySlot | null) {
  if (!slot) {
    return (lastPlayedChord && !isEditMode) ? "SAVE" : "EMPTY";
  }
  
  if (slot.customVoicing && slot.customVoicing.length > 0) {
     const sorted = [...slot.customVoicing].sort((a,b) => a-b);
     const root = NOTE_NAMES[sorted[0] % 12];
     return `${root} CUST`;
  }
  
  const note = NOTE_NAMES[slot.rootPitch % 12];
  const base = slot.baseType >= 0 ? BASE_NAMES[slot.baseType] : "MAJ";
  
  let exts = "";
  if (slot.ext_m7) exts += " m7";
  if (slot.ext_M7) exts += " M7";
  if (slot.ext_6) exts += " 6";
  if (slot.ext_9) exts += " 9";
  
  return `${note} ${base}${exts}`;
}

export function MemorySlots({ engine, slots, playingSlotIndex, onPlaySlot, onStopSlot, onSaveSlot, onUpdateSlots, lastPlayedChord, hideHeader, isEditMode, onToggleEditMode, activeEditSlotIndex, onSelectEditSlot, memoryVelocity, onMemoryVelocityChange, isFreeEditMode, onToggleFreeEditMode, armedSlotIndex, onArmSlot }: MemorySlotsProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    
    const newSlots = [...slots];
    const item = newSlots[draggedIndex];
    newSlots.splice(draggedIndex, 1);
    newSlots.splice(targetIndex, 0, item);
    onUpdateSlots(newSlots);
    setDraggedIndex(null);
  };

  return (
    <div className="module bg-[var(--surface-deep)] border border-white/10 p-4 rounded-sm flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        {!hideHeader && (
          <div className="flex items-center gap-4">
             <span className="label-meta">CHORD MEMORY (1-8)</span>
             <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#888]">VEL</span>
                <input 
                  type="range" min="1" max="127" 
                  value={memoryVelocity}
                  onChange={(e) => onMemoryVelocityChange(parseInt(e.target.value))}
                  className="w-16 h-1 accent-[var(--accent)]"
                />
             </div>
             {isEditMode && (
                <div className="flex items-center gap-2 ml-4">
                   <span className="label-meta text-[10px]">FREE EDIT</span>
                   <div 
                      className={`toggle-switch ${isFreeEditMode ? 'on' : ''}`}
                      onClick={onToggleFreeEditMode}
                   ></div>
                </div>
             )}
          </div>
        )}
        {hideHeader && <span />}
        <button 
          onClick={onToggleEditMode}
          className={`flex items-center justify-center w-6 h-6 rounded-sm border transition-colors ${isEditMode ? 'bg-[var(--accent)] border-[var(--accent)] text-black' : 'bg-transparent border-[#444] text-[#888] hover:text-white hover:border-white'}`}
          title="Edit Memory Slots (Drag to reorder, click X to clear)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
        </button>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {slots.map((slot, i) => {
          const isPlaying = playingSlotIndex === i;
          return (
            <div 
              key={i} 
              className={`relative flex flex-col gap-1 ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
            >
              <button
                className={`analog-btn h-12 text-xs flex items-center justify-center font-['Space_Mono'] leading-tight px-1
                  ${isPlaying ? '!bg-white !text-black !border-[var(--ink)] shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''}
                  ${slot && !isPlaying && !isEditMode ? '!bg-[var(--accent)] !text-black !border-[var(--ink)]' : ''}
                  ${isEditMode && !isPlaying && activeEditSlotIndex !== i ? '!bg-[#222] !border-[#444] !text-[#888]' : ''}
                  ${isEditMode && activeEditSlotIndex === i ? '!bg-white !text-black shadow-[0_0_15px_rgba(255,255,255,0.8)]' : ''}
                  ${isEditMode && draggedIndex === i ? 'opacity-50' : ''}
                `}
                onPointerDown={(e) => {
                  if (isEditMode) {
                     onSelectEditSlot(i);
                     return;
                  }
                  e.preventDefault();
                  if (engine && slot) {
                    engine.setModifiers(slot.baseType, slot.ext_m7, slot.ext_M7, slot.ext_6, slot.ext_9);
                    engine.handleMidi(slot.rootPitch, memoryVelocity, true, false, false, false, true, slot.customVoicing);
                    onPlaySlot(i);
                  } else if (!slot && lastPlayedChord) {
                    onSaveSlot(i, lastPlayedChord);
                  }
                }}
                onPointerUp={(e) => {
                  if (isEditMode) return;
                  e.preventDefault();
                  if (engine && slot) {
                    engine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, slot.customVoicing);
                    onStopSlot(i);
                  }
                }}
                onPointerLeave={(e) => {
                  if (isEditMode) return;
                  e.preventDefault();
                  if (engine && slot) {
                    engine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, slot.customVoicing);
                    onStopSlot(i);
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {formatSlot(slot, isEditMode, lastPlayedChord)}
              </button>
              
              {isEditMode && slot && (
                <button 
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-black shadow-md border border-black z-10"
                  onClick={(e) => { e.stopPropagation(); onSaveSlot(i, null); }}
                  title="Clear slot"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
              {isEditMode && isFreeEditMode && (
                 <button
                    className={`mt-1 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center transition-colors border ${armedSlotIndex === i ? 'bg-red-500 border-red-400 text-black shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-[#222] border-[#444] text-[#888] hover:text-white'}`}
                    onClick={(e) => { e.stopPropagation(); onArmSlot(i); }}
                 >
                    {armedSlotIndex === i ? 'ARMED' : 'ARM'}
                 </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
