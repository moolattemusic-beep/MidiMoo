export class MidiDeviceManager {
  private midiAccess: MIDIAccess | null = null;
  public inputs: MIDIInput[] = [];
  public outputs: MIDIOutput[] = [];
  
  public selectedInputId: string | null = null;
  public selectedOutputId: string | null = null;

  public onInputMessage?: (pitch: number, velocity: number, isOn: boolean, channel: number) => void;
  public onControlChange?: (cc: number, value: number, channel: number) => void;
  public onPitchBend?: (value: number, channel: number) => void;
  public onDevicesChanged?: () => void;

  public async refreshDevices(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.warn("Web MIDI API not supported in this browser.");
      return false;
    }
    
    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.updateDevices();
      
      this.midiAccess.onstatechange = () => {
        this.updateDevices();
        if (this.onDevicesChanged) this.onDevicesChanged();
      };
      
      if (this.onDevicesChanged) this.onDevicesChanged();
      return true;
    } catch (e) {
      console.error("Failed to access MIDI devices", e);
      return false;
    }
  }

  public async init(): Promise<boolean> {
    return this.refreshDevices();
  }

  private updateDevices() {
    if (!this.midiAccess) return;
    
    this.inputs = Array.from(this.midiAccess.inputs.values());
    this.outputs = Array.from(this.midiAccess.outputs.values());

    // Clean up old listeners
    this.inputs.forEach(input => {
      input.onmidimessage = null;
    });

    // Auto-select first if none selected
    if (!this.selectedInputId && this.inputs.length > 0) {
      this.selectedInputId = this.inputs[0].id;
    }
    if (!this.selectedOutputId && this.outputs.length > 0) {
      this.selectedOutputId = this.outputs[0].id;
    }

    // Bind listener to selected input
    if (this.selectedInputId) {
      const input = this.inputs.find(i => i.id === this.selectedInputId);
      if (input) {
        input.onmidimessage = this.handleMidiMessage.bind(this);
      }
    }
  }

  public selectInput(id: string) {
    this.selectedInputId = id;
    this.updateDevices();
  }

  public selectOutput(id: string) {
    this.selectedOutputId = id;
  }

  private handleMidiMessage(event: MIDIMessageEvent) {
    if (!event.data || event.data.length < 3) return;
    
    const [statusByte, data1, data2] = event.data;
    const status = statusByte & 0xF0;
    const channel = (statusByte & 0x0F) + 1;
    
    // Note On
    if (status === 0x90) {
      if (data2 > 0) {
        if (this.onInputMessage) this.onInputMessage(data1, data2, true, channel);
      } else {
        if (this.onInputMessage) this.onInputMessage(data1, 0, false, channel);
      }
    } 
    // Note Off
    else if (status === 0x80) {
      if (this.onInputMessage) this.onInputMessage(data1, 0, false, channel);
    }
    // Control Change
    else if (status === 0xB0) {
      if (this.onControlChange) this.onControlChange(data1, data2, channel);
    }
    // Pitch Bend
    else if (status === 0xE0) {
      const value = data1 | (data2 << 7); // 0 to 16383
      if (this.onPitchBend) this.onPitchBend(value, channel);
    }
  }

  public sendControlChange(cc: number, value: number, delayMs: number = 0, channel: number = 1) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    
    const output = this.outputs.find(o => o.id === this.selectedOutputId);
    if (!output) return;
    
    const status = 0xB0 | ((channel - 1) & 0x0F);

    if (delayMs > 0) {
      output.send([status, cc, value], window.performance.now() + delayMs);
    } else {
      output.send([status, cc, value]);
    }
  }


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

    public setMpeBendRange(semitones: number) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.outputs.find(o => o.id === this.selectedOutputId);
    if (!output) return;

    // Send MPE Configuration Message (MCM) to Master Channel (Ch 1)
    // RPN 0x00 0x06, Value: 15 (Channels 2-16)
    output.send([0xB0, 101, 0]);
    output.send([0xB0, 100, 6]);
    output.send([0xB0, 6, 15]);
    output.send([0xB0, 38, 0]);

    // Send Pitch Bend Sensitivity RPN to all 16 channels
    for (let ch = 1; ch <= 16; ch++) {
      const status = 0xB0 | (ch - 1);
      output.send([status, 101, 0]); // RPN MSB
      output.send([status, 100, 0]); // RPN LSB
      output.send([status, 6, semitones]); // Data Entry MSB (semitones)
      output.send([status, 38, 0]); // Data Entry LSB (cents)
    }
  }

  public sendMpePitchBend(channel: number, semitones: number, bendRange: number, delayMs: number = 0) {
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


  public panic() {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.outputs.find(o => o.id === this.selectedOutputId);
    if (!output) return;

    for (let channel = 0; channel < 16; channel++) {
      try {
        output.send([0xB0 | channel, 123, 0]); // All Notes Off
        output.send([0xB0 | channel, 121, 0]); // Reset All Controllers
        for (let pitch = 0; pitch < 128; pitch++) {
          output.send([0x80 | channel, pitch, 0]);
        }
      } catch (e) {
        console.warn('Failed to send panic messages for channel', channel, e);
      }
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
  }
}
