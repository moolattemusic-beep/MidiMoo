import re
content = open('src/lib/OrchidEngine.ts').read()

old_free_steal_2 = """          let nextBasePitch = basePitch;
          if (this.params.mpeEnabled && channel && !this.params.omnichordMode) {
             this.emitMpePitchBend(channel, basePitch, currentPitch, pitch, 0);
          } else {
             this.emitNoteOff(basePitch, 0, 0, channel, isSynthOnly);
             this.emitNoteOn(pitch, velocity, 0, channel, isSynthOnly);
             nextBasePitch = pitch;
          }"""

new_free_steal_2 = """          let nextBasePitch = basePitch;
          if (this.params.mpeEnabled && channel && !this.params.omnichordMode && basePitch !== pitch) {
             // Real MPE Glide
             this.emitMpePitchBend(channel, basePitch, currentPitch, pitch, 0);
          } else {
             // Same note re-trigger OR non-MPE: kill old envelope, start new
             this.emitNoteOff(basePitch, 0, 0, channel, isSynthOnly);
             this.emitNoteOn(pitch, velocity, 0, channel, isSynthOnly);
             nextBasePitch = pitch;
          }"""
          
content = content.replace(old_free_steal_2, new_free_steal_2)
open('src/lib/OrchidEngine.ts', 'w').write(content)
