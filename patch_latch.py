import re

content = open('src/lib/OrchidEngine.ts').read()

old_pedal = """  public setSustainPedal(active: boolean) {
    this.sustainPedalActive = active;
    if (!active) {
      for (const pitch of this.physicallyReleasedKeys) {
        if (this.activePitchesMemory[pitch]) {
          const notesToKill = this.activePitchesMemory[pitch];
          for (const note of notesToKill) {
            if (note.timeoutId) clearTimeout(note.timeoutId);
            else this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
            if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
          }
          delete this.activePitchesMemory[pitch];
        }
      }
      this.physicallyReleasedKeys.clear();
      this.updateStrumplatePitches();
    }
  }"""

new_pedal = """  private checkAndClearLatches() {
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

  public setSustainPedal(active: boolean) {
    this.sustainPedalActive = active;
    if (!active) {
      for (const pitch of this.physicallyReleasedKeys) {
        if (this.activePitchesMemory[pitch]) {
          const notesToKill = this.activePitchesMemory[pitch];
          for (const note of notesToKill) {
            if (note.timeoutId) clearTimeout(note.timeoutId);
            else this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
            if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
          }
          delete this.activePitchesMemory[pitch];
        }
      }
      this.physicallyReleasedKeys.clear();
      this.updateStrumplatePitches();
      this.checkAndClearLatches();
    }
  }"""

content = content.replace(old_pedal, new_pedal)

old_noteoff = """      if (this.sustainPedalActive && !isControlKey) {
        this.physicallyReleasedKeys.add(pitch);
      } else {
        if (this.activePitchesMemory[pitch]) {
          const notesToKill = this.activePitchesMemory[pitch];
          for (const note of notesToKill) {
            if (note.timeoutId) {
              clearTimeout(note.timeoutId);
            } else {
              this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
            }
            if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
          }
          delete this.activePitchesMemory[pitch];
        }
      }
      this.updateStrumplatePitches();
      return;"""

new_noteoff = """      if (this.sustainPedalActive && !isControlKey) {
        this.physicallyReleasedKeys.add(pitch);
      } else {
        if (this.activePitchesMemory[pitch]) {
          const notesToKill = this.activePitchesMemory[pitch];
          for (const note of notesToKill) {
            if (note.timeoutId) {
              clearTimeout(note.timeoutId);
            } else {
              this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel);
            }
            if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
          }
          delete this.activePitchesMemory[pitch];
        }
        if (!isControlKey) {
          this.checkAndClearLatches();
        }
      }
      this.updateStrumplatePitches();
      return;"""

content = content.replace(old_noteoff, new_noteoff)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched Note Off latches")
