import re
content = open('src/lib/OrchidEngine.ts').read()
old = """    if (effectiveBaseType === -1 && this.params.keyboardMapping === 0) {
      if (this.ext_m7) {
        effectiveBaseType = 1; // Minor
      } else if (this.ext_M7 || this.ext_6 || this.ext_9 || this.params.alwaysAdd7th) {
        effectiveBaseType = 0; // Major
      } else {
        return -1;
      }
    }
    
    if (effectiveBaseType === -1) effectiveBaseType = 0;
    return effectiveBaseType;"""

new = """    if (effectiveBaseType === -1 && this.params.keyboardMapping === 0) {
      if (this.ext_m7) {
        effectiveBaseType = 1; // Minor
      } else if (this.ext_M7 || this.ext_6 || this.ext_9 || this.params.alwaysAdd7th) {
        effectiveBaseType = 0; // Major
      } else {
        return -1;
      }
    }
    
    // Do NOT default to 0 if we legitimately have no base type in classic mode
    // Actually, keyboard mapping 1 or 2 already sets it above. 
    return effectiveBaseType;"""
content = content.replace(old, new)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched effectiveBaseType")
