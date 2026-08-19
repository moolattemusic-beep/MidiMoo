import re
content = open('src/lib/OrchidEngine.ts').read()

# remove extraInversions from calculateFoldedPitches signature and body
calc_old1 = "private calculateFoldedPitches(rootPitch: number, intervals: number[], extraInversions: number = 0): number[] {"
calc_new1 = "private calculateFoldedPitches(rootPitch: number, intervals: number[]): number[] {"
content = content.replace(calc_old1, calc_new1)

calc_old2 = "const inv = this.params.chordInversion + extraInversions;"
calc_new2 = "const inv = this.params.chordInversion;"
content = content.replace(calc_old2, calc_new2)

# in handleMidi, calculate extraInversions and apply it to finalPitches AFTER they are created!
# Wait, I already added a block in handleMidi for customVoicing:
block_old = """    const extraInversions = this.params.inversionRepeat > 0 ? (this.consecutiveChordCount * this.params.inversionRepeat) : 0;

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

block_new = """    const extraInversions = this.params.inversionRepeat > 0 ? (this.consecutiveChordCount * this.params.inversionRepeat) : 0;

    if (customVoicing && customVoicing.length > 0) {
      finalPitches = [...customVoicing];
    } else if (intervals.length === 0) {
      finalPitches = [pitch];
      isSingleNote = true;
    } else {
      finalPitches = this.calculateFoldedPitches(mappedRoot, intervals);
    }
    
    // Apply Inversion Repeat Extra Inversions uniformly
    if (extraInversions > 0 && !isSingleNote) {
       for (let i = 0; i < extraInversions; i++) {
         if (finalPitches.length > 0) {
           finalPitches.sort((a,b) => a-b);
           finalPitches[0] += 12;
         }
       }
    }"""
content = content.replace(block_old, block_new)

open('src/lib/OrchidEngine.ts', 'w').write(content)
