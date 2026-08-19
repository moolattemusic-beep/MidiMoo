import re
content = open('src/lib/MidiDeviceManager.ts').read()

send_note = """  public sendMpePitchBend(channel: number, semitones: number, bendRange: number, delayMs: number = 0) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.outputs.find(o => o.id === this.selectedOutputId);
    if (!output) return;

    let v = Math.round(8192 + (semitones * 8192 / bendRange));
    v = Math.max(0, Math.min(16383, v));
    const lsb = v & 0x7F;
    const msb = (v >> 7) & 0x7F;
    const status = 0xE0 | (channel - 1);

    if (delayMs > 0) {
      output.send([status, lsb, msb], window.performance.now() + delayMs);
    } else {
      output.send([status, lsb, msb]);
    }
  }

  public sendNote(pitch: number, velocity: number, isOn: boolean, delayMs: number = 0, channel: number = 1) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    
    const output = this.outputs.find(o => o.id === this.selectedOutputId);
    if (!output) return;
    const status = (isOn ? 0x90 : 0x80) | (channel - 1);
    
    if (delayMs > 0) {
      output.send([status, pitch, velocity], window.performance.now() + delayMs);
    } else {
      output.send([status, pitch, velocity]);
    }
  }"""

content = re.sub(r'  public sendNote\(.*?\}.*?\}', send_note, content, flags=re.DOTALL)
open('src/lib/MidiDeviceManager.ts', 'w').write(content)
