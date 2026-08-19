import { NoteEvent } from '../types';

// Simple polyphonic synthesizer using Web Audio API as a fallback
export class SimpleSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume: number = 0.3;

  public setVolume(value: number) {
    this.masterVolume = value;
    if (this.masterGain) {
      this.masterGain.gain.value = value;
    }
  }
  
  // Track active oscillators by pitch
  private activeOscillators: Map<number, { osc: OscillatorNode; gain: GainNode }[]> = new Map();
  private activeChannels: Map<number, number> = new Map();
  private sustainPedalActive: boolean = false;
  private sustainedNotes: Set<number> = new Set();

  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume; // prevent clipping
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }


  public panic() {
    this.activeOscillators.forEach((nodes) => {
      nodes.forEach(({ osc, gain }) => {
        try {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
        } catch (e) {}
      });
    });
    this.activeOscillators.clear();
    this.activeChannels.clear();
    this.sustainPedalActive = false;
    this.sustainedNotes.clear();
  }

  public handleNoteEvent(event: NoteEvent) {
    if (!this.ctx || !this.masterGain) return;

    if (event.isPitchBend) {
      this.bendNote(event.pitch, event.pitchBendValue || 0, event.delayMs || 0);
    } else if (event.isCC) {
      if (event.ccNumber === 126) {
         const semitones = ((event.ccValue || 64) - 64) / 64 * 2;
         this.activeOscillators.forEach((nodes, p) => {
            this.bendNote(p, semitones, event.delayMs || 0);
         });
      } else if (event.ccNumber === 64) {
         this.sustainPedalActive = (event.ccValue || 0) >= 64;
         if (!this.sustainPedalActive) {
            // release sustained notes
            this.sustainedNotes.forEach(p => {
               this.stopNote(p, event.delayMs || 0);
            });
            this.sustainedNotes.clear();
         }
      }
    } else if (event.isOn && event.velocity > 0) {
      this.playNote(event.pitch, event.velocity, event.delayMs || 0, event.mpeChannel || 1);
    } else {
      this.stopNote(event.pitch, event.delayMs || 0);
    }
  }
  
  
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

  private bendNote(pitch: number, semitones: number, delayMs: number) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime + (delayMs / 1000);
    const targetFreq = this.midiToFreq(pitch + semitones);
    const nodes = this.activeOscillators.get(pitch);
    if (nodes) {
      nodes.forEach(({ osc }) => {
        osc.frequency.cancelScheduledValues(time);
        osc.frequency.linearRampToValueAtTime(targetFreq, time);
      });
    }
  }

  private midiToFreq(midiPitch: number) {
    return 440 * Math.pow(2, (midiPitch - 69) / 12);
  }

  private playNote(pitch: number, velocity: number, delayMs: number, channel: number = 1) {
    if (!this.ctx || !this.masterGain) return;

        const now = this.ctx.currentTime;
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
    noteGain.gain.setTargetAtTime(velocityScale * 0.6, startTime + 0.02, 0.1);

    osc.connect(noteGain);
    noteGain.connect(this.masterGain);

    osc.start(startTime);

    if (!this.activeOscillators.has(pitch)) {
      this.activeOscillators.set(pitch, []);
    }
    
    // Store references to stop them later
    this.activeOscillators.get(pitch)!.push({ osc, gain: noteGain });
  }

  private stopNote(pitch: number, delayMs: number) {
    if (!this.ctx) return;
    
        const stopTime = this.ctx.currentTime + (delayMs / 1000);
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
      }, (delayMs + 600));
    }
  }
}
