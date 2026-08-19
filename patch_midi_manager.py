import re
content = open('src/lib/MidiDeviceManager.ts').read()

old_cb = """  public onInputMessage?: (pitch: number, velocity: number, isOn: boolean, channel: number) => void;
  public onControlChange?: (cc: number, value: number, channel: number) => void;
  public onDevicesChanged?: () => void;"""

new_cb = """  public onInputMessage?: (pitch: number, velocity: number, isOn: boolean, channel: number) => void;
  public onControlChange?: (cc: number, value: number, channel: number) => void;
  public onPitchBend?: (value: number, channel: number) => void;
  public onDevicesChanged?: () => void;"""

if old_cb in content:
    content = content.replace(old_cb, new_cb)

old_handler = """    // Control Change
    else if (status === 0xB0) {
      if (this.onControlChange) this.onControlChange(data1, data2, channel);
    }
  }"""

new_handler = """    // Control Change
    else if (status === 0xB0) {
      if (this.onControlChange) this.onControlChange(data1, data2, channel);
    }
    // Pitch Bend
    else if (status === 0xE0) {
      const value = data1 | (data2 << 7); // 0 to 16383
      if (this.onPitchBend) this.onPitchBend(value, channel);
    }
  }"""

if old_handler in content:
    content = content.replace(old_handler, new_handler)

open('src/lib/MidiDeviceManager.ts', 'w').write(content)
