import re
content = open('src/lib/OrchidEngine.ts').read()

old_arp_gen = """  public getArpeggioPitches(): number[] {
    const mappedRoot = this.getMappedRootPitch(this.lastPerformanceKey);
    const intervals = this.getIntervalsForState(this.lastPerformanceKey);
    
    let basePitches: number[];
    if (intervals.length === 0) {
      basePitches = [this.lastPerformanceKey];
    } else {
      basePitches = this.calculateFoldedPitches(mappedRoot, intervals);
    }
    
    // Base pitches are usually within a 1 or 2 octave range.
    const lowestPitch = Math.min(...basePitches);
    
    // Normalize basePitches to the lowest octave (starting at 0 for relative)
    const relativePitches = basePitches.map(p => p - lowestPitch).sort((a,b) => a-b);
    
    // Generate configured octaves
    const result: number[] = [];
    const baseOctave = Math.floor(lowestPitch / 12) * 12; // Start from the nearest C below or equal
    const actualStart = lowestPitch;
    const numOctaves = this.params.arpeggioOctaves || 4;
    
    for (let oct = 0; oct < numOctaves; oct++) {
      for (const rp of relativePitches) {
        const pitch = actualStart + (oct * 12) + rp;
        if (pitch <= 127 && !result.includes(pitch)) {
          result.push(pitch);
        }
      }
    }
    
    return result.sort((a,b) => a-b);
  }"""

new_arp_gen = """  public getArpeggioPitches(): number[] {
    const mappedRoot = this.getMappedRootPitch(this.lastPerformanceKey);
    const intervals = this.getIntervalsForState(this.lastPerformanceKey);
    
    // Get unique pitch classes strictly based on intervals
    let pitchClasses: number[] = [];
    if (intervals.length === 0) {
      pitchClasses = [0];
    } else {
      pitchClasses = Array.from(new Set(intervals.map(i => i % 12))).sort((a,b) => a-b);
    }
    
    const result: number[] = [];
    // Start strictly from the root pitch
    const actualStart = mappedRoot;
    const numOctaves = this.params.arpeggioOctaves || 4;
    
    for (let oct = 0; oct < numOctaves; oct++) {
      for (const pc of pitchClasses) {
        const pitch = actualStart + (oct * 12) + pc;
        if (pitch <= 127 && !result.includes(pitch)) {
          result.push(pitch);
        }
      }
    }
    
    return result.sort((a,b) => a-b);
  }"""

if old_arp_gen in content:
    content = content.replace(old_arp_gen, new_arp_gen)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched arpeggio to be purely linear")
else:
    print("Failed to patch arpeggio linear")
