import re

content = open('src/lib/OrchidEngine.ts').read()

old_arp = """  public getArpeggioPitches(): number[] {
    const mappedRoot = this.getMappedRootPitch(this.lastPerformanceKey);
    const intervals = this.getIntervalsForState(this.lastPerformanceKey);
    
    let pitchClasses: number[] = [];
    
    if (this.params.keyboardMapping === 0) {
      // Free Mode: Always arpeggiate the exact active pitches from memory
      const activePitches = new Set<number>();
      for (const [key, notes] of Object.entries(this.activePitchesMemory)) {
        notes.forEach(n => {
           if (!n.isBass) activePitches.add(n.pitch % 12);
        });
      }
      if (activePitches.size > 0) {
          pitchClasses = Array.from(activePitches).sort((a,b) => a-b);
      } else {
          pitchClasses = intervals.length === 0 ? [mappedRoot % 12] : Array.from(new Set(intervals.map(i => (mappedRoot + i) % 12))).sort((a,b) => a-b);
      }
    } else {
      if (intervals.length === 0) {
        pitchClasses = [mappedRoot % 12];
      } else {
        pitchClasses = Array.from(new Set(intervals.map(i => (mappedRoot + i) % 12))).sort((a,b) => a-b);
      }
    }
    
    const allNotes: number[] = [];
    for (let i = 0; i <= 127; i++) {
       if (pitchClasses.includes(i % 12)) {
          allNotes.push(i);
       }
    }
    
    const startReg = this.params.arpeggioRegisterStart ?? 48;
    const validNotes = allNotes.filter(n => n >= startReg);
    
    if (validNotes.length === 0) return [];
    
    const firstNote = validNotes[0];
    const numOctaves = this.params.arpeggioOctaves ?? 4;
    const maxPitch = firstNote + (numOctaves * 12);
    
    return validNotes.filter(n => n < maxPitch);
  }"""

new_arp = """  public getArpeggioPitches(): number[] {
    if (this.params.keyboardMapping === 0) {
      // Free Mode: Strictly only the currently physically held keys. No memory, no octaves.
      return Array.from(this.heldKeys.keys()).sort((a, b) => a - b);
    }

    const mappedRoot = this.getMappedRootPitch(this.lastPerformanceKey);
    const intervals = this.getIntervalsForState(this.lastPerformanceKey);
    
    let pitchClasses: number[] = [];
    
    if (intervals.length === 0) {
      pitchClasses = [mappedRoot % 12];
    } else {
      pitchClasses = Array.from(new Set(intervals.map(i => (mappedRoot + i) % 12))).sort((a,b) => a-b);
    }
    
    const allNotes: number[] = [];
    for (let i = 0; i <= 127; i++) {
       if (pitchClasses.includes(i % 12)) {
          allNotes.push(i);
       }
    }
    
    const startReg = this.params.arpeggioRegisterStart ?? 48;
    const validNotes = allNotes.filter(n => n >= startReg);
    
    if (validNotes.length === 0) return [];
    
    const firstNote = validNotes[0];
    const numOctaves = this.params.arpeggioOctaves ?? 4;
    const maxPitch = firstNote + (numOctaves * 12);
    
    return validNotes.filter(n => n < maxPitch);
  }"""

content = content.replace(old_arp, new_arp)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched Free Mode Arpeggiator")
