import re

content = open('src/lib/OrchidEngine.ts').read()

old_setBaseType = """  public setBaseType(type: number) {
    this.manualBaseType = type;
    this.notifyState();
    this.retriggerHeldKeys();
  }"""

new_setBaseType = """  public get currentEffectiveBaseType(): number {
    let effectiveBaseType = -1;
    if (this.params.keyboardMapping === 2 && this.lastPerformanceKey !== undefined) {
      const pc = this.lastPerformanceKey % 12;
      const scaleData = this.getScaleData(pc, this.params.keyScale);
      effectiveBaseType = scaleData.type;
    } else if (this.params.keyboardMapping === 1) {
      effectiveBaseType = 0;
    }
    
    if (this.manualBaseType !== -1) {
      effectiveBaseType = this.manualBaseType;
    }
    
    if (effectiveBaseType === -1 && this.params.keyboardMapping === 0) {
      if (this.ext_m7 || this.ext_M7 || this.ext_6 || this.ext_9 || this.params.alwaysAdd7th) {
        effectiveBaseType = 0;
      } else {
        return -1;
      }
    }
    
    if (effectiveBaseType === -1) effectiveBaseType = 0;
    return effectiveBaseType;
  }

  public setBaseType(type: number) {
    this.manualBaseType = type;
    this.baseTypeLatched = false;
    this.lastUpdateReason = 'chord';
    this.notifyState();
    this.retriggerHeldKeys();
  }

  public releaseBaseType(type: number) {
    if (this.manualBaseType !== type) return;
    if (this.heldKeys.size > 0) {
      this.baseTypeLatched = true;
    } else {
      this.manualBaseType = -1;
      this.baseTypeLatched = false;
      this.lastUpdateReason = 'chord';
      this.notifyState();
      this.retriggerHeldKeys();
    }
  }"""

if old_setBaseType in content:
    content = content.replace(old_setBaseType, new_setBaseType)
    print("Replaced setBaseType")
else:
    print("setBaseType not found")

open('src/lib/OrchidEngine.ts', 'w').write(content)
