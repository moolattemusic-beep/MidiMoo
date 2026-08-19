import re

content = open('src/lib/SimpleSynth.ts').read()

content = content.replace(
    'private activeChannels: Map<number, number> = new Map();',
    'private activeChannels: Map<number, number> = new Map();\n  private sustainPedalActive: boolean = false;\n  private sustainedNotes: Set<number> = new Set();'
)

# Update CC handler
cc_handler_old = """    } else if (event.isCC) {
      if (event.ccNumber === 126) {
         const semitones = ((event.ccValue || 64) - 64) / 64 * 2;
         this.activeOscillators.forEach((nodes, p) => {
            this.bendNote(p, semitones, event.delayMs || 0);
         });
      }
    } else if (event.isOn && event.velocity > 0) {"""

cc_handler_new = """    } else if (event.isCC) {
      if (event.ccNumber === 126) {
         const semitones = ((event.ccValue || 64) - 64) / 64 * 2;
         this.activeOscillators.forEach((nodes, p) => {
            this.bendNote(p, semitones, event.delayMs || 0);
         });
      } else if (event.ccNumber === 64) {
         this.sustainPedalActive = (event.ccValue || 0) >= 64;
         if (!this.sustainPedalActive) {
            // release sustained notes
            this.sustainedNotes.forEach(p => {
               this.stopNote(p, event.delayMs || 0);
            });
            this.sustainedNotes.clear();
         }
      }
    } else if (event.isOn && event.velocity > 0) {"""

content = content.replace(cc_handler_old, cc_handler_new)

# Update stopNote to defer if sustain is active
stop_note_old = """  private stopNote(pitch: number, delayMs: number) {
    if (!this.ctx) return;
        
    const stopTime = this.ctx.currentTime + (delayMs / 1000);"""

stop_note_new = """  private stopNote(pitch: number, delayMs: number) {
    if (!this.ctx) return;
    
    if (this.sustainPedalActive) {
       this.sustainedNotes.add(pitch);
       return;
    }
        
    const stopTime = this.ctx.currentTime + (delayMs / 1000);"""

content = content.replace(stop_note_old, stop_note_new)

# Update panic to clear sustained
content = content.replace(
    'this.activeChannels.clear();',
    'this.activeChannels.clear();\n    this.sustainPedalActive = false;\n    this.sustainedNotes.clear();'
)

open('src/lib/SimpleSynth.ts', 'w').write(content)
print("Patched SimpleSynth with sustain pedal")
