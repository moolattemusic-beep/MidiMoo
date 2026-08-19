import re
content = open('src/components/MemorySlots.tsx').read()
content = content.replace(
    'ext_9: boolean;\n} | null;',
    'ext_9: boolean;\n  customVoicing?: number[];\n} | null;'
)
# We also need to add memoryVelocity prop
content = content.replace(
    'onSelectEditSlot: (index: number) => void;\n}',
    'onSelectEditSlot: (index: number) => void;\n  memoryVelocity: number;\n  onMemoryVelocityChange: (vel: number) => void;\n  isFreeEditMode: boolean;\n  onToggleFreeEditMode: () => void;\n  armedSlotIndex: number | null;\n  onArmSlot: (index: number) => void;\n}'
)

func_old = "export function MemorySlots({ engine, slots, playingSlotIndex, onPlaySlot, onStopSlot, onSaveSlot, onUpdateSlots, lastPlayedChord, hideHeader, isEditMode, onToggleEditMode, activeEditSlotIndex, onSelectEditSlot }: MemorySlotsProps) {"
func_new = "export function MemorySlots({ engine, slots, playingSlotIndex, onPlaySlot, onStopSlot, onSaveSlot, onUpdateSlots, lastPlayedChord, hideHeader, isEditMode, onToggleEditMode, activeEditSlotIndex, onSelectEditSlot, memoryVelocity, onMemoryVelocityChange, isFreeEditMode, onToggleFreeEditMode, armedSlotIndex, onArmSlot }: MemorySlotsProps) {"
content = content.replace(func_old, func_new)

open('src/components/MemorySlots.tsx', 'w').write(content)
