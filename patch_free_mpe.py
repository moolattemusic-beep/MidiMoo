import re
content = open('src/lib/OrchidEngine.ts').read()

old_block = """      } else {
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
      }"""

new_block = """      } else {
        this.heldKeys.set(pitch, velocity);
        
        let stolenNote: any = null;
        
        if (this.params.mpeEnabled && this.sustainPedalActive) {
          let closestPitch = -1;
          let minDiff = 9999;
          
          for (const pk of this.physicallyReleasedKeys) {
            if (this.activePitchesMemory[pk] && this.activePitchesMemory[pk].length > 0) {
              const diff = Math.abs(pk - pitch);
              if (diff < minDiff) {
                minDiff = diff;
                closestPitch = pk;
              }
            }
          }
          
          if (closestPitch !== -1) {
            stolenNote = this.activePitchesMemory[closestPitch][0];
            this.activePitchesMemory[closestPitch] = [];
            this.physicallyReleasedKeys.delete(closestPitch);
          }
        }

        if (this.physicallyReleasedKeys.has(pitch)) {
          this.physicallyReleasedKeys.delete(pitch);
        }
        
        // Kill previous if re-triggered and not stolen
        if (this.activePitchesMemory[pitch] && this.activePitchesMemory[pitch].length > 0) {
          const notesToKill = this.activePitchesMemory[pitch];
          for (const note of notesToKill) {
            if (note.timeoutId) clearTimeout(note.timeoutId);
            else this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
            if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
          }
        }

        if (stolenNote) {
          const channel = stolenNote.mpeChannel ?? (this.params.mpeEnabled ? this.allocateMpeChannel() : undefined);
          const basePitch = stolenNote.mpeBasePitch ?? stolenNote.pitch;
          const currentPitch = stolenNote.mpeCurrentPitch ?? stolenNote.pitch;
          
          if (this.params.mpeEnabled && channel) {
             this.emitMpePitchBend(channel, basePitch, currentPitch, pitch, 0);
          }
          
          this.activePitchesMemory[pitch] = [{
            ...stolenNote,
            pitch: pitch,
            mpeBasePitch: basePitch,
            mpeCurrentPitch: pitch,
            mpeChannel: channel
          }];
        } else {
          const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
          this.emitNoteOn(pitch, velocity, 0, channel);
          this.activePitchesMemory[pitch] = [{ pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: pitch, mpeCurrentPitch: pitch }];
        }
        
        if (this.onPerformanceKey) this.onPerformanceKey(pitch, true, false);
      }"""

if old_block in content:
    content = content.replace(old_block, new_block)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched Free MPE Mode successfully")
else:
    print("Could not find exact text to patch")
