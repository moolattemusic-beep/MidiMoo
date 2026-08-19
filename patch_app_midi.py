import re
content = open('src/App.tsx').read()
content = content.replace("newEngine.handleMidi(slot.rootPitch, vel, true);", "newEngine.handleMidi(slot.rootPitch, vel, true, false, false, false, true);")
content = content.replace("newEngine.handleMidi(slot.rootPitch, 0, false);", "newEngine.handleMidi(slot.rootPitch, 0, false, false, false, false, true);")
open('src/App.tsx', 'w').write(content)
print("Patched App.tsx handleMidi calls")
