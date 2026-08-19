import re
content = open('src/lib/OrchidEngine.ts').read()

eff_old = """    if (effectiveBaseType === -1 && this.params.keyboardMapping === 0) {
      if (this.ext_m7 || this.ext_M7 || this.ext_6 || this.ext_9 || this.params.alwaysAdd7th) {
        effectiveBaseType = 0;
      } else {
        return -1;
      }
    }"""
eff_new = """    if (effectiveBaseType === -1 && this.params.keyboardMapping === 0) {
      if (this.ext_m7) {
        effectiveBaseType = 1; // Minor
      } else if (this.ext_M7 || this.ext_6 || this.ext_9 || this.params.alwaysAdd7th) {
        effectiveBaseType = 0; // Major
      } else {
        return -1;
      }
    }"""
content = content.replace(eff_old, eff_new)

intervals_old = """    if (effectiveBaseType === -1 && this.params.keyboardMapping === 0) {
      if (!this.ext_m7 && !this.ext_M7 && !this.ext_6 && !this.ext_9 && !this.params.alwaysAdd7th) {
        return []; // Indicate pure single note
      }
      effectiveBaseType = 0; // Fallback to Major if extensions are pressed without base
    }"""
intervals_new = """    if (effectiveBaseType === -1 && this.params.keyboardMapping === 0) {
      if (!this.ext_m7 && !this.ext_M7 && !this.ext_6 && !this.ext_9 && !this.params.alwaysAdd7th) {
        return []; // Indicate pure single note
      }
      if (this.ext_m7) {
        effectiveBaseType = 1; // Minor fallback
      } else {
        effectiveBaseType = 0; // Major fallback
      }
    }"""
content = content.replace(intervals_old, intervals_new)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched base types")
