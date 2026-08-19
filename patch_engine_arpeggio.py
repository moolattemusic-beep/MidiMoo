import re
content = open('src/lib/OrchidEngine.ts').read()

old_arp = """  public handleArpeggioNoteOn(pitch: number, velocity: number) {
    if (this.activeArpeggioNotes.has(pitch)) {
       // Retrigger
       this.handleArpeggioNoteOff(pitch);
    }
    const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
    this.emitNoteOn(pitch, velocity, 0, channel);
    this.activeArpeggioNotes.set(pitch, { pitch, mpeChannel: channel });
  }

  public handleArpeggioNoteOff(pitch: number) {
    if (this.sustainPedalActive) {
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

new_arp = """  public handleArpeggioNoteOn(pitch: number, velocity: number) {
    if (this.activeArpeggioNotes.has(pitch)) {
       // Retrigger
       this.handleArpeggioNoteOff(pitch, true);
    }
    const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
    this.emitNoteOn(pitch, velocity, 0, channel);
    this.activeArpeggioNotes.set(pitch, { pitch, mpeChannel: channel });
  }

  public handleArpeggioNoteOff(pitch: number, force: boolean = false) {
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

if old_arp in content:
    content = content.replace(old_arp, new_arp)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched engine arpeggio logic")
else:
    print("Failed to patch engine arpeggio logic")
