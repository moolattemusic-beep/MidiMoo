import re
content = open('src/lib/OrchidEngine.ts').read()

# I need to find the whole block to rewrite it correctly
bad_block = """    if (customVoicing && customVoicing.length > 0) {
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
    }

      // Apply Voicing Mutation
      finalPitches.sort((a, b) => a - b);
      const voicing = this.pickVoicing();
      if (voicing === 'Drop 2' && finalPitches.length >= 2) {
        finalPitches[finalPitches.length - 2] -= 12;
      } else if (voicing === 'Drop 3' && finalPitches.length >= 3) {
        finalPitches[finalPitches.length - 3] -= 12;
      } else if (voicing === 'Drop 4' && finalPitches.length >= 4) {
        finalPitches[finalPitches.length - 4] -= 12;
      } else if (voicing === 'Open' && finalPitches.length >= 3) {
        if (finalPitches.length >= 2) finalPitches[finalPitches.length - 2] -= 12;
        if (finalPitches.length >= 4) finalPitches[finalPitches.length - 4] -= 12;
      }
      // Clamp to minimum MIDI pitch and filter out drops below startRange (but allow inversions to exceed endRange)
      const startRange = this.params.chordRegisterStart;
      finalPitches = finalPitches.filter(p => p >= startRange && p <= 127).map(p => Math.max(0, p));
    }"""

good_block = """    if (customVoicing && customVoicing.length > 0) {
      finalPitches = [...customVoicing];
    } else if (intervals.length === 0) {
      finalPitches = [pitch];
      isSingleNote = true;
    } else {
      finalPitches = this.calculateFoldedPitches(mappedRoot, intervals);

      // Apply Voicing Mutation (only to generated chords)
      finalPitches.sort((a, b) => a - b);
      const voicing = this.pickVoicing();
      if (voicing === 'Drop 2' && finalPitches.length >= 2) {
        finalPitches[finalPitches.length - 2] -= 12;
      } else if (voicing === 'Drop 3' && finalPitches.length >= 3) {
        finalPitches[finalPitches.length - 3] -= 12;
      } else if (voicing === 'Drop 4' && finalPitches.length >= 4) {
        finalPitches[finalPitches.length - 4] -= 12;
      } else if (voicing === 'Open' && finalPitches.length >= 3) {
        if (finalPitches.length >= 2) finalPitches[finalPitches.length - 2] -= 12;
        if (finalPitches.length >= 4) finalPitches[finalPitches.length - 4] -= 12;
      }
      // Clamp to minimum MIDI pitch and filter out drops below startRange (but allow inversions to exceed endRange)
      const startRange = this.params.chordRegisterStart;
      finalPitches = finalPitches.filter(p => p >= startRange && p <= 127).map(p => Math.max(0, p));
    }
    
    // Apply Inversion Repeat Extra Inversions uniformly (to both custom voicings and generated chords)
    if (extraInversions > 0 && !isSingleNote) {
       for (let i = 0; i < extraInversions; i++) {
         if (finalPitches.length > 0) {
           finalPitches.sort((a,b) => a-b);
           finalPitches[0] += 12;
         }
       }
    }"""
content = content.replace(bad_block, good_block)

# Let's fix the CC mapping
cc_old = """    if (cc === 127 && channel === 8) {
      if (this.params.omnichordMode || this.sustainPedalActive) {
        this.handleStrumplate(value);
      } else {
        const inversionSteps = 16;
        const newInversion = Math.round((value / 127) * inversionSteps);
        this.params.chordInversion = newInversion;
        if (this.onParamsUpdate) this.onParamsUpdate({ ...this.params });
      }
      return;
    }"""

cc_new = """    if (cc === 127 && channel === 8) {
      if (this.params.omnichordMode || this.sustainPedalActive) {
        this.handleStrumplate(value);
      } else {
        const rangeStart = 24;
        const rangeEnd = 96;
        const newStart = Math.round(rangeStart + (value / 127) * (rangeEnd - rangeStart));
        this.updateRegister(newStart);
        if (this.onParamsUpdate) this.onParamsUpdate({ ...this.params });
      }
      return;
    }"""
content = content.replace(cc_old, cc_new)

open('src/lib/OrchidEngine.ts', 'w').write(content)
