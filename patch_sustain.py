import re
content = open('src/lib/OrchidEngine.ts').read()

old_sustain = """      if (!this.sustainPedalActive) {
        // Flush all physically released keys
        for (const pitch of this.physicallyReleasedKeys) {"""

new_sustain = """      if (!this.sustainPedalActive) {
        // Flush arpeggio notes that were sustained
        for (const [pitch, note] of this.activeArpeggioNotes.entries()) {
           this.emitNoteOff(pitch, 0, 0, note.mpeChannel);
           if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }
        this.activeArpeggioNotes.clear();

        // Flush all physically released keys
        for (const pitch of this.physicallyReleasedKeys) {"""

if old_sustain in content:
    content = content.replace(old_sustain, new_sustain)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched sustain")
else:
    print("Failed to patch sustain")
