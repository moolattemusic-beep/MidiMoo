import re
content = open('src/lib/OrchidEngine.ts').read()

old_block = """  private calculateFoldedPitches(rootPitch: number, intervals: number[]): number[] {
    const finalPitches: number[] = [];

    // Base folding based on chordRegisterStart
    const startRange = this.params.chordRegisterStart;
    const endRange = startRange + this.params.voicingRange;
    const registerStartPC = startRange % 12;
    
    for (let i = 0; i < intervals.length; i++) {
      const absolutePitchClass = (rootPitch + intervals[i]) % 12;
      let foldedPitch = startRange + ((absolutePitchClass - registerStartPC + 12) % 12);
      
      // Expand into multiple octaves if voicingRange allows it
      let currentPitch = foldedPitch;
      while (currentPitch <= endRange) {
        if (finalPitches.indexOf(currentPitch) === -1) {
          finalPitches.push(currentPitch);
        }
        currentPitch += 12;
      }
    }
    
    // Filter against voicing range BEFORE inversions
    let filteredPitches = finalPitches.filter(p => p >= startRange && p <= endRange);
    
    // Apply inversions on top of the folded starting pitch
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
  }"""

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

    // 1. Determine target number of notes based on density
    let minNotes = 4;
    let maxNotes = 6;
    const density = this.params.chordDensity ?? 4;
    if (density === 0) { minNotes = 3; maxNotes = 3; }
    else if (density === 1) { minNotes = 4; maxNotes = 4; }
    else if (density === 2) { minNotes = 5; maxNotes = 5; }
    else if (density === 3) { minNotes = 3; maxNotes = 5; }
    else if (density === 4) { minNotes = 4; maxNotes = 6; }
    
    // Pick random target between min and max
    let targetNotes = Math.floor(Math.random() * (maxNotes - minNotes + 1)) + minNotes;
    
    // If the chord has fewer pitch classes than targetNotes, cap it
    if (targetNotes > intervals.length) {
      targetNotes = intervals.length;
    }

    // 2. Select the top `targetNotes` pitch classes
    const scoredIntervals = intervals.map(interval => {
      const score = this.getIntervalPriority(interval) + Math.random() * 5;
      return { interval, score };
    });

    scoredIntervals.sort((a, b) => b.score - a.score);
    const selectedIntervals = scoredIntervals.slice(0, targetNotes).map(s => s.interval);

    // 3. Map each selected interval to a random octave within the voicing range
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

    // 4. Apply inversions
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
  }"""

if old_block in content:
    open('src/lib/OrchidEngine.ts', 'w').write(content.replace(old_block, new_block))
else:
    print("Failed to match old_block")

