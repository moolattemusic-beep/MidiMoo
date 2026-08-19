import re
content = open('src/components/MemorySlots.tsx').read()

old_interface = """interface MemorySlotsProps {
  engine: OrchidEngine | null;
  slots: MemorySlot[];
  armedSlotIndex: number | null;
  playingSlotIndex: number | null;
  onArmSlot: (index: number) => void;
  hideHeader?: boolean;
}"""

new_interface = """interface MemorySlotsProps {
  engine: OrchidEngine | null;
  slots: MemorySlot[];
  armedSlotIndex: number | null;
  playingSlotIndex: number | null;
  onArmSlot: (index: number) => void;
  onSaveSlot?: (index: number, chord: MemorySlot) => void;
  lastPlayedChord?: MemorySlot | null;
  hideHeader?: boolean;
}"""

content = content.replace(old_interface, new_interface)

content = content.replace("export function MemorySlots({ engine, slots, armedSlotIndex, playingSlotIndex, onArmSlot, hideHeader }: MemorySlotsProps) {", "export function MemorySlots({ engine, slots, armedSlotIndex, playingSlotIndex, onArmSlot, onSaveSlot, lastPlayedChord, hideHeader }: MemorySlotsProps) {")

old_button_down = """                onPointerDown={(e) => {
                  e.preventDefault();
                  if (engine && slot && !isArmed) {
                    engine.setModifiers(slot.baseType, slot.ext_m7, slot.ext_M7, slot.ext_6, slot.ext_9);
                    engine.handleMidi(slot.rootPitch, 100, true);
                  }
                }}"""

new_button_down = """                onPointerDown={(e) => {
                  e.preventDefault();
                  if (engine && slot && !isArmed) {
                    engine.setModifiers(slot.baseType, slot.ext_m7, slot.ext_M7, slot.ext_6, slot.ext_9);
                    engine.handleMidi(slot.rootPitch, 100, true);
                  } else if (!slot && !isArmed && lastPlayedChord && onSaveSlot) {
                    // Save last played chord to empty slot on click
                    onSaveSlot(i, lastPlayedChord);
                  }
                }}"""

content = content.replace(old_button_down, new_button_down)

old_format = """function formatSlot(slot: MemorySlot) {
  if (!slot) return "EMPTY";"""

new_format = """function formatSlot(slot: MemorySlot, isArmed: boolean, lastPlayedChord?: MemorySlot | null) {
  if (!slot) {
    return (lastPlayedChord && !isArmed) ? "SAVE" : "EMPTY";
  }"""

content = content.replace(old_format, new_format)

content = content.replace("{formatSlot(slot)}", "{formatSlot(slot, isArmed, lastPlayedChord)}")

open('src/components/MemorySlots.tsx', 'w').write(content)
