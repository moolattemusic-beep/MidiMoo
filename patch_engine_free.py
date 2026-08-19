import re
content = open('src/lib/OrchidEngine.ts').read()

old_logic = """    const controlLowBound = 24 + (this.params.controlOctave * 12);
    const controlHighBound = controlLowBound + 11;
    const isControlKey = pitch >= controlLowBound && pitch <= controlHighBound;

    if (!isOn || velocity === 0) {
      if (isControlKey) {"""

new_logic = """    const controlLowBound = 24 + (this.params.controlOctave * 12);
    const controlHighBound = controlLowBound + 11;
    const isControlKey = pitch >= controlLowBound && pitch <= controlHighBound;

    if (this.params.keyboardMapping === 3) {
      if (!isOn || velocity === 0) {
        if (this.sustainPedalActive) {
          this.physicallyReleasedKeys.add(pitch);
        } else {
          this.heldKeys.delete(pitch);
          if (this.activePitchesMemory[pitch]) {
            const notesToKill = this.activePitchesMemory[pitch];
            for (const note of notesToKill) {
              if (note.timeoutId) clearTimeout(note.timeoutId);
              else this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
              if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
            }
            delete this.activePitchesMemory[pitch];
          }
        }
        if (this.onPerformanceKey) this.onPerformanceKey(pitch, false, this.heldKeys.size === 0);
      } else {
        this.heldKeys.set(pitch, velocity);
        if (this.physicallyReleasedKeys.has(pitch)) {
          this.physicallyReleasedKeys.delete(pitch);
        }
        
        // Kill previous if re-triggered
        if (this.activePitchesMemory[pitch]) {
          const notesToKill = this.activePitchesMemory[pitch];
          for (const note of notesToKill) {
            if (note.timeoutId) clearTimeout(note.timeoutId);
            else this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
            if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
          }
        }

        const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
        this.emitNoteOn(pitch, velocity, 0, channel);
        this.activePitchesMemory[pitch] = [{ pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: pitch, mpeCurrentPitch: pitch }];
        
        if (this.onPerformanceKey) this.onPerformanceKey(pitch, true, false);
      }
      this.updateStrumplatePitches();
      return;
    }

    if (!isOn || velocity === 0) {
      if (isControlKey) {"""

content = content.replace(old_logic, new_logic)

open('src/lib/OrchidEngine.ts', 'w').write(content)
