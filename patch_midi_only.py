import re

content = open('src/types.ts').read()
content = content.replace(
    'isInternalSynthOnly?: boolean;',
    'isInternalSynthOnly?: boolean;\n  isMidiOnly?: boolean;'
)
open('src/types.ts', 'w').write(content)

content = open('src/App.tsx').read()
content = content.replace(
    'if (isSynthEnabled) synth.handleNoteEvent(event);',
    'if (isSynthEnabled && !event.isMidiOnly) synth.handleNoteEvent(event);'
)
open('src/App.tsx', 'w').write(content)

content = open('src/lib/OrchidEngine.ts').read()
old_emit_on = """  private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false) {
    if (isInternalSynthOnly && !this.params.omnichordSynthMonitor) {
      return; // Fully silent
    }
    const finalVelocity = this.calculateFinalVelocity(velocity, pitch, this.lastUpdateReason);
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity: finalVelocity, isOn: true, delayMs, mpeChannel: channel, isInternalSynthOnly });
  }"""
new_emit_on = """  private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false, isMidiOnly: boolean = false) {
    if (isInternalSynthOnly && !this.params.omnichordSynthMonitor) {
      return; // Fully silent
    }
    const finalVelocity = this.calculateFinalVelocity(velocity, pitch, this.lastUpdateReason);
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity: finalVelocity, isOn: true, delayMs, mpeChannel: channel, isInternalSynthOnly, isMidiOnly });
  }"""
content = content.replace(old_emit_on, new_emit_on)

old_emit_off = """  private emitNoteOff(pitch: number, velocity: number = 0, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false) {
    if (isInternalSynthOnly && !this.params.omnichordSynthMonitor) {
      return; // Fully silent
    }
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel, isInternalSynthOnly });
  }"""
new_emit_off = """  private emitNoteOff(pitch: number, velocity: number = 0, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false, isMidiOnly: boolean = false) {
    if (isInternalSynthOnly && !this.params.omnichordSynthMonitor) {
      return; // Fully silent
    }
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel, isInternalSynthOnly, isMidiOnly });
  }"""
content = content.replace(old_emit_off, new_emit_off)

# Now apply isMidiOnly to Arpeggio and Strum calls
# Strum
old_strum_on = """      this.emitNoteOn(noteObj.pitch, 100, 0, channel);"""
new_strum_on = """      const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;
      this.emitNoteOn(noteObj.pitch, 100, 0, channel, false, isMidiOnly);"""
content = content.replace(old_strum_on, new_strum_on)

old_strum_off = """      this.emitNoteOff(noteObj.pitch, 0, 0, channel);"""
new_strum_off = """      const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;
      this.emitNoteOff(noteObj.pitch, 0, 0, channel, false, isMidiOnly);"""
content = content.replace(old_strum_off, new_strum_off)

# Ensure the strumplate first touch is also fixed
# We can just replace all occurrences of `this.emitNoteOn(noteObj.pitch, 100, 0, channel);` and `this.emitNoteOff(noteObj.pitch, 0, 0, channel);`

# Actually, the above replace will do all of them because it matches the exact string. Let's see if it caught all of them.

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched isMidiOnly")
