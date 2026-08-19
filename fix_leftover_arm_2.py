import re
content = open('src/App.tsx').read()

content = content.replace("        if (armedSlotIndexRef.current === null) {", "        if (true) {")

old_latch = """  useEffect(() => {
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
