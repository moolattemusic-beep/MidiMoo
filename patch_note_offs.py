import re
content = open('src/lib/OrchidEngine.ts').read()

old_recalc = """      // Turn off old ones that are no longer valid
      for (const p of oldPitches) {
        if (!newPitches.includes(p)) {
          this.emitNoteOff(p, 0);
          for (let k = memoryArray.length - 1; k >= 0; k--) {
            if (memoryArray[k].pitch === p && !memoryArray[k].isBass) {
              memoryArray.splice(k, 1);
            }
          }
        }
      }"""

new_recalc = """      // Turn off old ones that are no longer valid
      for (const p of oldPitches) {
        if (!newPitches.includes(p)) {
          const noteObj = memoryArray.find(n => n.pitch === p && !n.isBass);
          if (noteObj) {
            this.emitNoteOff(noteObj.mpeBasePitch ?? noteObj.pitch, 0, 0, noteObj.mpeChannel);
            if (noteObj.mpeChannel) this.freeMpeChannel(noteObj.mpeChannel);
          }
          for (let k = memoryArray.length - 1; k >= 0; k--) {
            if (memoryArray[k].pitch === p && !memoryArray[k].isBass) {
              memoryArray.splice(k, 1);
            }
          }
        }
      }"""

if old_recalc in content:
    content = content.replace(old_recalc, new_recalc)
    print("Patched recalc")
else:
    print("Failed to patch recalc")
    
old_diff = """        for (const oldNote of oldChordNotes) {
          if (!finalPitches.includes(oldNote.pitch)) {
            if (oldNote.timeoutId) clearTimeout(oldNote.timeoutId);
            else this.emitNoteOff(oldNote.pitch, 0, 0);
          } else {
            newMemory.push(oldNote);
          }
        }"""

new_diff = """        for (const oldNote of oldChordNotes) {
          if (!finalPitches.includes(oldNote.pitch)) {
            if (oldNote.timeoutId) clearTimeout(oldNote.timeoutId);
            else this.emitNoteOff(oldNote.mpeBasePitch ?? oldNote.pitch, 0, 0, oldNote.mpeChannel);
            if (oldNote.mpeChannel) this.freeMpeChannel(oldNote.mpeChannel);
          } else {
            newMemory.push(oldNote);
          }
        }"""

if old_diff in content:
    content = content.replace(old_diff, new_diff)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched diff")
else:
    print("Failed to patch diff")
    
