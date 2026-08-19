import re

content = open('src/App.tsx').read()

old_block = """        } else if (event.isCC) {
          midiManager.sendControlChange(event.ccNumber!, event.ccValue!, event.delayMs || 0, event.mpeChannel || 1);
        } else {
          midiManager.sendNote(event.pitch, event.velocity, event.isOn, event.delayMs, event.mpeChannel || 1);
          
          // Delay UI update so it respects strumming visually"""

new_block = """        } else if (event.isCC) {
          midiManager.sendControlChange(event.ccNumber!, event.ccValue!, event.delayMs || 0, event.mpeChannel || 1);
        } else {
          if (!event.isInternalSynthOnly) {
            midiManager.sendNote(event.pitch, event.velocity, event.isOn, event.delayMs, event.mpeChannel || 1);
          }
          
          // Delay UI update so it respects strumming visually"""

content = content.replace(old_block, new_block)

open('src/App.tsx', 'w').write(content)
print("Fixed App.tsx")
