/** Somewhere to send to: one port, or several at once. */
interface OutputBus {
  send: (data: number[], at?: number) => void;
}

export class MidiDeviceManager {
  private midiAccess: MIDIAccess | null = null;
  public inputs: MIDIInput[] = [];
  public outputs: MIDIOutput[] = [];
  
  // Several of each can be live at once: a keyboard and a control surface
  // playing together, and a synth being fed alongside a DAW.
  public selectedInputIds: Set<string> = new Set();
  public selectedOutputIds: Set<string> = new Set();

  // Ports are remembered by name rather than by id. An id is assigned by the
  // driver and changes between sessions and machines, so a saved id would not
  // find its port again; a name does.
  private static readonly STORE_KEY = 'orchid-midi-ports';
  // What to reach for the first time, before anything has been chosen.
  private static readonly DEFAULT_INPUTS = ['a series', 'touchosc'];
  private static readonly DEFAULT_OUTPUTS = ['logic pro virtual in'];
  private restored = false;

  // The single-port view of the selection, kept so that everything written
  // against one input and one output still works: reading gives the first
  // selected port, and assigning one means that port alone.
  public get selectedOutputId(): string | null {
    for (const id of this.selectedOutputIds) return id;
    return null;
  }

  public set selectedOutputId(id: string | null) {
    this.selectedOutputIds.clear();
    if (id) this.selectedOutputIds.add(id);
  }

  public get selectedInputId(): string | null {
    for (const id of this.selectedInputIds) return id;
    return null;
  }

  public set selectedInputId(id: string | null) {
    this.selectedInputIds.clear();
    if (id) this.selectedInputIds.add(id);
  }

  public onInputMessage?: (pitch: number, velocity: number, isOn: boolean, channel: number) => void;
  public onControlChange?: (cc: number, value: number, channel: number) => void;
  public onPitchBend?: (value: number, channel: number) => void;
  public onDevicesChanged?: () => void;

  /**
   * Everything that is selected, as one thing to send to. Each site that used
   * to look up a single port now sends here instead, so a second destination is
   * just another port on the bus rather than another code path.
   */
  private outputBus(): OutputBus | null {
    const outs = this.outputs.filter(o => this.selectedOutputIds.has(o.id));
    if (outs.length === 0) return null;
    return {
      send: (data: number[], at?: number) => {
        for (const out of outs) {
          // A port that has gone away mid-send must not take the rest with it.
          try {
            if (at === undefined) out.send(data);
            else out.send(data, at);
          } catch { /* the device list will catch up on the next change */ }
        }
      },
    };
  }

  private loadSelection(): { inputs: string[]; outputs: string[] } | null {
    try {
      const raw = localStorage.getItem(MidiDeviceManager.STORE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.inputs) || !Array.isArray(parsed.outputs)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private saveSelection() {
    const name = (ports: Array<MIDIInput | MIDIOutput>, ids: Set<string>) =>
      ports.filter(p => ids.has(p.id)).map(p => p.name ?? '');
    try {
      localStorage.setItem(MidiDeviceManager.STORE_KEY, JSON.stringify({
        inputs: name(this.inputs, this.selectedInputIds),
        outputs: name(this.outputs, this.selectedOutputIds),
      }));
    } catch { /* a full or disabled store is not worth failing over */ }
  }

  private matchByName(ports: Array<MIDIInput | MIDIOutput>, names: string[]): string[] {
    const wanted = names.map(n => n.toLowerCase());
    return ports
      .filter(p => wanted.some(w => (p.name ?? '').toLowerCase().includes(w)))
      .map(p => p.id);
  }

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

    // Every listener is cleared before any is bound, so a port that has just
    // been unticked cannot go on playing — which is what made a change of
    // device look as though the old one was still active.
    this.inputs.forEach(input => {
      input.onmidimessage = null;
    });

    // Nothing chosen yet: take what was saved last time, and failing that the
    // ports this instrument is usually played through.
    if (!this.restored) {
      this.restored = true;
      const saved = this.loadSelection();
      const inputNames = saved?.inputs?.length ? saved.inputs : MidiDeviceManager.DEFAULT_INPUTS;
      const outputNames = saved?.outputs?.length ? saved.outputs : MidiDeviceManager.DEFAULT_OUTPUTS;
      for (const id of this.matchByName(this.inputs, inputNames)) this.selectedInputIds.add(id);
      for (const id of this.matchByName(this.outputs, outputNames)) this.selectedOutputIds.add(id);
      // Still nothing — an unfamiliar rig — so fall back to the first port
      // rather than leaving the instrument silent.
      if (this.selectedOutputIds.size === 0 && this.outputs.length > 0) {
        this.selectedOutputIds.add(this.outputs[0].id);
      }
      if (this.selectedInputIds.size === 0 && this.inputs.length > 0) {
        this.selectedInputIds.add(this.inputs[0].id);
      }
    } else {
      // A port that has been unplugged is dropped, but a port that comes back
      // is picked up again by the name it was saved under.
      const saved = this.loadSelection();
      if (saved) {
        for (const id of this.matchByName(this.inputs, saved.inputs)) this.selectedInputIds.add(id);
        for (const id of this.matchByName(this.outputs, saved.outputs)) this.selectedOutputIds.add(id);
      }
    }

    // Open the selected outputs now, so the MPE configuration that follows is
    // not sent into a port that is still closed.
    for (const output of this.outputs) {
      if (this.selectedOutputIds.has(output.id)) this.ensureOutputOpen(output);
    }

    for (const input of this.inputs) {
      if (this.selectedInputIds.has(input.id)) {
        input.onmidimessage = this.handleMidiMessage.bind(this);
      }
    }
  }

  public setInputEnabled(id: string, enabled: boolean) {
    if (enabled) this.selectedInputIds.add(id);
    else this.selectedInputIds.delete(id);
    this.saveSelection();
    this.updateDevices();
    if (this.onDevicesChanged) this.onDevicesChanged();
  }

  public setOutputEnabled(id: string, enabled: boolean) {
    if (enabled) {
      this.selectedOutputIds.add(id);
      const output = this.outputs.find(o => o.id === id);
      if (output) this.ensureOutputOpen(output);
    } else {
      // Silence it on the way out. A port dropped mid-chord would otherwise
      // hold those notes for ever, with nothing left able to release them.
      const output = this.outputs.find(o => o.id === id);
      if (output) {
        try {
          for (let ch = 0; ch < 16; ch++) {
            output.send([0xB0 | ch, 123, 0]);
            output.send([0xB0 | ch, 64, 0]);
          }
        } catch { /* already gone */ }
      }
      this.selectedOutputIds.delete(id);
      this.lastBendSemitones.clear();
    }
    this.saveSelection();
    if (this.onDevicesChanged) this.onDevicesChanged();
  }

  /** Kept for the old single-select callers. */
  public selectInput(id: string) {
    this.selectedInputIds.clear();
    this.selectedInputIds.add(id);
    this.saveSelection();
    this.updateDevices();
  }

  public selectOutput(id: string) {
    for (const existing of [...this.selectedOutputIds]) {
      if (existing !== id) this.setOutputEnabled(existing, false);
    }
    this.setOutputEnabled(id, true);
  }

  // Web MIDI ports start out closed. send() opens them implicitly, but that
  // open is asynchronous, so anything sent first can be dropped. Opening up
  // front means the first message out is never the one that pays for it.
  /** Open every selected port, so none of them drops the first message. */
  private async ensureOutputsOpen(): Promise<void> {
    await Promise.all(
      this.outputs.filter(o => this.selectedOutputIds.has(o.id)).map(o => this.ensureOutputOpen(o))
    );
  }

  private async ensureOutputOpen(output: MIDIOutput): Promise<void> {
    if (output.connection === 'open') return;
    try {
      await output.open();
    } catch (e) {
      console.warn('Failed to open MIDI output', output.name, e);
    }
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
    if (!this.midiAccess || this.selectedOutputIds.size === 0) return;
    
    const output = this.outputBus();
    if (!output) return;
    
    const status = 0xB0 | ((channel - 1) & 0x0F);

    if (delayMs > 0) {
      output.send([status, cc, value], window.performance.now() + delayMs);
    } else {
      output.send([status, cc, value]);
    }
  }


  // In MPE, a controller on the master channel applies to the whole zone, but
  // plenty of instruments only act on the member channel a voice is playing on.
  // Sending both keeps the mod wheel (and friends) behaving the way it would
  // if the controller were plugged straight into the DAW.
  public sendControlChangeAllChannels(cc: number, value: number) {
    if (!this.midiAccess || this.selectedOutputIds.size === 0) return;
    const output = this.outputBus();
    if (!output) return;

    const now = window.performance.now();
    for (let channel = 0; channel < 16; channel++) {
      output.send([0xB0 | channel, cc, value], now + channel * 0.2);
    }
  }

  public sendMpeExpression(channel: number, value: number, delayMs: number = 0) {
    if (!this.midiAccess || this.selectedOutputIds.size === 0) return;
    const output = this.outputBus();
    if (!output) return;

    value = Math.max(0, Math.min(127, Math.round(value)));
    const status = 0xB0 | (channel - 1);

    if (delayMs > 0) {
      output.send([status, 11, value], window.performance.now() + delayMs);
    } else {
      output.send([status, 11, value]);
    }
  }

    public async setMpeBendRange(semitones: number) {
    if (!this.midiAccess || this.selectedOutputIds.size === 0) return;
    const output = this.outputBus();
    if (!output) return;

    // A port that has not been opened yet is "closed", and sending into it
    // races the implicit open — the configuration below is silently lost, so
    // the synth keeps its default +/-2 bend range and glides barely move.
    await this.ensureOutputsOpen();

    // These 68 messages used to go out as one burst, which plugins and drivers
    // can drop under load — the symptom being MPE that only behaves after the
    // configuration is sent a second or third time. Spacing them out costs a
    // few inaudible milliseconds and makes the configuration stick.
    const now = window.performance.now();
    const gap = 1.5;
    let step = 0;
    const at = () => now + (step++ * gap);

    // MPE Configuration Message (MCM) on the master channel: RPN 0x00 0x06,
    // value 15 = member channels 2-16.
    output.send([0xB0, 101, 0], at());
    output.send([0xB0, 100, 6], at());
    output.send([0xB0, 6, 15], at());
    output.send([0xB0, 38, 0], at());

    // Let the zone take effect before configuring the member channels.
    step += 8;

    this.sendBendRangeRpn(output, semitones, at);
  }

  /**
   * Pitch bend sensitivity only — no MPE zone message. Anything that sends
   * bend needs the synth to agree on what a bend unit is worth, whether or not
   * MPE is involved: without this the synth keeps its +/-2 default while the
   * app computes against the configured range, and every bend comes out a
   * fraction of its intended size.
   */
  public async setBendRangeOnly(semitones: number) {
    if (!this.midiAccess || this.selectedOutputIds.size === 0) return;
    const output = this.outputBus();
    if (!output) return;
    await this.ensureOutputsOpen();

    const now = window.performance.now();
    let step = 0;
    this.sendBendRangeRpn(output, semitones, () => now + (step++ * 1.5));
  }

  private sendBendRangeRpn(output: OutputBus, semitones: number, at: () => number) {
    // Pitch Bend Sensitivity RPN on every channel
    for (let ch = 1; ch <= 16; ch++) {
      const status = 0xB0 | (ch - 1);
      output.send([status, 101, 0], at()); // RPN MSB
      output.send([status, 100, 0], at()); // RPN LSB
      output.send([status, 6, semitones], at()); // Data Entry MSB (semitones)
      output.send([status, 38, 0], at()); // Data Entry LSB (cents)
      output.send([status, 101, 127], at()); // RPN null: stop further data entry
      output.send([status, 100, 127], at()); //   from being misread as bend range
    }
  }

  // --- Global bend offset -------------------------------------------------
  // The glide engine is the only author of glide bend, per channel. The
  // velocity envelope needs to bend on top of that without ever writing to the
  // same place, so it publishes an offset here: the last bend sent on each
  // channel is remembered, and the offset is added on the way out. When the
  // offset moves, every channel is refreshed from its remembered value.
  private lastBendSemitones: Map<number, number> = new Map();
  private bendOffsetSemitones: number = 0;
  private lastBendRange: number = 48;
  private mpeMode: boolean = false;

  /**
   * In MPE, channel 1 is the master channel and its pitch bend applies to the
   * whole zone. The offset must therefore only ever go to member channels —
   * bending master as well would apply it twice and leave a permanent shift on
   * every note. Outside MPE there are no member channels and channel 1 is
   * where the notes are, so that is exactly where it has to go.
   */
  public setMpeMode(enabled: boolean) {
    if (this.mpeMode === enabled) return;
    this.mpeMode = enabled;
    // Whatever the previous mode left on the master channel has to go, or it
    // becomes a fixed transposition of everything that follows.
    this.sendNeutralBend(1);
    this.lastBendSemitones.clear();
  }

  private sendNeutralBend(channel: number) {
    if (!this.midiAccess || this.selectedOutputIds.size === 0) return;
    const output = this.outputBus();
    if (!output) return;
    output.send([0xE0 | ((channel - 1) & 0x0F), 0, 64]); // 8192 = centre
  }

  /**
   * Per-voice modulation, kept apart from the global offset because the two
   * layers have different reach: vibrato is one shape across the whole
   * instrument, while the velocity envelope belongs to the note that played it.
   * A channel's bend is its glide position plus both.
   */
  public setChannelBendOffset(channel: number, semitones: number) {
    if (this.channelBendOffsets.get(channel) === semitones) return;
    if (semitones === 0) this.channelBendOffsets.delete(channel);
    else this.channelBendOffsets.set(channel, semitones);
    // Re-send from the glide position this channel was left at, so the offset
    // lands on top of the note rather than replacing where it had bent to.
    this.emitBend(channel, this.lastBendSemitones.get(channel) ?? 0, this.lastBendRange, 0);
  }

  public clearChannelBendOffset(channel: number) {
    if (!this.channelBendOffsets.has(channel)) return;
    this.channelBendOffsets.delete(channel);
    this.emitBend(channel, this.lastBendSemitones.get(channel) ?? 0, this.lastBendRange, 0);
  }

  /**
   * A raw channel is left out of both modulation layers. The glide bend still
   * applies — raw means unmodulated, not unbent.
   */
  public setChannelRaw(channel: number, raw: boolean) {
    if (raw) this.rawChannels.add(channel);
    else this.rawChannels.delete(channel);
  }

  public setGlobalBendOffset(semitones: number) {
    if (semitones === this.bendOffsetSemitones) return;
    this.bendOffsetSemitones = semitones;

    if (this.lastBendSemitones.size === 0) {
      // Nothing has bent yet. With MPE off no bend is ever sent, so without
      // this the offset would sit unheard until something else happened to
      // bend. In MPE this must not happen at all: channel 1 is the master and
      // would bend the whole zone on top of the per-voice bends below.
      if (!this.mpeMode) this.emitBend(1, 0, this.lastBendRange, 0);
      return;
    }

    const touched = new Set([...this.lastBendSemitones.keys(), ...this.channelBendOffsets.keys()]);
    for (const channel of touched) {
      this.emitBend(channel, this.lastBendSemitones.get(channel) ?? 0, this.lastBendRange, 0);
    }
  }

  private channelBendOffsets: Map<number, number> = new Map();
  private rawChannels: Set<number> = new Set();

  public clearBendMemory(channel?: number) {
    if (channel === undefined) this.lastBendSemitones.clear();
    else this.lastBendSemitones.delete(channel);
  }

  public sendMpePitchBend(channel: number, semitones: number, bendRange: number, delayMs: number = 0) {
    this.lastBendSemitones.set(channel, semitones);
    this.lastBendRange = bendRange;
    this.emitBend(channel, semitones, bendRange, delayMs);
  }

  private emitBend(channel: number, semitones: number, bendRange: number, delayMs: number) {
    if (!this.midiAccess || this.selectedOutputIds.size === 0) return;
    const output = this.outputBus();
    if (!output) return;

    const modulation = this.rawChannels.has(channel)
      ? 0
      : this.bendOffsetSemitones + (this.channelBendOffsets.get(channel) ?? 0);
    let v = Math.round(8192 + ((semitones + modulation) * 8192 / bendRange));
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
    if (!this.midiAccess || this.selectedOutputIds.size === 0) return;
    const output = this.outputBus();
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
    if (!this.midiAccess || this.selectedOutputIds.size === 0) return;
    
    const output = this.outputBus();
    if (!output) return;
    const status = (isOn ? 0x90 : 0x80) | (channel - 1);
    
    if (delayMs > 0) {
      output.send([status, pitch, velocity], window.performance.now() + delayMs);
    } else {
      output.send([status, pitch, velocity]);
    }
  }
}
