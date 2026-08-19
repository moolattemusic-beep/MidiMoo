import re
content = open('src/components/MemorySlots.tsx').read()

# Add useState import
content = content.replace("import React from 'react';", "import React, { useState } from 'react';")

# Interface update
old_interface = """interface MemorySlotsProps {
  engine: OrchidEngine | null;
  slots: MemorySlot[];
  armedSlotIndex: number | null;
  playingSlotIndex: number | null;
  onArmSlot: (index: number) => void;
  onSaveSlot?: (index: number, chord: MemorySlot) => void;
  lastPlayedChord?: MemorySlot | null;
  hideHeader?: boolean;
}"""

new_interface = """interface MemorySlotsProps {
  engine: OrchidEngine | null;
  slots: MemorySlot[];
  playingSlotIndex: number | null;
  onPlaySlot: (index: number) => void;
  onStopSlot: (index: number) => void;
  onSaveSlot: (index: number, chord: MemorySlot | null) => void;
  onUpdateSlots: (slots: MemorySlot[]) => void;
  lastPlayedChord?: MemorySlot | null;
  hideHeader?: boolean;
}"""

content = content.replace(old_interface, new_interface)

# Format slot
old_format = """function formatSlot(slot: MemorySlot, isArmed: boolean, lastPlayedChord?: MemorySlot | null) {
  if (!slot) {
    return (lastPlayedChord && !isArmed) ? "SAVE" : "EMPTY";
  }"""

new_format = """function formatSlot(slot: MemorySlot, isEditMode: boolean, lastPlayedChord?: MemorySlot | null) {
  if (!slot) {
    return (lastPlayedChord && !isEditMode) ? "SAVE" : "EMPTY";
  }"""

content = content.replace(old_format, new_format)

# Component definition and state
old_comp = """export function MemorySlots({ engine, slots, armedSlotIndex, playingSlotIndex, onArmSlot, onSaveSlot, lastPlayedChord, hideHeader }: MemorySlotsProps) {"""

new_comp = """export function MemorySlots({ engine, slots, playingSlotIndex, onPlaySlot, onStopSlot, onSaveSlot, onUpdateSlots, lastPlayedChord, hideHeader }: MemorySlotsProps) {
  const [isEditMode, setIsEditMode] = useState(false);
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
"""

content = content.replace(old_comp, new_comp)

# Render
old_render = """  return (
    <div className="module bg-[var(--surface-deep)] border border-white/10 p-4 rounded-sm flex flex-col gap-3">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <span className="label-meta">CHORD MEMORY (1-8)</span>
          {armedSlotIndex !== null && (
            <span className="text-red-400 font-['Space_Mono'] text-[10px] animate-pulse uppercase">Waiting for chord...</span>
          )}
        </div>
      )}
      {hideHeader && armedSlotIndex !== null && (
        <div className="flex items-center justify-end -mb-2">
          <span className="text-red-400 font-['Space_Mono'] text-[10px] animate-pulse uppercase">Waiting for chord...</span>
        </div>
      )}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {slots.map((slot, i) => {
          const isArmed = armedSlotIndex === i;
          const isPlaying = playingSlotIndex === i;
          return (
            <div key={i} className="flex flex-col gap-1">
              <button
                className={`analog-btn h-12 text-xs flex items-center justify-center font-['Space_Mono'] leading-tight px-1
                  ${isArmed ? '!bg-red-900/50 !border-red-500 !text-red-200' : ''}
                  ${isPlaying && !isArmed ? '!bg-white !text-black !border-[var(--ink)] shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''}
                  ${slot && !isArmed && !isPlaying ? '!bg-[var(--accent)] !text-black !border-[var(--ink)]' : ''}
                `}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (engine && slot && !isArmed) {
                    engine.setModifiers(slot.baseType, slot.ext_m7, slot.ext_M7, slot.ext_6, slot.ext_9);
                    engine.handleMidi(slot.rootPitch, 100, true);
                  } else if (!slot && !isArmed && lastPlayedChord && onSaveSlot) {
                    // Save last played chord to empty slot on click
                    onSaveSlot(i, lastPlayedChord);
                  }
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  if (engine && slot && !isArmed) {
                    engine.handleMidi(slot.rootPitch, 0, false);
                  }
                }}
                onPointerLeave={(e) => {
                  e.preventDefault();
                  if (engine && slot && !isArmed) {
                    engine.handleMidi(slot.rootPitch, 0, false);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault(); // allow right click or long press to not trigger context menu
                }}
              >
                {formatSlot(slot, isArmed, lastPlayedChord)}
              </button>
              <button 
                onClick={() => onArmSlot(i)}
                className={`text-[9px] font-['Space_Mono'] border py-1 rounded-sm uppercase tracking-wider transition-colors
                  ${isArmed ? 'bg-red-500 text-black border-red-500' : 'bg-black text-[#666] border-[#333] hover:text-white hover:border-[#666]'}
                `}
              >
                {isArmed ? 'ARMED' : (lastPlayedChord ? 'SAVE' : 'ARM')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );"""

new_render = """  return (
    <div className="module bg-[var(--surface-deep)] border border-white/10 p-4 rounded-sm flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        {!hideHeader && <span className="label-meta">CHORD MEMORY (1-8)</span>}
        {hideHeader && <span />}
        <button 
          onClick={() => setIsEditMode(!isEditMode)}
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
                  ${isPlaying && !isEditMode ? '!bg-white !text-black !border-[var(--ink)] shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''}
                  ${slot && !isPlaying && !isEditMode ? '!bg-[var(--accent)] !text-black !border-[var(--ink)]' : ''}
                  ${isEditMode ? '!bg-[#222] !border-[#444] !text-[#888]' : ''}
                  ${isEditMode && draggedIndex === i ? 'opacity-50' : ''}
                `}
                onPointerDown={(e) => {
                  if (isEditMode) return;
                  e.preventDefault();
                  if (engine && slot) {
                    engine.setModifiers(slot.baseType, slot.ext_m7, slot.ext_M7, slot.ext_6, slot.ext_9);
                    engine.handleMidi(slot.rootPitch, 100, true);
                    onPlaySlot(i);
                  } else if (!slot && lastPlayedChord) {
                    onSaveSlot(i, lastPlayedChord);
                  }
                }}
                onPointerUp={(e) => {
                  if (isEditMode) return;
                  e.preventDefault();
                  if (engine && slot) {
                    engine.handleMidi(slot.rootPitch, 0, false);
                    onStopSlot(i);
                  }
                }}
                onPointerLeave={(e) => {
                  if (isEditMode) return;
                  e.preventDefault();
                  if (engine && slot) {
                    engine.handleMidi(slot.rootPitch, 0, false);
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
                  onClick={() => onSaveSlot(i, null)}
                  title="Clear slot"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );"""

content = content.replace(old_render, new_render)
open('src/components/MemorySlots.tsx', 'w').write(content)

