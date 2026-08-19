import re
content = open('src/components/MemorySlots.tsx').read()
content = content.replace("engine.handleMidi(slot.rootPitch, memoryVelocity, true);", "engine.handleMidi(slot.rootPitch, memoryVelocity, true, false, false, false, true);")
content = content.replace("engine.handleMidi(slot.rootPitch, 0, false);", "engine.handleMidi(slot.rootPitch, 0, false, false, false, false, true);")
open('src/components/MemorySlots.tsx', 'w').write(content)
print("Patched MemorySlots.tsx handleMidi calls")
