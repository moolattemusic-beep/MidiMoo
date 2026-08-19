import re
content = open('src/lib/OrchidEngine.ts').read()

old_logic = """    if (customVoicing && customVoicing.length > 0) {
      finalPitches = [...customVoicing];
    } else if (intervals.length === 0) {
      finalPitches = [pitch];
      isSingleNote = true;
    } else {
      finalPitches = this.calculateFoldedPitches(mappedRoot, intervals);"""

new_logic = """    const extraInversions = this.params.inversionRepeat > 0 ? (this.consecutiveChordCount * this.params.inversionRepeat) : 0;

    if (customVoicing && customVoicing.length > 0) {
      finalPitches = [...customVoicing];
      if (extraInversions > 0) {
         for (let i = 0; i < extraInversions; i++) {
           if (finalPitches.length > 0) {
             finalPitches.sort((a,b) => a-b);
             finalPitches[0] += 12;
           }
         }
      }
    } else if (intervals.length === 0) {
      finalPitches = [pitch];
      isSingleNote = true;
    } else {
      finalPitches = this.calculateFoldedPitches(mappedRoot, intervals, extraInversions);"""

content = content.replace(old_logic, new_logic)

old_strum_logic = """    if (this.params.strumDirection === 1) { // Down
      finalPitches.sort((a, b) => b - a);
    } else { // Up
      finalPitches.sort((a, b) => a - b);
    }"""

new_strum_logic = """    let currentDir = this.params.strumDirection;
    if (this.params.strumAlternate) {
       currentDir = this.alternateStrumState;
    } else if (currentDir === 2) {
       currentDir = Math.random() < 0.5 ? 0 : 1;
    }

    if (currentDir === 1) { // Down
      finalPitches.sort((a, b) => b - a);
    } else { // Up
      finalPitches.sort((a, b) => a - b);
    }
    
    if (this.params.strumDirection === 2 && !this.params.strumAlternate) {
       // Random shuffle
       for (let i = finalPitches.length - 1; i > 0; i--) {
           const j = Math.floor(Math.random() * (i + 1));
           [finalPitches[i], finalPitches[j]] = [finalPitches[j], finalPitches[i]];
       }
    }"""
content = content.replace(old_strum_logic, new_strum_logic)

open('src/lib/OrchidEngine.ts', 'w').write(content)
