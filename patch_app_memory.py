import re
content = open('src/App.tsx').read()

# Add lastPlayedChord state
if 'const [lastPlayedChord' not in content:
    content = content.replace(
        "const [playingSlotIndex, setPlayingSlotIndex] = useState<number | null>(null);",
        "const [playingSlotIndex, setPlayingSlotIndex] = useState<number | null>(null);\n  const [lastPlayedChord, setLastPlayedChord] = useState<MemorySlot | null>(null);"
    )

# Add physicallyHeldNotesRef
if 'const physicallyHeldNotesRef =' not in content:
    content = content.replace(
        "const paramsRef = useRef(params);",
        "const paramsRef = useRef(params);\n  const physicallyHeldNotesRef = useRef(physicallyHeldNotes);\n  physicallyHeldNotesRef.current = physicallyHeldNotes;"
    )

# Update onPerformanceKey
old_perf = """      engine.onPerformanceKey = (pitch: number, isDown: boolean, allReleased: boolean) => {
        setPhysicallyHeldNotes(Array.from(engine.heldKeys.keys()));
        if (armedSlotIndex !== null) {"""

new_perf = """      engine.onPerformanceKey = (pitch: number, isDown: boolean, allReleased: boolean) => {
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

        if (armedSlotIndex !== null) {"""

content = content.replace(old_perf, new_perf)

# Update onStateChange
old_state = """        if (armedSlotIndexRef.current !== null) {
          // Latch the current active modifiers, ignoring momentary releases"""

new_state = """        if (physicallyHeldNotesRef.current.length > 0) {
          setLastPlayedChord(prev => prev ? {
            ...prev,
            baseType: engine.manualBaseType !== -1 ? engine.manualBaseType : prev.baseType,
            ext_m7: prev.ext_m7 || engine.ext_m7,
            ext_M7: prev.ext_M7 || engine.ext_M7,
            ext_6: prev.ext_6 || engine.ext_6,
            ext_9: prev.ext_9 || engine.ext_9
          } : null);
        }

        if (armedSlotIndexRef.current !== null) {
          // Latch the current active modifiers, ignoring momentary releases"""

content = content.replace(old_state, new_state)

# Update MemorySlots props in App.tsx
old_mem = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            armedSlotIndex={armedSlotIndex}
            playingSlotIndex={playingSlotIndex}
            onArmSlot={(index) => setArmedSlotIndex(prev => prev === index ? null : index)}
          />"""

new_mem = """          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            armedSlotIndex={armedSlotIndex}
            playingSlotIndex={playingSlotIndex}
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

content = content.replace(old_mem, new_mem)

open('src/App.tsx', 'w').write(content)
