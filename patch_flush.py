import re
content = open('src/lib/OrchidEngine.ts').read()
old_flush = """        for (const [pitch, note] of this.activeArpeggioNotes.entries()) {
           if (note.timeoutId) clearTimeout(note.timeoutId);
           this.emitNoteOff(pitch, 0, 0, note.mpeChannel);
           if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }"""
new_flush = """        for (const [pitch, note] of this.activeArpeggioNotes.entries()) {
           if (note.timeoutId) clearTimeout(note.timeoutId);
           const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;
           this.emitNoteOff(pitch, 0, 0, note.mpeChannel, false, isMidiOnly);
           if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }"""
content = content.replace(old_flush, new_flush)
open('src/lib/OrchidEngine.ts', 'w').write(content)
