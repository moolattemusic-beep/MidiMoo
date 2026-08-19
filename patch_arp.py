import re
content = open('src/lib/OrchidEngine.ts').read()
old_arp_on = """    const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
    this.emitNoteOn(pitch, velocity, 0, channel);"""
new_arp_on = """    const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
    const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;
    this.emitNoteOn(pitch, velocity, 0, channel, false, isMidiOnly);"""
content = content.replace(old_arp_on, new_arp_on)

old_arp_off = """  public handleArpeggioNoteOff(pitch: number, force: boolean = false) {
    const note = this.activeArpeggioNotes.get(pitch);
    if (note) {
      this.emitNoteOff(pitch, 0, 0, note.mpeChannel);"""
new_arp_off = """  public handleArpeggioNoteOff(pitch: number, force: boolean = false) {
    const note = this.activeArpeggioNotes.get(pitch);
    if (note) {
      const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;
      this.emitNoteOff(pitch, 0, 0, note.mpeChannel, false, isMidiOnly);"""
content = content.replace(old_arp_off, new_arp_off)

open('src/lib/OrchidEngine.ts', 'w').write(content)
