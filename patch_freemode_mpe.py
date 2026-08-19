import re
content = open('src/lib/OrchidEngine.ts').read()

old_free_steal = """        const isSynthOnly = this.params.omnichordMode && !forcePlay;
        if (stolenNote) {
          const channel = stolenNote.mpeChannel ?? (this.params.mpeEnabled ? this.allocateMpeChannel() : undefined);
          const basePitch = stolenNote.mpeBasePitch ?? stolenNote.pitch;
          const currentPitch = stolenNote.mpeCurrentPitch ?? stolenNote.pitch;
          
          if (this.params.mpeEnabled && channel && !this.params.omnichordMode) {
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
        } else {"""

new_free_steal = """        const isSynthOnly = this.params.omnichordMode && !forcePlay;
        if (stolenNote) {
          const channel = stolenNote.mpeChannel ?? (this.params.mpeEnabled ? this.allocateMpeChannel() : undefined);
          const basePitch = stolenNote.mpeBasePitch ?? stolenNote.pitch;
          const currentPitch = stolenNote.mpeCurrentPitch ?? stolenNote.pitch;
          
          let nextBasePitch = basePitch;
          if (this.params.mpeEnabled && channel && !this.params.omnichordMode) {
             this.emitMpePitchBend(channel, basePitch, currentPitch, pitch, 0);
          } else {
             this.emitNoteOff(basePitch, 0, 0, channel, isSynthOnly);
             this.emitNoteOn(pitch, velocity, 0, channel, isSynthOnly);
             nextBasePitch = pitch;
          }
          
          this.activePitchesMemory[pitch] = [{
            ...stolenNote,
            pitch: pitch,
            mpeBasePitch: nextBasePitch,
            mpeCurrentPitch: pitch,
            mpeChannel: channel,
            isInternalSynthOnly: isSynthOnly
          }];
        } else {"""
        
content = content.replace(old_free_steal, new_free_steal)
open('src/lib/OrchidEngine.ts', 'w').write(content)
