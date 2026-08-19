import re
content = open('src/lib/OrchidEngine.ts').read()

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
        pitchClasses = [mappedRoot % 12];
      } else {
        pitchClasses = Array.from(new Set(intervals.map(i => (mappedRoot + i) % 12))).sort((a,b) => a-b);
      }
    }"""

new_arp = """  public getArpeggioPitches(): number[] {
    let pitchClasses: number[] = [];

    // Extract exact pitch classes from currently playing memory (mirrors Strumplate logic)
    let hasNotes = false;
    for (const [pitch, _] of this.heldKeys.entries()) {
      const memory = this.activePitchesMemory[pitch];
      if (memory) {
        for (const note of memory) {
          if (!note.isBass) {
            pitchClasses.push(note.pitch % 12);
            hasNotes = true;
          }
        }
      }
    }
    
    if (!hasNotes) return [];
    
    pitchClasses = Array.from(new Set(pitchClasses)).sort((a, b) => a - b);"""

content = content.replace(old_arp, new_arp)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched getArpeggioPitches")
