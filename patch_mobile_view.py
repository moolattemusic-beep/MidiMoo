import re
content = open('src/components/MobileView.tsx').read()

# Props
old_interface = """interface MobileViewProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  engineState: any;
  memorySlots: MemorySlot[];
  armedSlotIndex: number | null;
  playingSlotIndex: number | null;
  setArmedSlotIndex: (index: number | null) => void;
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
  onArmSlot: (index: number) => void;
  onSaveSlot: (index: number, chord: MemorySlot) => void;
  lastPlayedChord: MemorySlot | null;
}"""

content = content.replace(old_interface, new_interface)

# Destructuring
content = content.replace(
    "export const MobileView: React.FC<MobileViewProps> = ({ engine, params, setParams, engineState, memorySlots, armedSlotIndex, playingSlotIndex, setArmedSlotIndex }) => {",
    "export const MobileView: React.FC<MobileViewProps> = ({ engine, params, setParams, engineState, memorySlots, armedSlotIndex, playingSlotIndex, setArmedSlotIndex, onArmSlot, onSaveSlot, lastPlayedChord }) => {"
)

# MemorySlots usage
old_mem = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            armedSlotIndex={armedSlotIndex}
            playingSlotIndex={playingSlotIndex}
            hideHeader={true}
            onArmSlot={(index) => setArmedSlotIndex(armedSlotIndex === index ? null : index)}
          />"""

new_mem = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            armedSlotIndex={armedSlotIndex}
            playingSlotIndex={playingSlotIndex}
            hideHeader={true}
            onArmSlot={onArmSlot}
            onSaveSlot={onSaveSlot}
            lastPlayedChord={lastPlayedChord}
          />"""

content = content.replace(old_mem, new_mem)

open('src/components/MobileView.tsx', 'w').write(content)

# Now patch App.tsx to pass these props
app_content = open('src/App.tsx').read()

old_app_mobile = """        <MobileView 
          engine={engine}
          params={params}
          setParams={setParams}
          engineState={engineState}
          memorySlots={memorySlots}
          armedSlotIndex={armedSlotIndex}
          playingSlotIndex={playingSlotIndex}
          setArmedSlotIndex={setArmedSlotIndex}
        />"""

new_app_mobile = """        <MobileView 
          engine={engine}
          params={params}
          setParams={setParams}
          engineState={engineState}
          memorySlots={memorySlots}
          armedSlotIndex={armedSlotIndex}
          playingSlotIndex={playingSlotIndex}
          setArmedSlotIndex={setArmedSlotIndex}
          onArmSlot={(index) => {
            setArmedSlotIndex(prev => prev === index ? null : index);
            if (lastPlayedChord && armedSlotIndex !== index) {
              setMemorySlots(prev => {
                const next = [...prev];
                next[index] = lastPlayedChord;
                return next;
              });
            }
          }}
          onSaveSlot={(index, chord) => {
            setMemorySlots(prev => {
              const next = [...prev];
              next[index] = chord;
              return next;
            });
          }}
          lastPlayedChord={lastPlayedChord}
        />"""

app_content = app_content.replace(old_app_mobile, new_app_mobile)
open('src/App.tsx', 'w').write(app_content)
