import re

content = open('src/components/MobileView.tsx').read()

old_mem = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            playingSlotIndex={playingSlotIndex}
            hideHeader={true}
            onPlaySlot={(index) => {
              setPlayingSlotIndex(index);
              setLastPlayedChord(memorySlots[index]);
            }}
            onStopSlot={(index) => {
              setPlayingSlotIndex(prev => prev === index ? null : prev);
            }}
            onSaveSlot={(index, chord) => {
              setMemorySlots(prev => {
                const next = [...prev];
                next[index] = chord;
                return next;
              });
            }}
            onUpdateSlots={setMemorySlots}
            lastPlayedChord={lastPlayedChord}
          />"""

new_mem = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            playingSlotIndex={playingSlotIndex}
            hideHeader={true}
            onPlaySlot={(index) => {
              setPlayingSlotIndex(index);
              setLastPlayedChord(memorySlots[index]);
            }}
            onStopSlot={(index) => {
              setPlayingSlotIndex(prev => prev === index ? null : prev);
            }}
            onSaveSlot={(index, chord) => {
              setMemorySlots(prev => {
                const next = [...prev];
                next[index] = chord;
                return next;
              });
            }}
            onUpdateSlots={setMemorySlots}
            lastPlayedChord={lastPlayedChord}
            isEditMode={false}
            onToggleEditMode={() => {}}
            activeEditSlotIndex={null}
            onSelectEditSlot={() => {}}
          />"""

content = content.replace(old_mem, new_mem)

open('src/components/MobileView.tsx', 'w').write(content)
print("Patched MobileView.tsx")
