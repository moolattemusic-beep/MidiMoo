import re
content = open('src/lib/OrchidEngine.ts').read()

old_bend = """      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const pitchAtStep = currentPitch + (targetPitch - currentPitch) * progress;
        const bendAmount = pitchAtStep - basePitch;
        const delayMs = delayOffset + (i * stepTime);
        
        if (this.onOutputNote) {"""

new_bend = """      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const pitchAtStep = currentPitch + (targetPitch - currentPitch) * progress;
        const bendAmount = pitchAtStep - basePitch;
        // Jitter to prevent MIDI overload when gliding chords
        const delayMs = delayOffset + (i * stepTime) + (channel * 0.1);
        
        if (this.onOutputNote) {"""
        
if old_bend in content:
    content = content.replace(old_bend, new_bend)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched OrchidEngine.ts")
else:
    print("Failed to patch OrchidEngine.ts")
