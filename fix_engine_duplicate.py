import re
content = open('src/lib/OrchidEngine.ts').read()

old_dupe = """  private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0) {
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: true, delayMs });
  }

  private emitNoteOff(pitch: number, velocity: number, delayMs: number = 0) {
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs });
  }"""

content = content.replace(old_dupe, "")
open('src/lib/OrchidEngine.ts', 'w').write(content)
