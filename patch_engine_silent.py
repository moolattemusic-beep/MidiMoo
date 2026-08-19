import re

content = open('src/lib/OrchidEngine.ts').read()

# First, let's revert the emitNoteOn calls to check if we should emit at all
# Currently we have:
# this.emitNoteOn(bassPitch, velocity, 0, channel, suppressImmediatePlay);
# We need to change this logic.
# Wait, let's redefine the variable:
# const isOmnichord = this.params.omnichordMode && !forcePlay;
# const shouldMonitor = this.params.omnichordSynthMonitor;

# Actually, the easiest way is to modify the `emitNoteOn` function itself!
# In `emitNoteOn(..., isInternalSynthOnly)`:
# if `isInternalSynthOnly` is true, but `omnichordSynthMonitor` is FALSE, then we just RETURN and do nothing!

emit_note_on_old = """  private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false) {
    const finalVelocity = this.calculateFinalVelocity(velocity, pitch, this.lastUpdateReason);
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity: finalVelocity, isOn: true, delayMs, mpeChannel: channel, isInternalSynthOnly });
  }"""

emit_note_on_new = """  private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false) {
    if (isInternalSynthOnly && !this.params.omnichordSynthMonitor) {
      return; // Fully silent
    }
    const finalVelocity = this.calculateFinalVelocity(velocity, pitch, this.lastUpdateReason);
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity: finalVelocity, isOn: true, delayMs, mpeChannel: channel, isInternalSynthOnly });
  }"""

content = content.replace(emit_note_on_old, emit_note_on_new)

emit_note_off_old = """  private emitNoteOff(pitch: number, velocity: number = 0, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false) {
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel, isInternalSynthOnly });
  }"""

emit_note_off_new = """  private emitNoteOff(pitch: number, velocity: number = 0, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false) {
    if (isInternalSynthOnly && !this.params.omnichordSynthMonitor) {
      return; // Fully silent
    }
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel, isInternalSynthOnly });
  }"""

content = content.replace(emit_note_off_old, emit_note_off_new)

# And we also need to change suppressImmediatePlay back to its meaning of "is this omnichord mode"
# We had changed it to `this.params.omnichordMode && this.params.omnichordSynthMonitor && !forcePlay;`
# Let's change it back to `this.params.omnichordMode && !forcePlay;`

content = content.replace(
    'const suppressImmediatePlay = this.params.omnichordMode && this.params.omnichordSynthMonitor && !forcePlay;',
    'const suppressImmediatePlay = this.params.omnichordMode && !forcePlay;'
)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched emitNoteOn/Off for true silence")
