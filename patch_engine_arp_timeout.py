import re

content = open('src/lib/OrchidEngine.ts').read()

old_arp_on = """  public handleArpeggioNoteOn(pitch: number, velocity: number) {
    if (this.activeArpeggioNotes.has(pitch)) {
       // Retrigger
       this.handleArpeggioNoteOff(pitch, true);
    }
    const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
    this.emitNoteOn(pitch, velocity, 0, channel);
    this.activeArpeggioNotes.set(pitch, { pitch, mpeChannel: channel });
    
    // Auto-release arpeggio notes shortly after triggering (staccato pulse)
    setTimeout(() => {
      if (this.activeArpeggioNotes.has(pitch)) {
        this.handleArpeggioNoteOff(pitch);
      }
    }, 50);
  }"""

new_arp_on = """  public handleArpeggioNoteOn(pitch: number, velocity: number) {
    if (this.activeArpeggioNotes.has(pitch)) {
       const existing = this.activeArpeggioNotes.get(pitch);
       if (existing && existing.timeoutId) {
           clearTimeout(existing.timeoutId);
       }
       // Retrigger
       this.handleArpeggioNoteOff(pitch, true);
    }
    const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
    this.emitNoteOn(pitch, velocity, 0, channel);
    
    // Auto-release arpeggio notes shortly after triggering (staccato pulse)
    const timeoutId = setTimeout(() => {
      if (this.activeArpeggioNotes.has(pitch)) {
        this.handleArpeggioNoteOff(pitch);
      }
    }, 50);
    
    this.activeArpeggioNotes.set(pitch, { pitch, mpeChannel: channel, timeoutId });
  }"""

content = content.replace(old_arp_on, new_arp_on)

content = content.replace(
    'public activeArpeggioNotes: Map<number, { pitch: number, mpeChannel?: number }> = new Map();',
    'public activeArpeggioNotes: Map<number, { pitch: number, mpeChannel?: number, timeoutId?: any }> = new Map();'
)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched arp timeouts")
