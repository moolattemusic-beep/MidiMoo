import re

content = open('src/components/ArpeggioXYPad.tsx').read()
content = content.replace("((incomingCC.val - 64) / 64) * 2", "((incomingCC.val - 64) / 64) * 12")
content = content.replace("((midiVal - 64) / 64) * 2", "((midiVal - 64) / 64) * 12")
open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
print("Patched XY Pad")
