import re
content = open('src/lib/OrchidEngine.ts').read()

old_noteon = """    // Reset expression to max on note on, in case it was reused/glided
    if (this.params.mpeEnabled) {
      this.emitMpeExpression(channel, 127, delayMs);
    }
  }"""

new_noteon = """    // Reset expression and pitch bend on note on, in case channel was reused/glided
    if (this.params.mpeEnabled) {
      this.emitMpeExpression(channel, 127, delayMs);
      if (this.onOutputNote) {
        this.onOutputNote({ pitch, velocity: 0, isOn: false, delayMs, mpeChannel: channel, isPitchBend: true, pitchBendValue: 0 });
      }
    }
  }"""

if old_noteon in content:
    content = content.replace(old_noteon, new_noteon)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched emitNoteOn")
else:
    print("Could not find emitNoteOn text")
