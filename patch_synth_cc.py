import re
content = open('src/lib/SimpleSynth.ts').read()

old_logic = """    if (event.isPitchBend) {
      this.bendNote(event.pitch, event.pitchBendValue || 0, event.delayMs || 0);
    } else if (event.isOn && event.velocity > 0) {
      this.playNote(event.pitch, event.velocity, event.delayMs || 0, event.mpeChannel || 1);
    } else {
      this.stopNote(event.pitch, event.delayMs || 0);
    }"""

new_logic = """    if (event.isPitchBend) {
      this.bendNote(event.pitch, event.pitchBendValue || 0, event.delayMs || 0);
    } else if (event.isCC) {
      if (event.ccNumber === 126) {
         const semitones = ((event.ccValue || 64) - 64) / 64 * 2;
         this.activeOscillators.forEach((nodes, p) => {
            this.bendNote(p, semitones, event.delayMs || 0);
         });
      }
    } else if (event.isOn && event.velocity > 0) {
      this.playNote(event.pitch, event.velocity, event.delayMs || 0, event.mpeChannel || 1);
    } else {
      this.stopNote(event.pitch, event.delayMs || 0);
    }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    open('src/lib/SimpleSynth.ts', 'w').write(content)
    print("Patched SimpleSynth for CC")
else:
    print("Failed to patch SimpleSynth for CC")
