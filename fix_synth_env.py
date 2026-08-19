import re
content = open('src/lib/SimpleSynth.ts').read()

play_replacement = """    const now = this.ctx.currentTime;
    const startTime = now + (delayMs / 1000) + 0.01; // 10ms buffer to prevent clicks
    const freq = this.midiToFreq(pitch);

    // If the same note is played before old ones finished fading out, force stop them to prevent volume buildup
    const existingNodes = this.activeOscillators.get(pitch);
    if (existingNodes) {
      existingNodes.forEach(({ osc, gain }) => {
        gain.gain.cancelScheduledValues(startTime);
        gain.gain.setTargetAtTime(0, startTime, 0.01);
        try {
          osc.stop(startTime + 0.1);
        } catch (e) {}
      });
      this.activeOscillators.delete(pitch);
    }

    const osc = this.ctx.createOscillator();
    osc.type = 'sine'; // Clean sine wave
    osc.frequency.value = freq;

    const noteGain = this.ctx.createGain();
    // Velocity scaling 0-1
    const velocityScale = velocity / 127;
    noteGain.gain.value = 0;
    noteGain.gain.setValueAtTime(0, startTime);
    // Quick attack
    noteGain.gain.linearRampToValueAtTime(velocityScale * 0.8, startTime + 0.02);
    // Slight decay
    noteGain.gain.setTargetAtTime(velocityScale * 0.6, startTime + 0.02, 0.1);"""

# Replace the body of playNote
content = re.sub(r'const startTime = this\.ctx\.currentTime \+ \(delayMs / 1000\);.*noteGain\.gain\.exponentialRampToValueAtTime\(velocityScale \* 0\.6, startTime \+ 0\.3\);', play_replacement, content, flags=re.DOTALL)

stop_replacement = """    const stopTime = this.ctx.currentTime + (delayMs / 1000);
    const nodes = this.activeOscillators.get(pitch);
    
    if (nodes) {
      nodes.forEach(({ osc, gain }) => {
        // Release phase
        gain.gain.cancelScheduledValues(stopTime);
        gain.gain.setTargetAtTime(0, stopTime, 0.05);
        
        try {
          osc.stop(stopTime + 0.5);
        } catch (e) {
          // ignore already stopped errors
        }
      });
      
      // Clean up map after fade out finishes
      setTimeout(() => {
        const currentNodes = this.activeOscillators.get(pitch);
        if (currentNodes === nodes) {
          this.activeOscillators.delete(pitch);
        }
      }, (delayMs + 600));"""

content = re.sub(r'const stopTime = this\.ctx\.currentTime \+ \(delayMs / 1000\);.*}, \(delayMs \+ 300\)\);', stop_replacement, content, flags=re.DOTALL)

open('src/lib/SimpleSynth.ts', 'w').write(content)
