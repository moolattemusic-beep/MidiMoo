import re
content = open('src/components/MobileView.tsx').read()

old_interface = """interface MobileViewProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  engineState: any;
  memorySlots: MemorySlot[];
  armedSlotIndex: number | null;
  playingSlotIndex: number | null;
  setArmedSlotIndex: (index: number | null) => void;
  activeNotes: number[];
  onClose: () => void;
}"""

new_interface = """interface MobileViewProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  engineState: any;
  memorySlots: MemorySlot[];
  armedSlotIndex: number | null;
  playingSlotIndex: number | null;
  setArmedSlotIndex: (index: number | null) => void;
  activeNotes: number[];
  onClose: () => void;
  onArmSlot: (index: number) => void;
  onSaveSlot: (index: number, chord: MemorySlot) => void;
  lastPlayedChord: MemorySlot | null;
}"""

content = content.replace(old_interface, new_interface)

old_args = """export function MobileView({
  engine,
  params,
  setParams,
  engineState,
  memorySlots,
  armedSlotIndex,
  playingSlotIndex,
  setArmedSlotIndex,
  activeNotes,
  onClose
}: MobileViewProps) {"""

new_args = """export function MobileView({
  engine,
  params,
  setParams,
  engineState,
  memorySlots,
  armedSlotIndex,
  playingSlotIndex,
  setArmedSlotIndex,
  activeNotes,
  onClose,
  onArmSlot,
  onSaveSlot,
  lastPlayedChord
}: MobileViewProps) {"""

content = content.replace(old_args, new_args)
open('src/components/MobileView.tsx', 'w').write(content)

