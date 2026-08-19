import re

content = open('src/lib/OrchidEngine.ts').read()

old_arp_off = """  public handleArpeggioNoteOff(pitch: number, force: boolean = false) {
    if (this.sustainPedalActive && !force) {
      // Defer release until sustain pedal is released
      return;
    }
    const note = this.activeArpeggioNotes.get(pitch);
    if (note) {
      this.emitNoteOff(pitch, 0, 0, note.mpeChannel);
      if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
      this.activeArpeggioNotes.delete(pitch);
    }
  }"""

new_arp_off = """  public handleArpeggioNoteOff(pitch: number, force: boolean = false) {
    if (this.sustainPedalActive && !force) {
      // Defer release until sustain pedal is released
      return;
    }
    const note = this.activeArpeggioNotes.get(pitch);
    if (note) {
      if (note.timeoutId) {
        clearTimeout(note.timeoutId);
      }
      this.emitNoteOff(pitch, 0, 0, note.mpeChannel);
      if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
      this.activeArpeggioNotes.delete(pitch);
    }
  }"""

content = content.replace(old_arp_off, new_arp_off)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched arp off timeouts")
