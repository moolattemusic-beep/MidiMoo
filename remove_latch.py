import re
content = open('src/App.tsx').read()

old_latch = """  // Latch modifiers while armed and mapping
  useEffect(() => {
    if (armedSlotIndexRef.current !== null && engine && engine.heldKeys.size > 0) {
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
  }, [engineState, engine]);"""

content = content.replace(old_latch, "")
open('src/App.tsx', 'w').write(content)

