import re
content = open('src/App.tsx').read()

state_old = """  const [isChordEditMode, setIsChordEditMode] = useState(false);
  const [activeEditSlotIndex, setActiveEditSlotIndex] = useState<number | null>(null);
  const activeEditSlotIndexRef = useRef(activeEditSlotIndex);
  activeEditSlotIndexRef.current = activeEditSlotIndex;"""

state_new = """  const [isChordEditMode, setIsChordEditMode] = useState(false);
  const [activeEditSlotIndex, setActiveEditSlotIndex] = useState<number | null>(null);
  const activeEditSlotIndexRef = useRef(activeEditSlotIndex);
  activeEditSlotIndexRef.current = activeEditSlotIndex;

  const [isFreeEditMode, setIsFreeEditMode] = useState(false);
  const [armedSlotIndex, setArmedSlotIndex] = useState<number | null>(null);
  const armedSlotIndexRef = useRef(armedSlotIndex);
  armedSlotIndexRef.current = armedSlotIndex;
  
  // To track keys played during an armed recording gesture
  const armedRecordedPitches = useRef<Set<number>>(new Set());
"""

content = content.replace(state_old, state_new)

perf_old = """      engine.onPerformanceKey = (pitch: number, isDown: boolean, allReleased: boolean) => {
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
          }"""

perf_new = """      engine.onPerformanceKey = (pitch: number, isDown: boolean, allReleased: boolean) => {
        setPhysicallyHeldNotes(Array.from(engine.heldKeys.keys()));
        
        if (armedSlotIndexRef.current !== null) {
            if (isDown) {
                armedRecordedPitches.current.add(pitch);
            }
            if (allReleased && armedRecordedPitches.current.size > 0) {
                const idx = armedSlotIndexRef.current;
                const pitches = Array.from(armedRecordedPitches.current);
                setMemorySlots(prev => {
                    const next = [...prev];
                    next[idx] = { rootPitch: pitches[0] % 12, baseType: 0, ext_m7: false, ext_M7: false, ext_6: false, ext_9: false, customVoicing: pitches };
                    return next;
                });
                setArmedSlotIndex(null); // Disarm after saving
                armedRecordedPitches.current.clear();
            }
        }
        
        if (isDown) {
          if (activeEditSlotIndexRef.current !== null && armedSlotIndexRef.current === null) {
            const idx = activeEditSlotIndexRef.current;
            setMemorySlots(prev => {
               const next = [...prev];
               const existing = next[idx];
               if (existing) {
                  // Keep customVoicing if it exists? Or clear it? 
                  // If user plays a note in standard edit mode, it overwrites custom voicing with a standard chord root
                  next[idx] = { ...existing, rootPitch: pitch % 12, customVoicing: undefined };
               } else {
                  next[idx] = { rootPitch: pitch % 12, baseType: 0, ext_m7: false, ext_M7: false, ext_6: false, ext_9: false };
               }
               return next;
            });
          }"""

content = content.replace(perf_old, perf_new)

# Update the memory start note logic in useEffect
mem_old = """      const memoryStartNote = 12 + (paramsRef.current.controlOctave * 12);
      
      if (channel === 1 && pitch >= memoryStartNote && pitch < memoryStartNote + 8) {
        if (true) {
          const slotIndex = pitch - memoryStartNote;
          const slot = memorySlotsRef.current[slotIndex];
          if (slot) {
            if (isOn && velocity > 0) {
              setPlayingSlotIndex(slotIndex);
              newEngine.manualBaseType = slot.baseType;
              newEngine.ext_m7 = slot.ext_m7;
              newEngine.ext_M7 = slot.ext_M7;
              newEngine.ext_6 = slot.ext_6;
              newEngine.ext_9 = slot.ext_9;
              newEngine.notifyState();
              newEngine.handleMidi(slot.rootPitch, velocity, true);
            } else {
              if (playingSlotIndexRef.current === slotIndex) {
                setPlayingSlotIndex(null);
              }
              newEngine.handleMidi(slot.rootPitch, 0, false);
            }
          }
          return;
        }
      }"""

mem_new = """      const memoryStartNote = 12 + (paramsRef.current.controlOctave * 12);
      
      if (channel === 1 && pitch >= memoryStartNote && pitch < memoryStartNote + 8) {
        if (true) {
          const slotIndex = pitch - memoryStartNote;
          const slot = memorySlotsRef.current[slotIndex];
          if (slot) {
            const vel = paramsRef.current.memoryVelocity || 100;
            if (isOn && velocity > 0) {
              setPlayingSlotIndex(slotIndex);
              
              if (slot.customVoicing && slot.customVoicing.length > 0) {
                 newEngine.handleCustomVoicing(slot.customVoicing, vel, true, slotIndex);
              } else {
                 newEngine.manualBaseType = slot.baseType;
                 newEngine.ext_m7 = slot.ext_m7;
                 newEngine.ext_M7 = slot.ext_M7;
                 newEngine.ext_6 = slot.ext_6;
                 newEngine.ext_9 = slot.ext_9;
                 newEngine.notifyState();
                 newEngine.handleMidi(slot.rootPitch, vel, true);
              }
            } else {
              if (playingSlotIndexRef.current === slotIndex) {
                setPlayingSlotIndex(null);
              }
              if (slot.customVoicing && slot.customVoicing.length > 0) {
                 newEngine.handleCustomVoicing(slot.customVoicing, 0, false, slotIndex);
              } else {
                 newEngine.handleMidi(slot.rootPitch, 0, false);
              }
            }
          }
          return;
        }
      }"""

content = content.replace(mem_old, mem_new)

# Add isFreeEditMode / armedSlotIndex to MemorySlots props
mem_slots_old = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            playingSlotIndex={playingSlotIndex}
            onPlaySlot={(index) => {
              setPlayingSlotIndex(index);
              setLastPlayedChord(memorySlots[index]);
            }}
            onStopSlot={(index) => {
              setPlayingSlotIndex(prev => prev === index ? null : prev);
            }}"""

mem_slots_new = """          <MemorySlots 
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
            memoryVelocity={params.memoryVelocity}
            onMemoryVelocityChange={(vel) => updateParam('memoryVelocity', vel)}
            isFreeEditMode={isFreeEditMode}
            onToggleFreeEditMode={() => {
               const newFree = !isFreeEditMode;
               setIsFreeEditMode(newFree);
               if (newFree) {
                  updateParam('mappingMode', 1); // switch to Free Mode globally
               } else {
                  setArmedSlotIndex(null);
               }
            }}
            armedSlotIndex={armedSlotIndex}
            onArmSlot={(idx) => {
               setArmedSlotIndex(prev => prev === idx ? null : idx);
               armedRecordedPitches.current.clear();
            }}"""

content = content.replace(mem_slots_old, mem_slots_new)

# Similarly, find the second MemorySlots for MobileView
if content.count("<MemorySlots ") > 1:
   mem_slots_old_2 = """            onStopSlot={(index) => {
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

   mem_slots_new_2 = """            onStopSlot={(index) => {
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
            memoryVelocity={params.memoryVelocity}
            onMemoryVelocityChange={() => {}}
            isFreeEditMode={false}
            onToggleFreeEditMode={() => {}}
            armedSlotIndex={null}
            onArmSlot={() => {}}
          />"""
   content = content.replace(mem_slots_old_2, mem_slots_new_2)

open('src/App.tsx', 'w').write(content)
print("Patched App.tsx")
