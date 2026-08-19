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
  onArmSlot: (index: number) => void;
  onSaveSlot: (index: number, chord: MemorySlot) => void;
  lastPlayedChord: MemorySlot | null;
}"""

new_interface = """interface MobileViewProps {
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
  onClose,
  onArmSlot,
  onSaveSlot,
  lastPlayedChord
}: MobileViewProps) {"""

new_args = """export function MobileView({
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
  lastPlayedChord
}: MobileViewProps) {"""

content = content.replace(old_args, new_args)

old_mem = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            armedSlotIndex={armedSlotIndex}
            playingSlotIndex={playingSlotIndex}
            hideHeader={true}
            onArmSlot={onArmSlot}
            onSaveSlot={onSaveSlot}
            lastPlayedChord={lastPlayedChord}
          />"""

new_mem = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            playingSlotIndex={playingSlotIndex}
            hideHeader={true}
            onPlaySlot={onPlaySlot}
            onStopSlot={onStopSlot}
            onSaveSlot={onSaveSlot}
            onUpdateSlots={onUpdateSlots}
            lastPlayedChord={lastPlayedChord}
          />"""

content = content.replace(old_mem, new_mem)

open('src/components/MobileView.tsx', 'w').write(content)
