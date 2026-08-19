import re
content = open('src/components/MemorySlots.tsx').read()

old_arm_text = "{isArmed ? 'ARMED' : 'ARM'}"
new_arm_text = "{isArmed ? 'ARMED' : (lastPlayedChord ? 'SAVE' : 'ARM')}"

content = content.replace(old_arm_text, new_arm_text)
open('src/components/MemorySlots.tsx', 'w').write(content)
