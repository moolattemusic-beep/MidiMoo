import re
content = open('src/lib/OrchidEngine.ts').read()

diff_logic = """      // Handle Chord Diff
      const oldChordNotes = oldMemory.filter(n => !n.isBass);
      const oldChordPitches = oldChordNotes.map(n => n.pitch);

      if (this.params.mpeEnabled) {
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
      } else {
        for (const oldNote of oldChordNotes) {
          if (!finalPitches.includes(oldNote.pitch)) {
            if (oldNote.timeoutId) clearTimeout(oldNote.timeoutId);
            else this.emitNoteOff(oldNote.pitch, 0, 0);
          } else {
            newMemory.push(oldNote);
          }
        }

        for (const newPitch of finalPitches) {
          if (!oldChordPitches.includes(newPitch)) {
            if (!suppressImmediatePlay) {
              this.emitNoteOn(newPitch, velocity, 0); // Updates happen instantly
            }
            newMemory.push({ pitch: newPitch, delayUsed: 0, isBass: false });
          }
        }
      }"""

# Use regex to find the old diff logic
content = re.sub(r'      // Handle Chord Diff\n      const oldChordNotes = oldMemory\.filter\(n => !n\.isBass\);\n      const oldChordPitches = oldChordNotes\.map\(n => n\.pitch\);\n\n      for \(const oldNote of oldChordNotes\) \{.*?\n      \}', diff_logic, content, flags=re.DOTALL)
open('src/lib/OrchidEngine.ts', 'w').write(content)
