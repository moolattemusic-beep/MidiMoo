import re
content = open('src/lib/OrchidEngine.ts').read()

new_methods = """  public getArpeggioPitches(): number[] {
    const mappedRoot = this.getMappedRootPitch(this.lastPerformanceKey);
    const intervals = this.getIntervalsForState(this.lastPerformanceKey);
    
    let basePitches: number[];
    if (intervals.length === 0) {
      basePitches = [this.lastPerformanceKey];
    } else {
      basePitches = this.calculateFoldedPitches(mappedRoot, intervals);
    }
    
    // Base pitches are usually within a 1 or 2 octave range.
    // We want 4 octaves.
    const lowestPitch = Math.min(...basePitches);
    
    // Normalize basePitches to the lowest octave (starting at 0 for relative)
    const relativePitches = basePitches.map(p => p - lowestPitch).sort((a,b) => a-b);
    
    // Generate 4 octaves
    const result: number[] = [];
    const baseOctave = Math.floor(lowestPitch / 12) * 12; // Start from the nearest C below or equal
    const actualStart = lowestPitch;
    
    for (let oct = 0; oct < 4; oct++) {
      for (const rp of relativePitches) {
        const pitch = actualStart + (oct * 12) + rp;
        if (pitch <= 127 && !result.includes(pitch)) {
          result.push(pitch);
        }
      }
    }
    
    return result.sort((a,b) => a-b);
  }

  public handleArpeggioNoteOn(pitch: number, velocity: number) {
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
  }
"""

# Insert before "private recalculateActiveChords()"
old_recalc = "  private recalculateActiveChords() {"
if old_recalc in content:
    content = content.replace(old_recalc, new_methods + "\n" + old_recalc)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched arpeggio methods")
else:
    print("Failed to patch arpeggio methods")
