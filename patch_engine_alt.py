import re
content = open('src/lib/OrchidEngine.ts').read()

old_logic = """    if (effectiveBaseType === 0) intervals.push(4, 7); // Major
    if (effectiveBaseType === 1) intervals.push(3, 7); // Minor
    if (effectiveBaseType === 2) intervals.push(5, 7); // Quartal/Sus style based on script
    if (effectiveBaseType === 3) intervals.push(3, 6); // Diminished

    const always7 = this.params.alwaysAdd7th;
    let active_m7 = this.ext_m7;
    let active_M7 = this.ext_M7;

    if (always7) {
      if (!this.ext_m7 && !this.ext_M7) {
        if (diatonicSeventh === 'M7') active_M7 = true;
        else if (diatonicSeventh === 'm7') active_m7 = true;
        else if (effectiveBaseType !== 3) {
          if (effectiveBaseType === 0) active_M7 = true;
          else active_m7 = true;
        }
      }
    }

    if (active_m7) intervals.push(10);
    if (active_M7) intervals.push(11);
    if (this.ext_6) intervals.push(9);
    if (this.ext_9) intervals.push(14);"""

new_logic = """    if (effectiveBaseType === 0) intervals.push(4, 7); // Major
    if (effectiveBaseType === 1) intervals.push(3, 7); // Minor
    if (effectiveBaseType === 2) intervals.push(5, 7); // Quartal/Sus style based on script
    
    const isDominant = effectiveBaseType === 3 && this.ext_alt;
    if (effectiveBaseType === 3) {
      if (isDominant) intervals.push(4, 7); // Dominant Triad
      else intervals.push(3, 6); // Diminished Triad
    }

    if (isDominant) {
      intervals.push(10); // Dominant implies b7
      if (this.ext_m7) intervals.push(13); // b9
      if (this.ext_M7) intervals.push(15); // #9
      if (this.ext_6) intervals.push(20);  // b13
      if (this.ext_9) intervals.push(22);  // #13
    } else {
      const always7 = this.params.alwaysAdd7th;
      let active_m7 = this.ext_m7;
      let active_M7 = this.ext_M7;

      if (always7) {
        if (!this.ext_m7 && !this.ext_M7) {
          if (diatonicSeventh === 'M7') active_M7 = true;
          else if (diatonicSeventh === 'm7') active_m7 = true;
          else if (effectiveBaseType !== 3) {
            if (effectiveBaseType === 0) active_M7 = true;
            else active_m7 = true;
          }
        }
      }

      if (active_m7) intervals.push(10);
      if (active_M7) intervals.push(11);
      if (this.ext_6) intervals.push(9);
      if (this.ext_9) intervals.push(14);
    }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched intervals for dominant logic")
else:
    print("Failed to patch intervals")
