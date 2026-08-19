import re

content = open('src/lib/OrchidEngine.ts').read()

old_block = """    // Stop previous notes if re-triggering the same physical key and NOT updating
    if (!isUpdate) {
      if (this.onPerformanceKey) {
        this.onPerformanceKey(pitch, true, false);
      }
      if (this.activePitchesMemory[pitch]) {
        const notesToKill = this.activePitchesMemory[pitch];
        for (const note of notesToKill) {
          if (note.timeoutId) {
            clearTimeout(note.timeoutId);
          } else {
            this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
          }
          if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }
        delete this.activePitchesMemory[pitch];
      }
      this.activePitchesMemory[pitch] = [];
    }"""

new_block = """    let performGlideFromPrevious = false;
    let stolenMemory: any[] = [];

    // Stop previous notes if re-triggering the same physical key and NOT updating
    if (!isUpdate) {
      if (this.onPerformanceKey) {
        this.onPerformanceKey(pitch, true, false);
      }
      
      if (this.params.mpeEnabled) {
        for (const pkStr in this.activePitchesMemory) {
          const pk = parseInt(pkStr);
          if (pk !== pitch && this.activePitchesMemory[pk] && this.activePitchesMemory[pk].length > 0) {
            stolenMemory = this.activePitchesMemory[pk];
            this.activePitchesMemory[pk] = []; // Clear old key so it doesn't kill notes when released
            performGlideFromPrevious = true;
            break; // Steal from the first active chord found
          }
        }
      }

      if (this.activePitchesMemory[pitch]) {
        const notesToKill = this.activePitchesMemory[pitch];
        for (const note of notesToKill) {
          if (note.timeoutId) {
            clearTimeout(note.timeoutId);
          } else {
            this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
          }
          if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }
      }
      this.activePitchesMemory[pitch] = performGlideFromPrevious ? stolenMemory : [];
    }"""

content = content.replace(old_block, new_block)

old_update_cond = """    if (isUpdate) {"""
new_update_cond = """    if (isUpdate || performGlideFromPrevious) {"""
# We only want to replace the first `if (isUpdate) {` after `const suppressImmediatePlay = ...`
content = re.sub(r'    const suppressImmediatePlay = (.*?);\n\n    if \(isUpdate\) \{', r'    const suppressImmediatePlay = \1;\n\n    if (isUpdate || performGlideFromPrevious) {', content, count=1)

open('src/lib/OrchidEngine.ts', 'w').write(content)
