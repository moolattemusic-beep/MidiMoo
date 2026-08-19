import re
content = open('src/lib/OrchidEngine.ts').read()

mpe_state = """  private activePitchesMemory: Record<number, Array<{ pitch: number, delayUsed: number, isBass: boolean, timeoutId?: any, mpeChannel?: number, mpeBasePitch?: number, mpeCurrentPitch?: number }>> = {};
  private mpeChannelsAllocated: boolean[] = new Array(16).fill(false);

  private allocateMpeChannel(): number {
    for (let i = 1; i <= 14; i++) { // Channels 2-15
      if (!this.mpeChannelsAllocated[i]) {
        this.mpeChannelsAllocated[i] = true;
        return i + 1;
      }
    }
    return 2; // fallback
  }

  private freeMpeChannel(ch: number) {
    if (ch >= 2 && ch <= 15) {
      this.mpeChannelsAllocated[ch - 1] = false;
    }
  }

  private emitMpePitchBend(channel: number, basePitch: number, currentPitch: number, targetPitch: number, delayOffset: number) {
    const steps = 20; // 20 steps over the glide time
    const glideMs = this.params.mpeGlideTimeMs || 150;
    const stepTime = glideMs / steps;
    
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const pitchAtStep = currentPitch + (targetPitch - currentPitch) * progress;
      const bendAmount = pitchAtStep - basePitch;
      const delayMs = delayOffset + (i * stepTime);
      
      if (this.onOutputNote) {
        this.onOutputNote({
          pitch: basePitch,
          velocity: 0,
          isOn: false,
          delayMs,
          mpeChannel: channel,
          isPitchBend: true,
          pitchBendValue: bendAmount
        });
      }
    }
  }"""

# Insert at top of class
content = content.replace('  private activePitchesMemory: Record<number, Array<any>> = {};', mpe_state)
if 'Array<any>' not in content:
    # try another match
    content = re.sub(r'  private activePitchesMemory: Record<number, Array<.*?>?> = \{\};', mpe_state, content)

emitters = """  private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1) {
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: true, delayMs, mpeChannel: channel });
  }

  private emitNoteOff(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1) {
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel });
  }"""

content = re.sub(r'  private emitNoteOn\(pitch: number, velocity: number, delayMs: number = 0\) \{.*?\n  \}', emitters, content, flags=re.DOTALL)
open('src/lib/OrchidEngine.ts', 'w').write(content)
