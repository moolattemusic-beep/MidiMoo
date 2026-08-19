import re
content = open('src/lib/MidiDeviceManager.ts').read()

old_cc = """  public sendControlChange(cc: number, value: number, delayMs: number = 0) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    
    const output = this.outputs.find(o => o.id === this.selectedOutputId);
    if (!output) return;

    if (delayMs > 0) {
      output.send([0xB0, cc, value], window.performance.now() + delayMs);
    } else {
      output.send([0xB0, cc, value]);
    }
  }"""

new_cc = """  public sendControlChange(cc: number, value: number, delayMs: number = 0, channel: number = 1) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    
    const output = this.outputs.find(o => o.id === this.selectedOutputId);
    if (!output) return;
    
    const status = 0xB0 | ((channel - 1) & 0x0F);

    if (delayMs > 0) {
      output.send([status, cc, value], window.performance.now() + delayMs);
    } else {
      output.send([status, cc, value]);
    }
  }"""

if old_cc in content:
    content = content.replace(old_cc, new_cc)
    
old_event = """      if (event.isExpression) {
        this.sendControlChange(11, event.expressionValue || 0, event.delayMs || 0);
        return;
      }"""
      
new_event = """      if (event.isExpression) {
        this.sendControlChange(11, event.expressionValue || 0, event.delayMs || 0);
        return;
      }
      
      if (event.isCC) {
        this.sendControlChange(event.ccNumber!, event.ccValue!, event.delayMs || 0, event.mpeChannel || 1);
        return;
      }"""

if old_event in content:
    content = content.replace(old_event, new_event)

open('src/lib/MidiDeviceManager.ts', 'w').write(content)
print("Patched MidiDeviceManager")
