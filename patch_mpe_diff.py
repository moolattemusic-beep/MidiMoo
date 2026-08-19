import re

content = open('src/lib/OrchidEngine.ts').read()

old_mpe_diff = """      if (this.params.mpeEnabled) {
        oldChordNotes.sort((a, b) => a.pitch - b.pitch);
        finalPitches.sort((a, b) => a - b);
        
        for (let i = 0; i < Math.max(oldChordNotes.length, finalPitches.length); i++) {
          const oldNote = oldChordNotes[i];
          const newPitch = finalPitches[i];
          
          if (oldNote && newPitch !== undefined) {
            // Glide
            if (oldNote.pitch !== newPitch || oldNote.mpeCurrentPitch !== newPitch) {
              const basePitch = oldNote.mpeBasePitch ?? oldNote.pitch;
              const currentPitch = oldNote.mpeCurrentPitch ?? oldNote.pitch;
              const channel = oldNote.mpeChannel ?? this.allocateMpeChannel();
              
              this.emitMpePitchBend(channel, basePitch, currentPitch, newPitch, 0);
              newMemory.push({ ...oldNote, pitch: newPitch, mpeBasePitch: basePitch, mpeCurrentPitch: newPitch, mpeChannel: channel });
            } else {
              newMemory.push(oldNote);
            }
          } else if (oldNote && newPitch === undefined) {
            // Kill leftover old notes
            if (oldNote.timeoutId) clearTimeout(oldNote.timeoutId);
            else this.emitNoteOff(oldNote.mpeBasePitch ?? oldNote.pitch, 0, 0, oldNote.mpeChannel);
            if (oldNote.mpeChannel) this.freeMpeChannel(oldNote.mpeChannel);
          } else if (!oldNote && newPitch !== undefined) {
            // Trigger extra new notes
            const channel = this.allocateMpeChannel();
            if (!suppressImmediatePlay) this.emitNoteOn(newPitch, velocity, 0, channel);
            newMemory.push({ pitch: newPitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: newPitch, mpeCurrentPitch: newPitch });
          }
        }
      }"""

new_mpe_diff = """      if (this.params.mpeEnabled) {
        // Smart Diffing: Match exact pitches first, then glide leftovers
        let unmatchedOld = [...oldChordNotes];
        let unmatchedNew = [...finalPitches];
        
        // 1. Exact Matches (no glide needed)
        for (let i = unmatchedOld.length - 1; i >= 0; i--) {
          const oldNote = unmatchedOld[i];
          const exactMatchIdx = unmatchedNew.indexOf(oldNote.pitch);
          if (exactMatchIdx !== -1) {
            newMemory.push(oldNote);
            unmatchedOld.splice(i, 1);
            unmatchedNew.splice(exactMatchIdx, 1);
          }
        }
        
        // 2. Glide remaining notes (if any)
        unmatchedOld.sort((a, b) => a.pitch - b.pitch);
        unmatchedNew.sort((a, b) => a - b);
        
        for (let i = 0; i < Math.max(unmatchedOld.length, unmatchedNew.length); i++) {
          const oldNote = unmatchedOld[i];
          const newPitch = unmatchedNew[i];
          
          if (oldNote && newPitch !== undefined) {
            // Glide
            if (oldNote.pitch !== newPitch || oldNote.mpeCurrentPitch !== newPitch) {
              const basePitch = oldNote.mpeBasePitch ?? oldNote.pitch;
              const currentPitch = oldNote.mpeCurrentPitch ?? oldNote.pitch;
              const channel = oldNote.mpeChannel ?? this.allocateMpeChannel();
              this.emitMpePitchBend(channel, basePitch, currentPitch, newPitch, 0);
              newMemory.push({ ...oldNote, pitch: newPitch, mpeBasePitch: basePitch, mpeCurrentPitch: newPitch, mpeChannel: channel });
            } else {
              newMemory.push(oldNote);
            }
          } else if (oldNote && newPitch === undefined) {
            if (oldNote.timeoutId) clearTimeout(oldNote.timeoutId);
            else this.emitNoteOff(oldNote.mpeBasePitch ?? oldNote.pitch, 0, 0, oldNote.mpeChannel);
            if (oldNote.mpeChannel) this.freeMpeChannel(oldNote.mpeChannel);
          } else if (!oldNote && newPitch !== undefined) {
            const channel = this.allocateMpeChannel();
            if (!suppressImmediatePlay) this.emitNoteOn(newPitch, velocity, 0, channel);
            newMemory.push({ pitch: newPitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: newPitch, mpeCurrentPitch: newPitch });
          }
        }
      }"""

if old_mpe_diff in content:
    content = content.replace(old_mpe_diff, new_mpe_diff)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched MPE Diff")
else:
    print("MPE Diff not found")
