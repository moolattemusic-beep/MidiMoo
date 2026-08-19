import re
content = open('src/App.tsx').read()

# Remove setArmedSlotIndex, armedSlotIndex state completely
content = re.sub(r'const \[armedSlotIndex, setArmedSlotIndex\] = useState<number \| null>\(null\);\n', '', content)
content = re.sub(r'const armedSlotIndexRef = useRef\(armedSlotIndex\);\n', '', content)
content = re.sub(r'useEffect\(\(\) => \{ armedSlotIndexRef.current = armedSlotIndex; \}, \[armedSlotIndex\]\);\n', '', content)

# Remove armedSlotIndex from props everywhere
content = re.sub(r'armedSlotIndex={armedSlotIndex}\n', '', content)
content = re.sub(r'setArmedSlotIndex={setArmedSlotIndex}\n', '', content)
content = re.sub(r'armedSlotIndex: number \| null;\n', '', content)
content = re.sub(r'setArmedSlotIndex: \(index: number \| null\) => void;\n', '', content)
content = re.sub(r'armedSlotIndex,\n', '', content)
content = re.sub(r'setArmedSlotIndex,\n', '', content)

# Fix onPerformanceKey latch logic
old_perf = """      engine.onPerformanceKey = (pitch: number, isDown: boolean, allReleased: boolean) => {
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

        if (armedSlotIndex !== null) {
          if (isDown) {
            // Start mapping immediately on press
            setMemorySlots(prev => {
              const next = [...prev];
              next[armedSlotIndex] = {
                rootPitch: pitch,
                baseType: engine.manualBaseType,
                ext_m7: engine.ext_m7,
                ext_M7: engine.ext_M7,
                ext_6: engine.ext_6,
                ext_9: engine.ext_9
              };
              return next;
            });
          } else if (allReleased) {
            setArmedSlotIndex(null); // Unarm after releasing the performance key
          }
        }
      };"""

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
      };"""

content = content.replace(old_perf, new_perf)

# Fix onStateChange logic
old_state = """    newEngine.onStateChange = () => {
        if (physicallyHeldNotesRef.current.length > 0) {
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
          // Latch the current active modifiers, ignoring momentary releases
          setMemorySlots(prev => {
            const next = [...prev];
            const current = next[armedSlotIndexRef.current!];
            if (current) {
              // Latch the current active modifiers, ignoring momentary releases
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
        
        setEngineState({"""

new_state = """    newEngine.onStateChange = () => {
        const updateChordData = (prev: MemorySlot | null) => prev ? {
          ...prev,
          baseType: engine.manualBaseType !== -1 ? engine.manualBaseType : prev.baseType,
          ext_m7: prev.ext_m7 || engine.ext_m7,
          ext_M7: prev.ext_M7 || engine.ext_M7,
          ext_6: prev.ext_6 || engine.ext_6,
          ext_9: prev.ext_9 || engine.ext_9
        } : null;

        if (physicallyHeldNotesRef.current.length > 0) {
          setLastPlayedChord(updateChordData);
        }

        if (playingSlotIndexRef.current !== null) {
          setMemorySlots(prev => {
            const next = [...prev];
            next[playingSlotIndexRef.current!] = updateChordData(next[playingSlotIndexRef.current!]);
            return next;
          });
          // Also update lastPlayedChord so the UI knows we changed it
          setLastPlayedChord(updateChordData);
        }
        
        setEngineState({"""

content = content.replace(old_state, new_state)

# Fix App.tsx <MemorySlots /> props mapping
old_mem_app = """          <MemorySlots 
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

new_mem_app = """          <MemorySlots 
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

content = content.replace(old_mem_app, new_mem_app)

# Do the same replacement for MobileView
old_mob_app = """          onArmSlot={(index) => {
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
          }}"""

new_mob_app = """          onPlaySlot={(index) => {
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
          onUpdateSlots={setMemorySlots}"""

content = content.replace(old_mob_app, new_mob_app)

# Remove armedSlotIndex from dependency arrays
content = re.sub(r'\}, \[engine, armedSlotIndex\]\);', '}, [engine]);', content)

open('src/App.tsx', 'w').write(content)
