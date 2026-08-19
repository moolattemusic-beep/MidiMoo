import re
content = open('src/lib/OrchidEngine.ts').read()

old_bass = """    if (!skipBass && bassSetting > 0 && bassPitch >= 0 && bassPitch <= 127) {
      if (!suppressImmediatePlay) {
        this.emitNoteOn(bassPitch, velocity, 0);
      }
      this.activePitchesMemory[pitch].push({ pitch: bassPitch, delayUsed: 0, isBass: true });"""

new_bass = """    if (!skipBass && bassSetting > 0 && bassPitch >= 0 && bassPitch <= 127) {
      const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
      if (!suppressImmediatePlay) {
        this.emitNoteOn(bassPitch, velocity, 0, channel);
      }
      this.activePitchesMemory[pitch].push({ pitch: bassPitch, delayUsed: 0, isBass: true, mpeChannel: channel, mpeBasePitch: bassPitch, mpeCurrentPitch: bassPitch });"""

if old_bass in content:
    content = content.replace(old_bass, new_bass)
    print("Patched bass")
else:
    print("Failed to patch bass")
    
old_chord = """      if (targetPitch >= 0 && targetPitch <= 127 && !playedPitches[targetPitch]) {
        playedPitches[targetPitch] = true;
        const noteObj: any = { pitch: targetPitch, delayUsed: delayForThisNote, isBass: false };
        
        if (!suppressImmediatePlay) {"""

new_chord = """      if (targetPitch >= 0 && targetPitch <= 127 && !playedPitches[targetPitch]) {
        playedPitches[targetPitch] = true;
        const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
        const noteObj: any = { pitch: targetPitch, delayUsed: delayForThisNote, isBass: false, mpeChannel: channel, mpeBasePitch: targetPitch, mpeCurrentPitch: targetPitch };
        
        if (!suppressImmediatePlay) {"""
        
if old_chord in content:
    content = content.replace(old_chord, new_chord)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched chord")
else:
    print("Failed to patch chord")

