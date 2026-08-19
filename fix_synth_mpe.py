import re
content = open('src/lib/SimpleSynth.ts').read()

new_logic = """  public handleNoteEvent(event: NoteEvent) {
    if (!this.ctx || !this.masterGain) return;

    if (event.isPitchBend) {
      this.bendNote(event.pitch, event.pitchBendValue || 0, event.delayMs || 0);
    } else if (event.isOn && event.velocity > 0) {
      this.playNote(event.pitch, event.velocity, event.delayMs || 0);
    } else {
      this.stopNote(event.pitch, event.delayMs || 0);
    }
  }
  
  private bendNote(pitch: number, semitones: number, delayMs: number) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime + (delayMs / 1000);
    const targetFreq = this.midiToFreq(pitch + semitones);
    const nodes = this.activeOscillators.get(pitch);
    if (nodes) {
      nodes.forEach(({ osc }) => {
        osc.frequency.cancelScheduledValues(time);
        osc.frequency.linearRampToValueAtTime(targetFreq, time);
      });
    }
  }"""

content = re.sub(r'  public handleNoteEvent\(event: NoteEvent\) \{.*?\n  \}', new_logic, content, flags=re.DOTALL)
open('src/lib/SimpleSynth.ts', 'w').write(content)
