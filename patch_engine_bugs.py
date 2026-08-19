import re
content = open('src/lib/OrchidEngine.ts').read()

old_sustain = """      if (!this.sustainPedalActive) {
        // Flush all physically released keys
        for (const pitch of this.physicallyReleasedKeys) {
          if (this.activePitchesMemory[pitch]) {
            const notesToKill = this.activePitchesMemory[pitch];
            for (const note of notesToKill) {
              if (note.timeoutId) {
                clearTimeout(note.timeoutId);
              } else {
                this.emitNoteOff(note.pitch, 0, 0);
              }
            }
            delete this.activePitchesMemory[pitch];
          }
        }
        this.physicallyReleasedKeys.clear();
        this.updateStrumplatePitches();
      }"""

new_sustain = """      if (!this.sustainPedalActive) {
        // Flush all physically released keys
        for (const pitch of this.physicallyReleasedKeys) {
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
        }
        this.physicallyReleasedKeys.clear();
        this.updateStrumplatePitches();
      }"""
content = content.replace(old_sustain, new_sustain)

old_strum1 = """        if (i !== this.lastStrumIndex) {
          const noteObj = this.strumplatePitches[i];
          this.emitNoteOff(noteObj.pitch, 0, 0); // Ensure clean pluck retrigger
          this.emitNoteOn(noteObj.pitch, 100, 0);
          
          // Make sure it's in the memory so it turns off when the source key is released
          const memory = this.activePitchesMemory[noteObj.sourceKey];
          if (memory) {
            const existing = memory.find(n => n.pitch === noteObj.pitch);
            if (!existing) {
              memory.push({ pitch: noteObj.pitch, delayUsed: 0, isBass: false });
            }
          }
        }"""

new_strum1 = """        if (i !== this.lastStrumIndex) {
          const noteObj = this.strumplatePitches[i];
          
          let channel: number | undefined = undefined;
          let existing: any = null;
          const memory = this.activePitchesMemory[noteObj.sourceKey];
          if (memory) {
            existing = memory.find((n: any) => n.pitch === noteObj.pitch);
            if (existing) channel = existing.mpeChannel;
          }
          if (this.params.mpeEnabled && channel === undefined) {
            channel = this.allocateMpeChannel();
          }

          this.emitNoteOff(noteObj.pitch, 0, 0, channel); // Ensure clean pluck retrigger
          this.emitNoteOn(noteObj.pitch, 100, 0, channel);
          
          if (memory && !existing) {
            memory.push({ pitch: noteObj.pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: noteObj.pitch, mpeCurrentPitch: noteObj.pitch });
          }
        }"""
content = content.replace(old_strum1, new_strum1)

old_strum2 = """    } else if (this.lastStrumIndex === -1) {
      // First touch
      const noteObj = this.strumplatePitches[currIndex];
      this.emitNoteOff(noteObj.pitch, 0, 0);
      this.emitNoteOn(noteObj.pitch, 100, 0);
      const memory = this.activePitchesMemory[noteObj.sourceKey];
      if (memory) {
        const existing = memory.find(n => n.pitch === noteObj.pitch);
        if (!existing) {
          memory.push({ pitch: noteObj.pitch, delayUsed: 0, isBass: false });
        }
      }
    }"""
    
new_strum2 = """    } else if (this.lastStrumIndex === -1) {
      // First touch
      const noteObj = this.strumplatePitches[currIndex];
      
      let channel: number | undefined = undefined;
      let existing: any = null;
      const memory = this.activePitchesMemory[noteObj.sourceKey];
      if (memory) {
        existing = memory.find((n: any) => n.pitch === noteObj.pitch);
        if (existing) channel = existing.mpeChannel;
      }
      if (this.params.mpeEnabled && channel === undefined) {
        channel = this.allocateMpeChannel();
      }

      this.emitNoteOff(noteObj.pitch, 0, 0, channel);
      this.emitNoteOn(noteObj.pitch, 100, 0, channel);
      
      if (memory && !existing) {
        memory.push({ pitch: noteObj.pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: noteObj.pitch, mpeCurrentPitch: noteObj.pitch });
      }
    }"""
content = content.replace(old_strum2, new_strum2)

open('src/lib/OrchidEngine.ts', 'w').write(content)
