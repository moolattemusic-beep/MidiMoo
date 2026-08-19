import re
content = open('src/App.tsx').read()

old_mobile = """        <MobileView 
          engine={engine}
          params={params}
          setParams={setParams}
          engineState={engineState}
          memorySlots={memorySlots}
          armedSlotIndex={armedSlotIndex}
          playingSlotIndex={playingSlotIndex}
          setArmedSlotIndex={setArmedSlotIndex}
          activeNotes={physicallyHeldNotes}
          onClose={() => setShowMobileView(false)}
        />"""

new_mobile = """        <MobileView 
          engine={engine}
          params={params}
          setParams={setParams}
          engineState={engineState}
          memorySlots={memorySlots}
          armedSlotIndex={armedSlotIndex}
          playingSlotIndex={playingSlotIndex}
          setArmedSlotIndex={setArmedSlotIndex}
          activeNotes={physicallyHeldNotes}
          onClose={() => setShowMobileView(false)}
          onArmSlot={(index) => {
            if (lastPlayedChord) {
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

content = content.replace(old_mobile, new_mobile)
open('src/App.tsx', 'w').write(content)

