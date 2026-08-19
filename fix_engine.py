import re
content = open('src/lib/OrchidEngine.ts').read()

start = content.find('  private calculateFoldedPitches')
end = content.find('  private recalculateActiveChords() {')

if start != -1 and end != -1:
    new_block = """  private getIntervalPriority(interval: number): number {
    const pc = interval % 12;
    if (pc === 0) return 100; // Root
    if (pc === 3 || pc === 4) return 90; // 3rd
    if (pc === 10 || pc === 11) return 80; // 7th
    if (pc === 7) return 50; // 5th
    return 40 - interval; // Higher intervals have slightly lower base priority
  }

  private calculateFoldedPitches(rootPitch: number, intervals: number[]): number[] {
    const startRange = this.params.chordRegisterStart;
    const endRange = startRange + this.params.voicingRange;
    const registerStartPC = startRange % 12;

    let minNotes = 4;
    let maxNotes = 6;
    const density = this.params.chordDensity ?? 4;
    if (density === 0) { minNotes = 3; maxNotes = 3; }
    else if (density === 1) { minNotes = 4; maxNotes = 4; }
    else if (density === 2) { minNotes = 5; maxNotes = 5; }
    else if (density === 3) { minNotes = 3; maxNotes = 5; }
    else if (density === 4) { minNotes = 4; maxNotes = 6; }
    
    let targetNotes = Math.floor(Math.random() * (maxNotes - minNotes + 1)) + minNotes;
    
    if (targetNotes > intervals.length) {
      targetNotes = intervals.length;
    }

    const scoredIntervals = intervals.map(interval => {
      const score = this.getIntervalPriority(interval) + Math.random() * 5;
      return { interval, score };
    });

    scoredIntervals.sort((a, b) => b.score - a.score);
    const selectedIntervals = scoredIntervals.slice(0, targetNotes).map(s => s.interval);

    const finalPitches: number[] = [];
    for (const interval of selectedIntervals) {
      const absolutePitchClass = (rootPitch + interval) % 12;
      let lowestPitchInRange = startRange + ((absolutePitchClass - registerStartPC + 12) % 12);
      
      const validOctaves: number[] = [];
      let currentPitch = lowestPitchInRange;
      while (currentPitch <= endRange) {
        validOctaves.push(currentPitch);
        currentPitch += 12;
      }

      if (validOctaves.length > 0) {
        const pickedPitch = validOctaves[Math.floor(Math.random() * validOctaves.length)];
        finalPitches.push(pickedPitch);
      } else {
        finalPitches.push(lowestPitchInRange);
      }
    }

    let filteredPitches = finalPitches;
    const inv = this.params.chordInversion;
    if (inv > 0) {
      for (let i = 0; i < inv; i++) {
        if (filteredPitches.length > 0) {
          filteredPitches.sort((a, b) => a - b);
          filteredPitches[0] += 12;
        }
      }
    } else if (inv < 0) {
      for (let i = 0; i < Math.abs(inv); i++) {
        if (filteredPitches.length > 0) {
          filteredPitches.sort((a, b) => a - b);
          filteredPitches[filteredPitches.length - 1] -= 12;
        }
      }
    }

    return filteredPitches;
  }

"""
    content = content[:start] + new_block + content[end:]
    open('src/lib/OrchidEngine.ts', 'w').write(content)
else:
    print("Could not find blocks")

