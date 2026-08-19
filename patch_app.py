import re

content = open('src/App.tsx').read()

# Add states
states_old = """  const [memorySlots, setMemorySlots] = useState<MemorySlot[]>(Array(8).fill(null));
    const [playingSlotIndex, setPlayingSlotIndex] = useState<number | null>(null);
  const [lastPlayedChord, setLastPlayedChord] = useState<MemorySlot | null>(null);"""
states_new = """  const [memorySlots, setMemorySlots] = useState<MemorySlot[]>(Array(8).fill(null));
  const [playingSlotIndex, setPlayingSlotIndex] = useState<number | null>(null);
  const [lastPlayedChord, setLastPlayedChord] = useState<MemorySlot | null>(null);
  const [isChordEditMode, setIsChordEditMode] = useState(false);
  const [activeEditSlotIndex, setActiveEditSlotIndex] = useState<number | null>(null);
  const activeEditSlotIndexRef = useRef(activeEditSlotIndex);
  activeEditSlotIndexRef.current = activeEditSlotIndex;
"""
content = content.replace(states_old, states_new)

# Modify onPerformanceKey
perf_old = """      engine.onPerformanceKey = (pitch: number, isDown: boolean, allReleased: boolean) => {
        setPhysicallyHeldNotes(Array.from(engine.heldKeys.keys()));
        
        if (isDown) {
          setLastPlayedChord({
            rootPitch: pitch,
            baseType: engine.manualBaseType,
            ext_m7: engine.ext_m7,
            ext_M7: engine.ext_M7,
            ext_6: engine.ext_6,
            ext_9: engine.ext_9
          });
        }
      };"""
perf_new = """      engine.onPerformanceKey = (pitch: number, isDown: boolean, allReleased: boolean) => {
        setPhysicallyHeldNotes(Array.from(engine.heldKeys.keys()));
        
        if (isDown) {
          if (activeEditSlotIndexRef.current !== null) {
            const idx = activeEditSlotIndexRef.current;
            setMemorySlots(prev => {
               const next = [...prev];
               const existing = next[idx];
               if (existing) {
                  next[idx] = { ...existing, rootPitch: pitch % 12 };
               } else {
                  next[idx] = { rootPitch: pitch % 12, baseType: 0, ext_m7: false, ext_M7: false, ext_6: false, ext_9: false };
               }
               return next;
            });
          }
          
          setLastPlayedChord({
            rootPitch: pitch,
            baseType: engine.manualBaseType,
            ext_m7: engine.ext_m7,
            ext_M7: engine.ext_M7,
            ext_6: engine.ext_6,
            ext_9: engine.ext_9
          });
        }
      };"""
content = content.replace(perf_old, perf_new)

# Find the MemorySlots block
mem_old = """          <MemorySlots 
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

mem_new = """          <MemorySlots 
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
            isEditMode={isChordEditMode}
            onToggleEditMode={() => {
               setIsChordEditMode(!isChordEditMode);
               if (isChordEditMode) setActiveEditSlotIndex(null);
            }}
            activeEditSlotIndex={activeEditSlotIndex}
            onSelectEditSlot={(index) => {
               setActiveEditSlotIndex(prev => prev === index ? null : index);
               // If empty slot is selected, initialize it
               if (memorySlots[index] === null) {
                  setMemorySlots(prev => {
                     const next = [...prev];
                     next[index] = { rootPitch: 0, baseType: 0, ext_m7: false, ext_M7: false, ext_6: false, ext_9: false };
                     return next;
                  });
               }
            }}
          />"""

content = content.replace(mem_old, mem_new)


# Now modify ModifierPads props to pass the slot values when editing
mod_old = """              <ModifierPads 
                engine={engine}
                params={params}
                setParams={setParams}
                manualBaseType={engineState.manualBaseType}
                effectiveBaseType={engineState.effectiveBaseType}
                ext_m7={engineState.ext_m7}
                ext_M7={engineState.ext_M7}
                ext_6={engineState.ext_6}
                ext_9={engineState.ext_9}
                ext_alt={engineState.ext_alt}
              />"""

mod_new = """              <ModifierPads 
                engine={engine}
                params={params}
                setParams={setParams}
                manualBaseType={activeEditSlotIndex !== null && memorySlots[activeEditSlotIndex] ? memorySlots[activeEditSlotIndex]!.baseType : engineState.manualBaseType}
                effectiveBaseType={activeEditSlotIndex !== null ? undefined : engineState.effectiveBaseType}
                ext_m7={activeEditSlotIndex !== null && memorySlots[activeEditSlotIndex] ? memorySlots[activeEditSlotIndex]!.ext_m7 : engineState.ext_m7}
                ext_M7={activeEditSlotIndex !== null && memorySlots[activeEditSlotIndex] ? memorySlots[activeEditSlotIndex]!.ext_M7 : engineState.ext_M7}
                ext_6={activeEditSlotIndex !== null && memorySlots[activeEditSlotIndex] ? memorySlots[activeEditSlotIndex]!.ext_6 : engineState.ext_6}
                ext_9={activeEditSlotIndex !== null && memorySlots[activeEditSlotIndex] ? memorySlots[activeEditSlotIndex]!.ext_9 : engineState.ext_9}
                ext_alt={engineState.ext_alt}
                onBaseTypeChange={activeEditSlotIndex !== null ? (val) => {
                   setMemorySlots(prev => {
                      const next = [...prev];
                      if (next[activeEditSlotIndex]) {
                         next[activeEditSlotIndex] = { ...next[activeEditSlotIndex]!, baseType: val };
                      }
                      return next;
                   });
                } : undefined}
                onExtensionToggle={activeEditSlotIndex !== null ? (extId) => {
                   setMemorySlots(prev => {
                      const next = [...prev];
                      const slot = next[activeEditSlotIndex];
                      if (slot) {
                         const updated = { ...slot };
                         if (extId === 'm7') { updated.ext_m7 = !updated.ext_m7; updated.ext_M7 = false; }
                         if (extId === 'M7') { updated.ext_M7 = !updated.ext_M7; updated.ext_m7 = false; }
                         if (extId === '6') updated.ext_6 = !updated.ext_6;
                         if (extId === '9') updated.ext_9 = !updated.ext_9;
                         next[activeEditSlotIndex] = updated;
                      }
                      return next;
                   });
                } : undefined}
              />"""

content = content.replace(mod_old, mod_new)

# Wait, there's another MemorySlots instance for mobile view
# Let's replace the second one if it exists
if content.count("<MemorySlots ") > 1:
   mem2_old = """          <MemorySlots 
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
            onPanic={() => {
              if (engine) engine.panic();
              synth.panic();
              midiManager.panic();
            }}
          />"""
          
   mem2_new = """          <MemorySlots 
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
            isEditMode={isChordEditMode}
            onToggleEditMode={() => {
               setIsChordEditMode(!isChordEditMode);
               if (isChordEditMode) setActiveEditSlotIndex(null);
            }}
            activeEditSlotIndex={activeEditSlotIndex}
            onSelectEditSlot={(index) => {
               setActiveEditSlotIndex(prev => prev === index ? null : index);
               // If empty slot is selected, initialize it
               if (memorySlots[index] === null) {
                  setMemorySlots(prev => {
                     const next = [...prev];
                     next[index] = { rootPitch: 0, baseType: 0, ext_m7: false, ext_M7: false, ext_6: false, ext_9: false };
                     return next;
                  });
               }
            }}
            onPanic={() => {
              if (engine) engine.panic();
              synth.panic();
              midiManager.panic();
            }}
          />"""
          
   content = content.replace(mem2_old, mem2_new)


open('src/App.tsx', 'w').write(content)
print("Patched App.tsx")
