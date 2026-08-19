import re

content = open('src/lib/OrchidEngine.ts').read()

old_strum = """          this.emitNoteOff(noteObj.pitch, 0, 0, channel); // Ensure clean pluck retrigger
          this.emitNoteOn(noteObj.pitch, 100, 0, channel);
          
          if (memory && !existing) {"""

new_strum = """          this.emitNoteOff(noteObj.pitch, 0, 0, channel); // Ensure clean pluck retrigger
          this.emitNoteOn(noteObj.pitch, 100, 0, channel);
          
          // In Omnichord mode, we send a short pulse for the strum so recorded MIDI notes aren't huge blocks
          if (this.params.omnichordMode) {
             setTimeout(() => {
                this.emitNoteOff(noteObj.pitch, 0, 0, channel);
             }, 50);
          }
          
          if (memory && !existing) {"""

content = content.replace(old_strum, new_strum)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched strumplate pulse")
