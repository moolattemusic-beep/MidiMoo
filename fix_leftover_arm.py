import re
content = open('src/App.tsx').read()

# Fix omnichord
old_omnichord = """        // Check if we are mapping
        if (armedSlotIndexRef.current === null) {
          // If in Omnichord mode, strumming always retriggers
          if (paramsRef.current.omnichordMode) {
            engine.retriggerHeldKeys(true);
          } else {
            engine.retriggerHeldKeys(false); // Just emit the bass note if strum mode is off
          }
        }"""
        
new_omnichord = """        // If in Omnichord mode, strumming always retriggers
        if (paramsRef.current.omnichordMode) {
          engine.retriggerHeldKeys(true);
        } else {
          engine.retriggerHeldKeys(false); // Just emit the bass note if strum mode is off
        }"""
content = content.replace(old_omnichord, new_omnichord)

# Fix latch modifiers
old_latch = """  // Latch modifiers while armed and mapping
  useEffect(() => {
    if (armedSlotIndexRef.current !== null && engine && engine.heldKeys.size > 0) {
      setMemorySlots(prev => {
        const next = [...prev];
        const current = next[armedSlotIndexRef.current!];
        if (current) {
          next[armedSlotIndexRef.current!] = {
            ...current,
            baseType: engine.manualBaseType !== -1 ? engine.manualBaseType : current.baseType,
            ext_m7: current.ext_m7 || engine.ext_m7,
            ext_M7: current.ext_M7 || engine.ext_M7,
            ext_6: current.ext_6 || engine.ext_6,
            ext_9: current.ext_9 || engine.ext_9
          };
        }
        return next;
      });
    }
  }, [engineState]);"""

content = content.replace(old_latch, "")

# Find the second instance of <MemorySlots that is causing issues (probably another one leftover or the desktop one wasn't fully replaced if there were multiple)
old_mem_2 = """          <MemorySlots 
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

new_mem_2 = """          <MemorySlots 
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
          
content = content.replace(old_mem_2, new_mem_2)

open('src/App.tsx', 'w').write(content)
