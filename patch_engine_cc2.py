import re
content = open('src/lib/OrchidEngine.ts').read()

old_emit = """  private emitNoteOff(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1) {
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel });
  }"""

new_emit = """  private emitNoteOff(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1) {
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel });
  }

  public emitControlChange(ccNumber: number, ccValue: number, channel: number = 1, delayMs: number = 0) {
    if (this.onOutputNote) {
      this.onOutputNote({
        pitch: 0,
        velocity: 0,
        isOn: false,
        delayMs,
        mpeChannel: channel,
        isCC: true,
        ccNumber,
        ccValue
      });
    }
  }"""

if old_emit in content:
    content = content.replace(old_emit, new_emit)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched engine cc2")
else:
    print("Failed to patch engine cc2")
