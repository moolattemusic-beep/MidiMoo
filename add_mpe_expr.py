import re
content = open('src/lib/MidiDeviceManager.ts').read()

new_func = """
  public sendMpeExpression(channel: number, value: number, delayMs: number = 0) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.outputs.find(o => o.id === this.selectedOutputId);
    if (!output) return;

    value = Math.max(0, Math.min(127, Math.round(value)));
    const status = 0xB0 | (channel - 1);

    if (delayMs > 0) {
      output.send([status, 11, value], window.performance.now() + delayMs);
    } else {
      output.send([status, 11, value]);
    }
  }
"""

content = content.replace("  public sendMpePitchBend", new_func + "\n  public sendMpePitchBend")
open('src/lib/MidiDeviceManager.ts', 'w').write(content)

