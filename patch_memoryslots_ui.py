import re
content = open('src/components/MemorySlots.tsx').read()

header_old = """      <div className="flex items-center justify-between mb-1">
        {!hideHeader && <span className="label-meta">CHORD MEMORY (1-8)</span>}
        {hideHeader && <span />}
        <button 
          onClick={onToggleEditMode}"""

header_new = """      <div className="flex items-center justify-between mb-1">
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
          onClick={onToggleEditMode}"""

content = content.replace(header_old, header_new)

# Add ARM buttons to slots when in free edit mode
slot_old = """              {isEditMode && slot && (
                <button 
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-black shadow-md border border-black z-10"
                  onClick={() => onSaveSlot(i, null)}
                  title="Clear slot"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>"""

slot_new = """              {isEditMode && slot && (
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
            </div>"""

content = content.replace(slot_old, slot_new)

# Update formatSlot
format_old = """function formatSlot(slot: MemorySlot, isEditMode: boolean, lastPlayedChord?: MemorySlot | null) {
  if (!slot) {
    return (lastPlayedChord && !isEditMode) ? "SAVE" : "EMPTY";
  }
  const note = NOTE_NAMES[slot.rootPitch % 12];
  const base = slot.baseType >= 0 ? BASE_NAMES[slot.baseType] : "MAJ";"""

format_new = """function formatSlot(slot: MemorySlot, isEditMode: boolean, lastPlayedChord?: MemorySlot | null) {
  if (!slot) {
    return (lastPlayedChord && !isEditMode) ? "SAVE" : "EMPTY";
  }
  
  if (slot.customVoicing && slot.customVoicing.length > 0) {
     const sorted = [...slot.customVoicing].sort((a,b) => a-b);
     const root = NOTE_NAMES[sorted[0] % 12];
     return `${root} CUST`;
  }
  
  const note = NOTE_NAMES[slot.rootPitch % 12];
  const base = slot.baseType >= 0 ? BASE_NAMES[slot.baseType] : "MAJ";"""

content = content.replace(format_old, format_new)

# Allow highlighting even in edit mode
# The user asked: "when I trigger a memory pad with my midi controller. hightlight it, even if I'm in editing mode. "
# The previous highlight condition:
# `${isPlaying && !isEditMode ? '!bg-white !text-black !border-[var(--ink)] shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''}`
# Let's change this in the code.
class_old = """                  ${isPlaying && !isEditMode ? '!bg-white !text-black !border-[var(--ink)] shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''}
                  ${slot && !isPlaying && !isEditMode ? '!bg-[var(--accent)] !text-black !border-[var(--ink)]' : ''}
                  ${isEditMode && activeEditSlotIndex !== i ? '!bg-[#222] !border-[#444] !text-[#888]' : ''}"""

class_new = """                  ${isPlaying ? '!bg-white !text-black !border-[var(--ink)] shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''}
                  ${slot && !isPlaying && !isEditMode ? '!bg-[var(--accent)] !text-black !border-[var(--ink)]' : ''}
                  ${isEditMode && !isPlaying && activeEditSlotIndex !== i ? '!bg-[#222] !border-[#444] !text-[#888]' : ''}"""

content = content.replace(class_old, class_new)

open('src/components/MemorySlots.tsx', 'w').write(content)
print("Updated MemorySlots layout")
