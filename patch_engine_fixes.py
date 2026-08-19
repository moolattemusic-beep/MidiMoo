import re

content = open('src/lib/OrchidEngine.ts').read()

# Fix 1: Free Mode XY Pad
old_arp = """  public getArpeggioPitches(): number[] {
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

new_arp = """  public getArpeggioPitches(): number[] {
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
    }"""
content = content.replace(old_arp, new_arp)

# Fix 2: calculateFoldedPitches logic for stable voice leading
old_calc = """    const scoredIntervals = intervals.map(interval => {
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
    }"""

new_calc = """    const scoredIntervals = intervals.map(interval => {
      // Deterministic scoring: base priority + tiebreaker favoring smaller intervals
      const score = this.getIntervalPriority(interval) + (100 - interval) / 100;
      return { interval, score };
    });

    scoredIntervals.sort((a, b) => b.score - a.score);
    const selectedIntervals = scoredIntervals.slice(0, targetNotes).map(s => s.interval).sort((a, b) => a - b);

    const inv = this.params.chordInversion;
    if (inv > 0) {
      for (let i = 0; i < inv; i++) {
        if (selectedIntervals.length > 0) {
          selectedIntervals[0] += 12;
          selectedIntervals.sort((a, b) => a - b);
        }
      }
    } else if (inv < 0) {
      for (let i = 0; i < Math.abs(inv); i++) {
        if (selectedIntervals.length > 0) {
          selectedIntervals[selectedIntervals.length - 1] -= 12;
          selectedIntervals.sort((a, b) => a - b);
        }
      }
    }

    const finalPitches: number[] = [];
    const rootPC = rootPitch % 12;
    const anchorPitch = startRange + ((rootPC - registerStartPC + 12) % 12);

    for (const interval of selectedIntervals) {
      let pitch = anchorPitch + interval;
      // Fold down if it exceeds range too much, but allow some natural extension bleed
      while (pitch > endRange && pitch >= startRange + 12) {
        pitch -= 12;
      }
      finalPitches.push(pitch);
    }
    
    let filteredPitches = finalPitches;"""

content = content.replace(old_calc, new_calc)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Applied fixes")
