import re

content = open('src/lib/OrchidEngine.ts').read()

# Fix getArpeggioPitches mapping check (0 -> 3)
old_arp = """  public getArpeggioPitches(): number[] {
    if (this.params.keyboardMapping === 0) {"""
new_arp = """  public getArpeggioPitches(): number[] {
    if (this.params.keyboardMapping === 3) {"""
content = content.replace(old_arp, new_arp)

# Fix isControlKey mapping check (0 -> 3)
old_ctrl = """    // In Free Mode, the whole keyboard is performance keys
    if (this.params.keyboardMapping === 0) {
      isControlKey = false;
    }"""
new_ctrl = """    // In Free Mode, the whole keyboard is performance keys
    if (this.params.keyboardMapping === 3) {
      isControlKey = false;
    }"""
content = content.replace(old_ctrl, new_ctrl)

# Fix Omnichord mode bleed in Free Mode
old_free_on = """        if (stolenNote) {
          const channel = stolenNote.mpeChannel ?? (this.params.mpeEnabled ? this.allocateMpeChannel() : undefined);
          const basePitch = stolenNote.mpeBasePitch ?? stolenNote.pitch;
          const currentPitch = stolenNote.mpeCurrentPitch ?? stolenNote.pitch;
          
          if (this.params.mpeEnabled && channel) {
             this.emitMpePitchBend(channel, basePitch, currentPitch, pitch, 0);
          }
          
          this.activePitchesMemory[pitch] = [{
            ...stolenNote,
            pitch: pitch,
            mpeBasePitch: basePitch,
            mpeCurrentPitch: pitch,
            mpeChannel: channel
          }];
        } else {
          const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
          this.emitNoteOn(pitch, velocity, 0, channel);
          this.activePitchesMemory[pitch] = [{ pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: pitch, mpeCurrentPitch: pitch }];
        }"""
new_free_on = """        if (stolenNote) {
          const channel = stolenNote.mpeChannel ?? (this.params.mpeEnabled ? this.allocateMpeChannel() : undefined);
          const basePitch = stolenNote.mpeBasePitch ?? stolenNote.pitch;
          const currentPitch = stolenNote.mpeCurrentPitch ?? stolenNote.pitch;
          
          if (this.params.mpeEnabled && channel && !this.params.omnichordMode) {
             this.emitMpePitchBend(channel, basePitch, currentPitch, pitch, 0);
          }
          
          this.activePitchesMemory[pitch] = [{
            ...stolenNote,
            pitch: pitch,
            mpeBasePitch: basePitch,
            mpeCurrentPitch: pitch,
            mpeChannel: channel
          }];
        } else {
          const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
          if (!this.params.omnichordMode) {
            this.emitNoteOn(pitch, velocity, 0, channel);
          }
          this.activePitchesMemory[pitch] = [{ pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: pitch, mpeCurrentPitch: pitch }];
        }"""
content = content.replace(old_free_on, new_free_on)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Applied Free Mode Fixes")
