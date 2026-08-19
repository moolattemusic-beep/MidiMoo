import re
content = open('src/lib/SimpleSynth.ts').read()

# Add activeChannels map
if 'activeChannels: Map<number, number> =' not in content:
    content = content.replace(
        "private activeOscillators: Map<number, { osc: OscillatorNode, gain: GainNode }[]> = new Map();",
        "private activeOscillators: Map<number, { osc: OscillatorNode, gain: GainNode }[]> = new Map();\n  private activeChannels: Map<number, number> = new Map();"
    )

# update playNote signature to take channel
content = content.replace("private playNote(pitch: number, velocity: number, delayMs: number) {", "private playNote(pitch: number, velocity: number, delayMs: number, channel: number = 1) {")
content = content.replace("this.playNote(event.pitch, event.velocity, event.delayMs || 0);", "this.playNote(event.pitch, event.velocity, event.delayMs || 0, event.mpeChannel || 1);")

content = content.replace(
    "this.activeOscillators.set(pitch, oscs);",
    "this.activeOscillators.set(pitch, oscs);\n    this.activeChannels.set(channel, pitch);"
)

new_func = """
  private expressNoteByChannel(channel: number, expression: number, delayMs: number) {
    if (!this.ctx) return;
    const pitch = this.activeChannels.get(channel);
    if (pitch === undefined) return;
    
    const time = this.ctx.currentTime + (delayMs / 1000);
    const nodes = this.activeOscillators.get(pitch);
    if (nodes) {
      nodes.forEach(({ gain }) => {
        // expression is 0-127.
        // Convert to a multiplier (e.g. 0.0 to 1.0), then apply to the original target gain.
        // Actually, we don't know original target gain here easily unless we store it.
        // We'll just set it assuming it's roughly proportional to expression / 127
        const baseGain = 0.5; // roughly 
        const targetGain = baseGain * (expression / 127);
        
        gain.gain.cancelScheduledValues(time);
        gain.gain.linearRampToValueAtTime(targetGain, time + 0.01);
      });
    }
  }
"""

if 'expressNoteByChannel' not in content:
    content = content.replace("private bendNote(", new_func + "\n  private bendNote(")

open('src/lib/SimpleSynth.ts', 'w').write(content)
