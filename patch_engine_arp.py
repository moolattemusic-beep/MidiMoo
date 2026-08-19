import re

content = open('src/lib/OrchidEngine.ts').read()

old_arp_off = """  public handleArpeggioNoteOff(pitch: number, force: boolean = false) {
    if (this.sustainPedalActive && !force) {
      // Defer release until sustain pedal is released
      return;
    }
    const note = this.activeArpeggioNotes.get(pitch);"""

new_arp_off = """  public handleArpeggioNoteOff(pitch: number, force: boolean = false) {
    const note = this.activeArpeggioNotes.get(pitch);"""

content = content.replace(old_arp_off, new_arp_off)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched handleArpeggioNoteOff")
