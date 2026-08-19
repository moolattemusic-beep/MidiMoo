import re

content = open('src/lib/OrchidEngine.ts').read()

old_steal = """          if (closestPitch !== -1) {
            stolenNote = this.activePitchesMemory[closestPitch][0];
            this.activePitchesMemory[closestPitch] = [];
            this.physicallyReleasedKeys.delete(closestPitch);
          }"""

new_steal = """          if (closestPitch !== -1) {
            stolenNote = this.activePitchesMemory[closestPitch][0];
            this.activePitchesMemory[closestPitch] = [];
            this.physicallyReleasedKeys.delete(closestPitch);
            this.heldKeys.delete(closestPitch);
          }"""
content = content.replace(old_steal, new_steal)


old_perf = """        if (stolenNote) {
          const channel = stolenNote.mpeChannel ?? (this.params.mpeEnabled ? this.allocateMpeChannel() : undefined);
          const basePitch = stolenNote.mpeBasePitch ?? stolenNote.pitch;
          const currentPitch = stolenNote.mpeCurrentPitch ?? stolenNote.pitch;
          
          if (this.params.mpeEnabled && channel && !this.params.omnichordMode) {
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
          if (!this.params.omnichordMode) {
            this.emitNoteOn(pitch, velocity, 0, channel);
          }
          this.activePitchesMemory[pitch] = [{ pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: pitch, mpeCurrentPitch: pitch, isInternalSynthOnly: false }];
        }"""

new_perf = """        const isSynthOnly = this.params.omnichordMode && !forcePlay;
        if (stolenNote) {
          const channel = stolenNote.mpeChannel ?? (this.params.mpeEnabled ? this.allocateMpeChannel() : undefined);
          const basePitch = stolenNote.mpeBasePitch ?? stolenNote.pitch;
          const currentPitch = stolenNote.mpeCurrentPitch ?? stolenNote.pitch;
          
          if (this.params.mpeEnabled && channel) {
             this.emitMpePitchBend(channel, basePitch, currentPitch, pitch, 0);
          }
          this.emitNoteOn(pitch, velocity, 0, channel, isSynthOnly);
          
          this.activePitchesMemory[pitch] = [{
            ...stolenNote,
            pitch: pitch,
            mpeBasePitch: basePitch,
            mpeCurrentPitch: pitch,
            mpeChannel: channel,
            isInternalSynthOnly: isSynthOnly
          }];
        } else {
          const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
          this.emitNoteOn(pitch, velocity, 0, channel, isSynthOnly);
          this.activePitchesMemory[pitch] = [{ pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: pitch, mpeCurrentPitch: pitch, isInternalSynthOnly: isSynthOnly }];
        }"""

content = content.replace(old_perf, new_perf)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched performance keys")
