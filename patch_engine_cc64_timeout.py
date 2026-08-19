import re

content = open('src/lib/OrchidEngine.ts').read()

old_cc64 = """        // Flush arpeggio notes that were sustained
        for (const [pitch, note] of this.activeArpeggioNotes.entries()) {
           this.emitNoteOff(pitch, 0, 0, note.mpeChannel);
           if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }
        this.activeArpeggioNotes.clear();"""

new_cc64 = """        // Flush arpeggio notes that were sustained
        for (const [pitch, note] of this.activeArpeggioNotes.entries()) {
           if (note.timeoutId) clearTimeout(note.timeoutId);
           this.emitNoteOff(pitch, 0, 0, note.mpeChannel);
           if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }
        this.activeArpeggioNotes.clear();"""

content = content.replace(old_cc64, new_cc64)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched cc64 timeouts")
