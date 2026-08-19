import re
content = open('src/App.tsx').read()

old_code = """          if (slot) {
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
          }"""

new_code = """          if (slot) {
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
          }"""

content = content.replace(old_code, new_code)
open('src/App.tsx', 'w').write(content)
print("Patched midi velocity")
