import re
content = open('src/lib/OrchidEngine.ts').read()

# Make emitNoteOn use calculateFinalVelocity
old_emit = """  private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1) {
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: true, delayMs, mpeChannel: channel });
  }"""

new_emit = """  private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1) {
    const finalVelocity = this.calculateFinalVelocity(velocity, pitch, this.lastUpdateReason);
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity: finalVelocity, isOn: true, delayMs, mpeChannel: channel });
    
    // Reset expression to max on note on, in case it was reused/glided
    if (this.params.mpeEnabled) {
      this.emitMpeExpression(channel, 127, delayMs);
    }
  }"""

content = content.replace(old_emit, new_emit)

open('src/lib/OrchidEngine.ts', 'w').write(content)
