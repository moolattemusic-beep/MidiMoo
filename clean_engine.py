import re
content = open('src/lib/OrchidEngine.ts').read()

# Remove handleCustomVoicing and activeCustomVoicingNotes completely
bad_block = """  // Maps slotIndex -> array of pitches currently playing for that slot
  private activeCustomVoicingNotes: Map<number, { pitch: number, mpeChannel?: number }[]> = new Map();

  public handleCustomVoicing(pitches: number[], velocity: number, isDown: boolean, slotIndex: number) {
    const fakeKey = 200 + slotIndex;
    
    if (isDown) {
      // Release any previously playing voicing for this slot
      this.handleCustomVoicing([], 0, false, slotIndex);
      
      const newActive = [];
      const memoryNotes = [];
      const isSynthOnly = this.params.omnichordMode && !this.params.omnichordSynthMonitor;
      const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;

      for (const pitch of pitches) {
         const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
         this.emitNoteOn(pitch, velocity, 0, channel, isSynthOnly, isMidiOnly);
         newActive.push({ pitch, mpeChannel: channel });
         memoryNotes.push({ pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: pitch, mpeCurrentPitch: pitch, isInternalSynthOnly: isSynthOnly });
      }
      this.activeCustomVoicingNotes.set(slotIndex, newActive);
      
      // Hook into Strumplate
      this.heldKeys.set(fakeKey, velocity);
      this.activePitchesMemory[fakeKey] = memoryNotes;
      this.updateStrumplatePitches();
      
    } else {
      const active = this.activeCustomVoicingNotes.get(slotIndex);
      if (active) {
         const isSynthOnly = this.params.omnichordMode && !this.params.omnichordSynthMonitor;
         const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;
         
         for (const note of active) {
            this.emitNoteOff(note.pitch, 0, 0, note.mpeChannel, isSynthOnly, isMidiOnly);
            if (note.mpeChannel !== undefined) {
               this.freeMpeChannel(note.mpeChannel);
            }
         }
         this.activeCustomVoicingNotes.delete(slotIndex);
         
         // Remove from Strumplate
         this.heldKeys.delete(fakeKey);
         delete this.activePitchesMemory[fakeKey];
         this.updateStrumplatePitches();
      }
    }
  }"""
content = content.replace(bad_block, "")

# Restore getArpeggioPitches to just use activePitchesMemory like we updated last time
# Actually, wait... since we removed fake keys, we don't need any special fakeKey logic in getArpeggioPitches!
# In the last task, I already updated getArpeggioPitches to just read activePitchesMemory[pitch].
# That will still work perfectly for handleMidi!

# Let's verify getArpeggioPitches
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Cleaned Engine")
