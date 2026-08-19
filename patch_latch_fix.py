import re

content = open('src/lib/OrchidEngine.ts').read()

new_method = """  private checkAndClearLatches() {
    if (this.heldKeys.size === 0 && this.physicallyReleasedKeys.size === 0) {
      let changed = false;
      if (this.baseTypeLatched) {
        this.manualBaseType = -1;
        this.baseTypeLatched = false;
        changed = true;
      }
      if (this.latchedExtensions.size > 0) {
        for (const ext of Array.from(this.latchedExtensions)) {
          this[`ext_${ext}` as any] = false;
        }
        this.latchedExtensions.clear();
        changed = true;
      }
      if (changed) {
        this.lastUpdateReason = 'chord';
        this.notifyState();
        this.retriggerHeldKeys(true);
      }
    }
  }

  public handleControlChange"""

content = content.replace("  public handleControlChange", new_method, 1)

old_cc = """        this.physicallyReleasedKeys.clear();
        this.updateStrumplatePitches();
      }
    }
  }"""

new_cc = """        this.physicallyReleasedKeys.clear();
        this.updateStrumplatePitches();
        this.checkAndClearLatches();
      }
    }
  }"""

content = content.replace(old_cc, new_cc, 1)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched latch fix")
