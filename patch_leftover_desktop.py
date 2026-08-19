import re
content = open('src/App.tsx').read()

old_mem = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
                        playingSlotIndex={playingSlotIndex}
            onArmSlot={(index) => {
              if (lastPlayedChord) {
                // Instantly save, DO NOT arm, to prevent accidental overwrites
                setMemorySlots(prev => {
                  const next = [...prev];
                  next[index] = lastPlayedChord;
                  return next;
                });
                setArmedSlotIndex(null);
              } else {
                setArmedSlotIndex(prev => prev === index ? null : index);
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

new_mem = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            playingSlotIndex={playingSlotIndex}
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

content = content.replace(old_mem, new_mem)

open('src/App.tsx', 'w').write(content)
