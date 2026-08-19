import re

content = open('src/lib/OrchidEngine.ts').read()

old_calc = """  private calculateFoldedPitches(rootPitch: number, intervals: number[]): number[] {
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
    }"""

new_calc = """  private calculateFoldedPitches(rootPitch: number, intervals: number[]): number[] {
    const startRange = this.params.chordRegisterStart;
    const endRange = startRange + this.params.voicingRange;
    const registerStartPC = startRange % 12;

    let maxNotes = 6;
    const density = this.params.chordDensity ?? 4;
    if (density === 0) { maxNotes = 3; }
    else if (density === 1) { maxNotes = 4; }
    else if (density === 2) { maxNotes = 5; }
    else if (density === 3) { maxNotes = 5; }
    else if (density === 4) { maxNotes = 6; }
    
    let targetNotes = maxNotes;
    if (targetNotes > intervals.length) {
      targetNotes = intervals.length;
    }

    const scoredIntervals = intervals.map(interval => {
      // Deterministic scoring: base priority + tiebreaker favoring smaller intervals
      const score = this.getIntervalPriority(interval) + (100 - interval) / 100;
      return { interval, score };
    });

    scoredIntervals.sort((a, b) => b.score - a.score);
    const selectedIntervals = scoredIntervals.slice(0, targetNotes).map(s => s.interval);

    const finalPitches: number[] = [];
    for (const interval of selectedIntervals) {
      const absolutePitchClass = (rootPitch + interval) % 12;
      let lowestPitchInRange = startRange + ((absolutePitchClass - registerStartPC + 12) % 12);
      
      // We will deterministically pick the lowest valid pitch in the range
      if (lowestPitchInRange <= endRange) {
        finalPitches.push(lowestPitchInRange);
      } else {
        finalPitches.push(lowestPitchInRange);
      }
    }"""

if old_calc in content:
    content = content.replace(old_calc, new_calc)
    print("Patched calculateFoldedPitches")
else:
    print("Could not find calculateFoldedPitches")
open('src/lib/OrchidEngine.ts', 'w').write(content)
