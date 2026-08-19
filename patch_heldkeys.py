import re
content = open('src/lib/OrchidEngine.ts').read()

# Fix 1: retriggerHeldKeys should ignore fakeKeys
old_retrigger = """  public retriggerHeldKeys(skipBass: boolean = false, forcePlay: boolean = false) {
    const keysToRetrigger = Array.from(this.heldKeys.entries());
    
    for (const [pitch, velocity] of keysToRetrigger) {
      this.handleMidi(pitch, velocity, true, skipBass, true, forcePlay);
    }
  }"""

new_retrigger = """  public retriggerHeldKeys(skipBass: boolean = false, forcePlay: boolean = false) {
    const keysToRetrigger = Array.from(this.heldKeys.entries());
    
    for (const [pitch, velocity] of keysToRetrigger) {
      if (pitch <= 127) {
         this.handleMidi(pitch, velocity, true, skipBass, true, forcePlay);
      }
    }
  }"""

content = content.replace(old_retrigger, new_retrigger)

# Fix 2: getArpeggioPitches should use custom voicings if present
old_arp = """  public getArpeggioPitches(): number[] {
    let pitchClasses: number[] = [];

    if (this.params.keyboardMapping === 3) {
      // Free Mode: Real-time physical keys only, but project them across octaves!
      if (this.heldKeys.size === 0) return [];
      pitchClasses = Array.from(new Set(Array.from(this.heldKeys.keys()).map(p => p % 12))).sort((a, b) => a - b);
    } else {
      const mappedRoot = this.getMappedRootPitch(this.lastPerformanceKey);
      const intervals = this.getIntervalsForState(this.lastPerformanceKey);
      
      if (intervals.length === 0) {
        return [mappedRoot % 12];
      }

      for (const interval of intervals) {
        pitchClasses.push((mappedRoot + interval) % 12);
      }
      
      pitchClasses = Array.from(new Set(pitchClasses)).sort((a, b) => a - b);
    }
    return pitchClasses;
  }"""

new_arp = """  public getArpeggioPitches(): number[] {
    let pitchClasses: number[] = [];
    
    // 1. Check for custom voicings in heldKeys (fakeKeys >= 200)
    let customPitches: number[] = [];
    for (const [key, _] of this.heldKeys.entries()) {
       if (key >= 200 && this.activePitchesMemory[key]) {
          for (const note of this.activePitchesMemory[key]) {
             customPitches.push(note.pitch % 12);
          }
       }
    }
    if (customPitches.length > 0) {
       return Array.from(new Set(customPitches)).sort((a, b) => a - b);
    }

    if (this.params.keyboardMapping === 3) {
      // Free Mode: Real-time physical keys only
      if (this.heldKeys.size === 0) return [];
      let freeModePitches: number[] = [];
      for (const [key, _] of this.heldKeys.entries()) {
         if (key <= 127) {
            freeModePitches.push(key % 12);
         }
      }
      pitchClasses = Array.from(new Set(freeModePitches)).sort((a, b) => a - b);
    } else {
      const mappedRoot = this.getMappedRootPitch(this.lastPerformanceKey);
      const intervals = this.getIntervalsForState(this.lastPerformanceKey);
      
      if (intervals.length === 0) {
        return [mappedRoot % 12];
      }

      for (const interval of intervals) {
        pitchClasses.push((mappedRoot + interval) % 12);
      }
      
      pitchClasses = Array.from(new Set(pitchClasses)).sort((a, b) => a - b);
    }
    return pitchClasses;
  }"""

content = content.replace(old_arp, new_arp)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched Engine for Custom Voicing limits")
