import re
content = open('src/lib/OrchidEngine.ts').read()

# Add customVoicing to handleMidi signature
sig_old = "public handleMidi(pitch: number, velocity: number, isOn: boolean, skipBass: boolean = false, isUpdate: boolean = false, forcePlay: boolean = false, isMemoryTrigger: boolean = false) {"
sig_new = "public handleMidi(pitch: number, velocity: number, isOn: boolean, skipBass: boolean = false, isUpdate: boolean = false, forcePlay: boolean = false, isMemoryTrigger: boolean = false, customVoicing?: number[]) {"
content = content.replace(sig_old, sig_new)

# In handleMidi, where finalPitches is calculated:
pitches_old = """    let finalPitches: number[];
    let isSingleNote = false;
    
    if (intervals.length === 0) {
      finalPitches = [pitch];
      isSingleNote = true;
    } else {
      finalPitches = this.calculateFoldedPitches(mappedRoot, intervals);

      // Apply Voicing Mutation"""

pitches_new = """    let finalPitches: number[];
    let isSingleNote = false;
    
    if (customVoicing && customVoicing.length > 0) {
      finalPitches = [...customVoicing];
    } else if (intervals.length === 0) {
      finalPitches = [pitch];
      isSingleNote = true;
    } else {
      finalPitches = this.calculateFoldedPitches(mappedRoot, intervals);

      // Apply Voicing Mutation"""
content = content.replace(pitches_old, pitches_new)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched handleMidi custom voicing")
