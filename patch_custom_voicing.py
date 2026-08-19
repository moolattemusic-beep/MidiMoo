import re

content = open('src/lib/OrchidEngine.ts').read()

old_cv = """  public handleCustomVoicing(pitches: number[], velocity: number, isDown: boolean, slotIndex: number) {
    if (isDown) {
      // Release any previously playing voicing for this slot
      this.handleCustomVoicing([], 0, false, slotIndex);
      
      const newActive = [];
      const isSynthOnly = this.params.omnichordMode && !this.params.omnichordSynthMonitor;
      const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;

      for (const pitch of pitches) {
         const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
         this.emitNoteOn(pitch, velocity, 0, channel, isSynthOnly, isMidiOnly);
         newActive.push({ pitch, mpeChannel: channel });
      }
      this.activeCustomVoicingNotes.set(slotIndex, newActive);
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
      }
    }
  }"""

new_cv = """  public handleCustomVoicing(pitches: number[], velocity: number, isDown: boolean, slotIndex: number) {
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

content = content.replace(old_cv, new_cv)

# Now, add isMemoryTrigger flag to handleMidi
content = content.replace(
    "public handleMidi(pitch: number, velocity: number, isOn: boolean, skipBass: boolean = false, isUpdate: boolean = false, forcePlay: boolean = false) {",
    "public handleMidi(pitch: number, velocity: number, isOn: boolean, skipBass: boolean = false, isUpdate: boolean = false, forcePlay: boolean = false, isMemoryTrigger: boolean = false) {"
)

# Replace Free Mode check
content = content.replace(
    """    // In Free Mode, the whole keyboard is performance keys
    if (this.params.keyboardMapping === 3) {
      isControlKey = false;
    }
    
    if (isOn && velocity > 0 && !isUpdate && !isControlKey) {
       this.lastPerformanceKey = pitch;
    }

    if (this.params.keyboardMapping === 3) {""",
    """    // In Free Mode, the whole keyboard is performance keys
    let isFreeMode = this.params.keyboardMapping === 3 && !isMemoryTrigger;
    if (isFreeMode) {
      isControlKey = false;
    }
    
    if (isOn && velocity > 0 && !isUpdate && !isControlKey) {
       this.lastPerformanceKey = pitch;
    }

    if (isFreeMode) {"""
)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched handleCustomVoicing and handleMidi")
