import re
content = open('src/lib/OrchidEngine.ts').read()

old_bass = """      // Handle Bass Diff
      if (bassSetting > 0 && bassPitch >= 0) {
        const existingBass = oldMemory.find(n => n.isBass);
        if (existingBass && existingBass.pitch === bassPitch) {
          newMemory.push(existingBass);
        } else {
          if (existingBass && !skipBass) {
            if (existingBass.timeoutId) clearTimeout(existingBass.timeoutId);
            else this.emitNoteOff(existingBass.mpeBasePitch ?? existingBass.pitch, 0, 0, existingBass.mpeChannel);
            if (existingBass.mpeChannel) this.freeMpeChannel(existingBass.mpeChannel);
          }
          if (!skipBass || !existingBass) {
            if (!suppressImmediatePlay) {
              this.emitNoteOn(bassPitch, velocity, 0);
            }
            newMemory.push({ pitch: bassPitch, delayUsed: 0, isBass: true });
          } else {
            if (existingBass) newMemory.push(existingBass);
          }
        }
      } else if (bassSetting === 0) {
        const existingBass = oldMemory.find(n => n.isBass);
        if (existingBass) {
          if (existingBass.timeoutId) clearTimeout(existingBass.timeoutId);
          else this.emitNoteOff(existingBass.mpeBasePitch ?? existingBass.pitch, 0, 0, existingBass.mpeChannel);
          if (existingBass.mpeChannel) this.freeMpeChannel(existingBass.mpeChannel);
        }
      }"""

new_bass = """      // Handle Bass Diff
      if (bassSetting > 0 && bassPitch >= 0) {
        const existingBass = oldMemory.find(n => n.isBass);
        
        if (this.params.mpeEnabled && existingBass && !skipBass) {
          if (existingBass.pitch !== bassPitch || existingBass.mpeCurrentPitch !== bassPitch) {
            const basePitch = existingBass.mpeBasePitch ?? existingBass.pitch;
            const currentPitch = existingBass.mpeCurrentPitch ?? existingBass.pitch;
            const channel = existingBass.mpeChannel ?? this.allocateMpeChannel();
            
            this.emitMpePitchBend(channel, basePitch, currentPitch, bassPitch, 0);
            newMemory.push({ ...existingBass, pitch: bassPitch, mpeBasePitch: basePitch, mpeCurrentPitch: bassPitch, mpeChannel: channel });
          } else {
            newMemory.push(existingBass);
          }
        } else {
          if (existingBass && existingBass.pitch === bassPitch) {
            newMemory.push(existingBass);
          } else {
            if (existingBass && !skipBass) {
              if (existingBass.timeoutId) clearTimeout(existingBass.timeoutId);
              else this.emitNoteOff(existingBass.mpeBasePitch ?? existingBass.pitch, 0, 0, existingBass.mpeChannel);
              if (existingBass.mpeChannel) this.freeMpeChannel(existingBass.mpeChannel);
            }
            if (!skipBass || !existingBass) {
              const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
              if (!suppressImmediatePlay) {
                this.emitNoteOn(bassPitch, velocity, 0, channel);
              }
              newMemory.push({ pitch: bassPitch, delayUsed: 0, isBass: true, mpeChannel: channel, mpeBasePitch: bassPitch, mpeCurrentPitch: bassPitch });
            } else {
              if (existingBass) newMemory.push(existingBass);
            }
          }
        }
      } else if (bassSetting === 0) {
        const existingBass = oldMemory.find(n => n.isBass);
        if (existingBass) {
          if (existingBass.timeoutId) clearTimeout(existingBass.timeoutId);
          else this.emitNoteOff(existingBass.mpeBasePitch ?? existingBass.pitch, 0, 0, existingBass.mpeChannel);
          if (existingBass.mpeChannel) this.freeMpeChannel(existingBass.mpeChannel);
        }
      }"""

content = content.replace(old_bass, new_bass)
open('src/lib/OrchidEngine.ts', 'w').write(content)
