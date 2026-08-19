import re
content = open('src/lib/OrchidEngine.ts').read()

# Fix notesToKill loop 1
old1 = """          const notesToKill = this.activePitchesMemory[pitch];
          for (const note of notesToKill) {
            if (note.timeoutId) {
              clearTimeout(note.timeoutId);
            } else {
              this.emitNoteOff(note.pitch, 0, 0);
            }
          }
          delete this.activePitchesMemory[pitch];"""
new1 = """          const notesToKill = this.activePitchesMemory[pitch];
          for (const note of notesToKill) {
            if (note.timeoutId) {
              clearTimeout(note.timeoutId);
            } else {
              this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
            }
            if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
          }
          delete this.activePitchesMemory[pitch];"""
content = content.replace(old1, new1)

# Fix notesToKill loop 2 (if there's another one, like in physical release or initialization)
old2 = """        const notesToKill = this.activePitchesMemory[pitch];
        for (const note of notesToKill) {
          if (note.timeoutId) {
            clearTimeout(note.timeoutId);
          } else {
            this.emitNoteOff(note.pitch, 0, 0);
          }
        }
        delete this.activePitchesMemory[pitch];"""
new2 = """        const notesToKill = this.activePitchesMemory[pitch];
        for (const note of notesToKill) {
          if (note.timeoutId) {
            clearTimeout(note.timeoutId);
          } else {
            this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
          }
          if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }
        delete this.activePitchesMemory[pitch];"""
content = content.replace(old2, new2)

# Fix existing bass off
old3 = """          if (existingBass && !skipBass) {
            if (existingBass.timeoutId) clearTimeout(existingBass.timeoutId);
            else this.emitNoteOff(existingBass.pitch, 0, 0);
          }"""
new3 = """          if (existingBass && !skipBass) {
            if (existingBass.timeoutId) clearTimeout(existingBass.timeoutId);
            else this.emitNoteOff(existingBass.mpeBasePitch ?? existingBass.pitch, 0, 0, existingBass.mpeChannel);
            if (existingBass.mpeChannel) this.freeMpeChannel(existingBass.mpeChannel);
          }"""
content = content.replace(old3, new3)

old4 = """        if (existingBass) {
          if (existingBass.timeoutId) clearTimeout(existingBass.timeoutId);
          else this.emitNoteOff(existingBass.pitch, 0, 0);
        }"""
new4 = """        if (existingBass) {
          if (existingBass.timeoutId) clearTimeout(existingBass.timeoutId);
          else this.emitNoteOff(existingBass.mpeBasePitch ?? existingBass.pitch, 0, 0, existingBass.mpeChannel);
          if (existingBass.mpeChannel) this.freeMpeChannel(existingBass.mpeChannel);
        }"""
content = content.replace(old4, new4)

# Update NoteOn allocation for NEW notes (non-update)
old_new_notes = """    for (let j = 0; j < finalPitches.length; j++) {
      const targetPitch = finalPitches[j];
      const delayForThisNote = Math.floor(j * delayStep);
      
      if (targetPitch >= 0 && targetPitch <= 127 && !playedPitches[targetPitch]) {
        playedPitches[targetPitch] = true;
        const noteObj: any = { pitch: targetPitch, delayUsed: delayForThisNote, isBass: false };"""

new_new_notes = """    for (let j = 0; j < finalPitches.length; j++) {
      const targetPitch = finalPitches[j];
      const delayForThisNote = Math.floor(j * delayStep);
      
      if (targetPitch >= 0 && targetPitch <= 127 && !playedPitches[targetPitch]) {
        playedPitches[targetPitch] = true;
        const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
        const noteObj: any = { pitch: targetPitch, delayUsed: delayForThisNote, isBass: false, mpeChannel: channel, mpeBasePitch: targetPitch, mpeCurrentPitch: targetPitch };"""

content = content.replace(old_new_notes, new_new_notes)

# Fix non-update bass NoteOn
old_bass_new = """    // Add Bass Pitch
    if (bassSetting > 0 && bassPitch >= 0) {
      if (!suppressImmediatePlay) {
        this.emitNoteOn(bassPitch, velocity, 0);
      }
      this.activePitchesMemory[pitch].push({ pitch: bassPitch, delayUsed: 0, isBass: true });
    }"""
new_bass_new = """    // Add Bass Pitch
    if (bassSetting > 0 && bassPitch >= 0) {
      const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
      if (!suppressImmediatePlay) {
        this.emitNoteOn(bassPitch, velocity, 0, channel);
      }
      this.activePitchesMemory[pitch].push({ pitch: bassPitch, delayUsed: 0, isBass: true, mpeChannel: channel, mpeBasePitch: bassPitch, mpeCurrentPitch: bassPitch });
    }"""
content = content.replace(old_bass_new, new_bass_new)

# Update the emitNoteOn calls in the new notes loop
old_trigger_new = """        if (!suppressImmediatePlay) {
          if (delayForThisNote > 0) {
            noteObj.timeoutId = setTimeout(() => {
              this.emitNoteOn(targetPitch, velocity, 0);
              noteObj.timeoutId = undefined;
            }, delayForThisNote);
          } else {
            this.emitNoteOn(targetPitch, velocity, 0);
          }
        }"""
new_trigger_new = """        if (!suppressImmediatePlay) {
          if (delayForThisNote > 0) {
            noteObj.timeoutId = setTimeout(() => {
              this.emitNoteOn(targetPitch, velocity, 0, noteObj.mpeChannel);
              noteObj.timeoutId = undefined;
            }, delayForThisNote);
          } else {
            this.emitNoteOn(targetPitch, velocity, 0, noteObj.mpeChannel);
          }
        }"""
content = content.replace(old_trigger_new, new_trigger_new)


open('src/lib/OrchidEngine.ts', 'w').write(content)
