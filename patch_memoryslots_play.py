import re
content = open('src/components/MemorySlots.tsx').read()

old_click = """                  if (engine && slot) {
                    engine.setModifiers(slot.baseType, slot.ext_m7, slot.ext_M7, slot.ext_6, slot.ext_9);
                    engine.handleMidi(slot.rootPitch, 100, true);
                    onPlaySlot(i);
                  } else if (!slot && lastPlayedChord) {"""
new_click = """                  if (engine && slot) {
                    if (slot.customVoicing && slot.customVoicing.length > 0) {
                       engine.handleCustomVoicing(slot.customVoicing, memoryVelocity, true, i);
                    } else {
                       engine.setModifiers(slot.baseType, slot.ext_m7, slot.ext_M7, slot.ext_6, slot.ext_9);
                       engine.handleMidi(slot.rootPitch, memoryVelocity, true);
                    }
                    onPlaySlot(i);
                  } else if (!slot && lastPlayedChord) {"""

content = content.replace(old_click, new_click)

old_up = """                  if (engine && slot) {
                    engine.handleMidi(slot.rootPitch, 0, false);
                    onStopSlot(i);
                  }"""
new_up = """                  if (engine && slot) {
                    if (slot.customVoicing && slot.customVoicing.length > 0) {
                       engine.handleCustomVoicing(slot.customVoicing, 0, false, i);
                    } else {
                       engine.handleMidi(slot.rootPitch, 0, false);
                    }
                    onStopSlot(i);
                  }"""

# Replace both occurrences (onPointerUp and onPointerLeave)
content = content.replace(old_up, new_up)

open('src/components/MemorySlots.tsx', 'w').write(content)
print("Patched MemorySlots play logic")
