import re
content = open('src/lib/OrchidEngine.ts').read()

old_glide = """            // Glide
            if (oldNote.pitch !== newPitch || oldNote.mpeCurrentPitch !== newPitch) {
              const basePitch = oldNote.mpeBasePitch ?? oldNote.pitch;
              const currentPitch = oldNote.mpeCurrentPitch ?? oldNote.pitch;
              const channel = oldNote.mpeChannel ?? this.allocateMpeChannel();
                 
              this.emitMpePitchBend(channel, basePitch, currentPitch, newPitch, 0);
              newMemory.push({ ...oldNote, pitch: newPitch, mpeBasePitch: basePitch, mpeCurrentPitch: newPitch, mpeChannel: channel });"""

new_glide = """            // Glide
            if (oldNote.pitch !== newPitch || oldNote.mpeCurrentPitch !== newPitch) {
              const basePitch = oldNote.mpeBasePitch ?? oldNote.pitch;
              const currentPitch = oldNote.mpeCurrentPitch ?? oldNote.pitch;
              const channel = oldNote.mpeChannel ?? this.allocateMpeChannel();
                 
              this.emitMpePitchBend(channel, basePitch, currentPitch, newPitch, 0);
              
              if (this.lastUpdateReason === 'inversion' && this.params.velGlideInversion > 0) {
                this.emitMpeExpression(channel, 127 - this.params.velGlideInversion);
              } else if (this.lastUpdateReason === 'chord' && this.params.velGlideChord > 0) {
                this.emitMpeExpression(channel, 127 - this.params.velGlideChord);
              }
              
              newMemory.push({ ...oldNote, pitch: newPitch, mpeBasePitch: basePitch, mpeCurrentPitch: newPitch, mpeChannel: channel });"""

content = content.replace(old_glide, new_glide)
open('src/lib/OrchidEngine.ts', 'w').write(content)
