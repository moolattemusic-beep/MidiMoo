import re
content = open('src/lib/SimpleSynth.ts').read()

old = """    if (event.isPitchBend) {
      this.bendNote(event.pitch, event.pitchBendValue || 0, event.delayMs || 0);
    } else if (event.isOn && event.velocity > 0) {"""

new = """    if (event.isPitchBend) {
      this.bendNote(event.pitch, event.pitchBendValue || 0, event.delayMs || 0);
    } else if (event.isExpression) {
      this.expressNoteByChannel(event.mpeChannel || 1, event.expressionValue || 127, event.delayMs || 0);
    } else if (event.isOn && event.velocity > 0) {"""
content = content.replace(old, new)

old_play = "this.activeOscillators.set(pitch, oscs);"
new_play = "this.activeOscillators.set(pitch, oscs);\n    if ((event as any)?.mpeChannel) this.activeChannels.set((event as any).mpeChannel, pitch);"
# Actually, SimpleSynth doesn't track channel right now. We can just add channel tracking.
