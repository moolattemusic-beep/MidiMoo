import re

content = open('src/lib/OrchidEngine.ts').read()

# Fix 1: getArpeggioPitches in Free Mode
old_arp = """  public getArpeggioPitches(): number[] {
    const mappedRoot = this.getMappedRootPitch(this.lastPerformanceKey);
    const intervals = this.getIntervalsForState(this.lastPerformanceKey);
    
    // Get unique pitch classes strictly based on intervals
    let pitchClasses: number[] = [];
    if (intervals.length === 0) {
      pitchClasses = [mappedRoot % 12];
    } else {
      pitchClasses = Array.from(new Set(intervals.map(i => (mappedRoot + i) % 12))).sort((a,b) => a-b);
    }"""

new_arp = """  public getArpeggioPitches(): number[] {
    const mappedRoot = this.getMappedRootPitch(this.lastPerformanceKey);
    const intervals = this.getIntervalsForState(this.lastPerformanceKey);
    
    // Get unique pitch classes strictly based on intervals
    let pitchClasses: number[] = [];
    if (intervals.length === 0) {
      if (this.params.keyboardMapping === 0) {
        // In free mode without modifiers, just arpeggiate exactly the active pitches!
        const activePitches = new Set<number>();
        for (const [key, notes] of Object.entries(this.activePitchesMemory)) {
          notes.forEach(n => {
             if (!n.isBass) activePitches.add(n.pitch % 12);
          });
        }
        if (activePitches.size > 0) {
            pitchClasses = Array.from(activePitches).sort((a,b) => a-b);
        } else {
            pitchClasses = [mappedRoot % 12];
        }
      } else {
        pitchClasses = [mappedRoot % 12];
      }
    } else {
      pitchClasses = Array.from(new Set(intervals.map(i => (mappedRoot + i) % 12))).sort((a,b) => a-b);
    }"""

content = content.replace(old_arp, new_arp)

# Fix 2: calculateFoldedPitches extension boost
old_calc = """    let maxNotes = 6;
    const density = this.params.chordDensity ?? 4;
    if (density === 0) { maxNotes = 3; }
    else if (density === 1) { maxNotes = 4; }
    else if (density === 2) { maxNotes = 5; }
    else if (density === 3) { maxNotes = 5; }
    else if (density === 4) { maxNotes = 6; }
    
    let targetNotes = maxNotes;
    if (targetNotes > intervals.length) {
      targetNotes = intervals.length;
    }"""

new_calc = """    let maxNotes = 6;
    const density = this.params.chordDensity ?? 4;
    if (density === 0) { maxNotes = 3; }
    else if (density === 1) { maxNotes = 4; }
    else if (density === 2) { maxNotes = 5; }
    else if (density === 3) { maxNotes = 5; }
    else if (density === 4) { maxNotes = 6; }
    
    let extensionBoost = 0;
    if (this.ext_m7) extensionBoost++;
    if (this.ext_M7) extensionBoost++;
    if (this.ext_6) extensionBoost++;
    if (this.ext_9) extensionBoost++;
    if (this.ext_alt) extensionBoost++;
    
    let targetNotes = maxNotes + extensionBoost;
    if (targetNotes > intervals.length) {
      targetNotes = intervals.length;
    }"""

content = content.replace(old_calc, new_calc)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched Engine")
