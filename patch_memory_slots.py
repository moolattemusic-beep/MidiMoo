import re

content = open('src/components/MemorySlots.tsx').read()

# Update props interface
props_old = """interface MemorySlotsProps {
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
props_new = """interface MemorySlotsProps {
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
}"""
content = content.replace(props_old, props_new)

# Update function signature
func_old = """export function MemorySlots({ engine, slots, playingSlotIndex, onPlaySlot, onStopSlot, onSaveSlot, onUpdateSlots, lastPlayedChord, hideHeader }: MemorySlotsProps) {
  const [isEditMode, setIsEditMode] = useState(false);"""
func_new = """export function MemorySlots({ engine, slots, playingSlotIndex, onPlaySlot, onStopSlot, onSaveSlot, onUpdateSlots, lastPlayedChord, hideHeader, isEditMode, onToggleEditMode, activeEditSlotIndex, onSelectEditSlot }: MemorySlotsProps) {"""
content = content.replace(func_old, func_new)

# Update toggle button
btn_old = """        <button 
          onClick={() => setIsEditMode(!isEditMode)}"""
btn_new = """        <button 
          onClick={onToggleEditMode}"""
content = content.replace(btn_old, btn_new)

# Update pad classes for activeEditSlotIndex
class_old = """                  ${isEditMode ? '!bg-[#222] !border-[#444] !text-[#888]' : ''}
                  ${isEditMode && draggedIndex === i ? 'opacity-50' : ''}
                `}
                onPointerDown={(e) => {
                  if (isEditMode) return;"""
class_new = """                  ${isEditMode && activeEditSlotIndex !== i ? '!bg-[#222] !border-[#444] !text-[#888]' : ''}
                  ${isEditMode && activeEditSlotIndex === i ? '!bg-white !text-black shadow-[0_0_15px_rgba(255,255,255,0.8)]' : ''}
                  ${isEditMode && draggedIndex === i ? 'opacity-50' : ''}
                `}
                onPointerDown={(e) => {
                  if (isEditMode) {
                     onSelectEditSlot(i);
                     return;
                  }"""
content = content.replace(class_old, class_new)

open('src/components/MemorySlots.tsx', 'w').write(content)
print("Patched MemorySlots")
