import re
content = open('src/lib/OrchidEngine.ts').read()

old_strumplate = """        if (i !== this.lastStrumIndex) {
          const noteObj = this.strumplatePitches[i];
          
          let channel: number | undefined = undefined;
          let existing: any = null;
          const memory = this.activePitchesMemory[noteObj.sourceKey];"""

new_strumplate = """        if (i !== this.lastStrumIndex) {
          const noteObj = this.strumplatePitches[i];
          if (!noteObj) continue; // Prevent out-of-bounds access if strumplatePitches shrunk
          
          let channel: number | undefined = undefined;
          let existing: any = null;
          const memory = this.activePitchesMemory[noteObj.sourceKey];"""

content = content.replace(old_strumplate, new_strumplate)

# We should also do it for the "First touch" block just in case, though it shouldn't happen.
old_first_touch = """    } else if (this.lastStrumIndex === -1) {
      // First touch
      const noteObj = this.strumplatePitches[currIndex];
      
      let channel: number | undefined = undefined;
      let existing: any = null;
      const memory = this.activePitchesMemory[noteObj.sourceKey];"""

new_first_touch = """    } else if (this.lastStrumIndex === -1) {
      // First touch
      const noteObj = this.strumplatePitches[currIndex];
      if (!noteObj) return; // Prevent out-of-bounds access
      
      let channel: number | undefined = undefined;
      let existing: any = null;
      const memory = this.activePitchesMemory[noteObj.sourceKey];"""
      
content = content.replace(old_first_touch, new_first_touch)

open('src/lib/OrchidEngine.ts', 'w').write(content)
