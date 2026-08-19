import { OrchidParams, NoteEvent } from '../types';

export class OrchidEngine {
  public params: OrchidParams;

  public manualBaseType: number = -1; // -1 means Scale/Default
  public ext_m7: boolean = false;
  public ext_M7: boolean = false;
  public ext_6: boolean = false;
  public ext_9: boolean = false;
  public ext_alt: boolean = false;
  public baseTypeLatched: boolean = false;
  public latchedExtensions: Set<string> = new Set();
  public lastPitchClasses: number[] = [];



  // Track the actual notes currently playing for a given physical input key
  private activePitchesMemory: Record<number, Array<{ pitch: number, delayUsed: number, isBass: boolean, timeoutId?: any, mpeChannel?: number, mpeBasePitch?: number, mpeCurrentPitch?: number, isInternalSynthOnly?: boolean }>> = {};
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
      const delayMs = delayOffset + (i * stepTime) + (channel * 0.1); // Add jitter per channel
      
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
  }

  // Callback to emit output MIDI (to Web MIDI or Audio Synth)
  public onOutputNote?: (event: NoteEvent) => void;
  public onStateChange?: () => void;
  public lastUpdateReason: 'inversion' | 'chord' | 'none' = 'none';
  public onParamsUpdate?: (params: OrchidParams) => void;
  public onPerformanceKey?: (pitch: number, isDown: boolean, allReleased: boolean) => void;

  public sustainPedalActive: boolean = false;
  private strumplatePitches: Array<{ pitch: number, sourceKey: number }> = [];
  private lastStrumIndex: number = -1;
  public lastPerformanceKey: number = 60;
  private lastTriggeredChordKey: number = -1;
  private consecutiveChordCount: number = 0;
  private alternateStrumState: number = 0;
  
  // Track active arpeggio notes for sustain pedal handling
  public activeArpeggioNotes: Map<number, { pitch: number, mpeChannel?: number, timeoutId?: any }> = new Map();


  constructor(initialParams: OrchidParams) {
    this.params = { ...initialParams };
  }


  public panic() {
    for (const pitch in this.activePitchesMemory) {
      const memory = this.activePitchesMemory[pitch];
      if (memory) {
        memory.forEach(m => {
          if (m.timeoutId) clearTimeout(m.timeoutId);
        });
      }
    }
    this.activePitchesMemory = {};
    this.heldKeys.clear();
    this.heldCustomVoicings.clear();
    this.lastStrumIndex = -1;
    this.sustainPedalActive = false;
    this.strumplatePitches = [];
    this.activeArpeggioNotes.clear();
    this.notifyState();
  }

  public reset() {
    this.activePitchesMemory = {};
    this.clearExtensions();
  }

  public clearExtensions() {
    this.manualBaseType = -1;
    this.ext_m7 = false;
    this.ext_M7 = false;
    this.ext_6 = false;
    this.ext_9 = false;
    this.notifyState();
    this.retriggerHeldKeys();
  }

  public get currentEffectiveBaseType(): number {
    let effectiveBaseType = -1;
    if (this.params.keyboardMapping === 2 && this.lastPerformanceKey !== undefined) {
      const pc = this.lastPerformanceKey % 12;
      const scaleData = this.getScaleData(pc, this.params.keyScale);
      effectiveBaseType = scaleData.type;
    } else if (this.params.keyboardMapping === 1) {
      effectiveBaseType = 0;
    }
    
    if (this.manualBaseType !== -1) {
      effectiveBaseType = this.manualBaseType;
    }
    
    if (effectiveBaseType === -1 && this.params.keyboardMapping === 0) {
      if (this.ext_m7) {
        effectiveBaseType = 1; // Minor
      } else if (this.ext_M7 || this.ext_6 || this.ext_9) {
        effectiveBaseType = 0; // Major
      } else {
        return -1;
      }
    }
    
    // Do NOT default to 0 if we legitimately have no base type in classic mode
    // Actually, keyboard mapping 1 or 2 already sets it above. 
    return effectiveBaseType;
  }

  public setBaseType(type: number) {
    this.manualBaseType = type;
    this.baseTypeLatched = false;
    this.lastUpdateReason = 'chord';
    this.notifyState();
    this.retriggerHeldKeys();
  }

  public releaseBaseType(type: number) {
    if (this.manualBaseType !== type) return;
    if (this.heldKeys.size > 0) {
      this.baseTypeLatched = true;
    } else {
      this.manualBaseType = -1;
      this.baseTypeLatched = false;
      this.lastUpdateReason = 'chord';
      this.notifyState();
      this.retriggerHeldKeys();
    }
  }

  public toggleExtension(ext: 'm7' | 'M7' | '6' | '9' | 'alt') {
    if (ext === 'm7') {
      this.setExtension('m7', !this.ext_m7);
    } else if (ext === 'M7') {
      this.setExtension('M7', !this.ext_M7);
    } else if (ext === '6') {
      this.setExtension('6', !this.ext_6);
    } else if (ext === '9') {
      this.setExtension('9', !this.ext_9);
    } else if (ext === 'alt') {
      this.setExtension('alt', !this.ext_alt);
    }
  }

  public setExtension(ext: 'm7' | 'M7' | '6' | '9' | 'alt', active: boolean) {
    if (ext === 'm7') {
      this.ext_m7 = active;
      if (active) this.ext_M7 = false;
    } else if (ext === 'M7') {
      this.ext_M7 = active;
      if (active) this.ext_m7 = false;
    } else if (ext === '6') this.ext_6 = active;
    else if (ext === '9') this.ext_9 = active;
    else if (ext === 'alt') this.ext_alt = active;

    this.latchedExtensions.delete(ext);
    this.lastUpdateReason = 'chord';
    this.notifyState();
    this.retriggerHeldKeys();
  }

  public releaseExtension(ext: 'm7' | 'M7' | '6' | '9' | 'alt') {
    const isExtActive = this[`ext_${ext}` as keyof this] as boolean;
    if (!isExtActive) return;
    
    if (this.heldKeys.size > 0) {
      this.latchedExtensions.add(ext);
    } else {
      if (ext === 'm7') this.ext_m7 = false;
      else if (ext === 'M7') this.ext_M7 = false;
      else if (ext === '6') this.ext_6 = false;
      else if (ext === '9') this.ext_9 = false;
      else if (ext === 'alt') this.ext_alt = false;
      
      this.latchedExtensions.delete(ext);
      this.lastUpdateReason = 'chord';
      this.notifyState();
      this.retriggerHeldKeys();
    }
  }

  public setModifiers(baseType: number, ext_m7: boolean, ext_M7: boolean, ext_6: boolean, ext_9: boolean) {
    this.manualBaseType = baseType;
    this.ext_m7 = ext_m7;
    this.ext_M7 = ext_M7;
    this.ext_6 = ext_6;
    this.ext_9 = ext_9;
    this.notifyState();
    this.retriggerHeldKeys();
  }

  public notifyState() {
    if (this.onStateChange) this.onStateChange();
  }

  private physicallyReleasedKeys: Set<number> = new Set();
  public heldKeys: Map<number, number> = new Map();
  public heldCustomVoicings: Map<number, number[]> = new Map();

  public retriggerHeldKeys(skipBass: boolean = false, forcePlay: boolean = false) {
    const keysToRetrigger = Array.from(this.heldKeys.entries());
    
    for (const [pitch, velocity] of keysToRetrigger) {
      if (pitch <= 127) {
         const cv = this.heldCustomVoicings.get(pitch);
         this.handleMidi(pitch, velocity, true, skipBass, true, forcePlay, false, cv);
      }
    }
  }

  public updateRegister(newStart: number) {
    this.params.chordRegisterStart = newStart;
    this.lastUpdateReason = 'chord';
    this.retriggerHeldKeys(true);
  }

  public updateInversion(newInv: number) {
    this.params.chordInversion = newInv;
    this.lastUpdateReason = 'inversion';
    this.retriggerHeldKeys(true);
  }

  private pickVoicing(): string {
    const vx = this.params.voicingX;
    const vy = this.params.voicingY;
    
    const nodes = [
      { name: 'Closed', x: 0, y: -1 },
      { name: 'Drop 2', x: 0.951, y: -0.309 },
      { name: 'Drop 3', x: 0.588, y: 0.809 },
      { name: 'Drop 4', x: -0.588, y: 0.809 },
      { name: 'Open', x: -0.951, y: -0.309 }
    ];
    
    let weights = [];
    let totalWeight = 0;
    
    for (const node of nodes) {
      const d = Math.sqrt(Math.pow(vx - node.x, 2) + Math.pow(vy - node.y, 2));
      const w = 1 / Math.pow(Math.max(d, 0.001), 2.5); // IDW
      weights.push(w);
      totalWeight += w;
    }
    
    let rnd = Math.random() * totalWeight;
    for (let i = 0; i < nodes.length; i++) {
      if (rnd < weights[i]) return nodes[i].name;
      rnd -= weights[i];
    }
    return 'Closed';
  }

  private getScaleData(pc: number, scaleType: number): { offset: number; type: number; seventh: 'M7' | 'm7' | null } {
    if (scaleType === 0) {
      // Major
      switch (pc) {
        case 0: return { offset: 0, type: 0, seventh: 'M7' };
        case 2: return { offset: 2, type: 1, seventh: 'm7' };
        case 4: return { offset: 4, type: 1, seventh: 'm7' };
        case 5: return { offset: 5, type: 0, seventh: 'M7' };
        case 7: return { offset: 7, type: 0, seventh: 'm7' };
        case 9: return { offset: 9, type: 1, seventh: 'm7' };
        case 11: return { offset: 11, type: 3, seventh: 'm7' };
        case 1: return { offset: 1, type: 0, seventh: null };
        case 3: return { offset: 3, type: 0, seventh: null };
        case 6: return { offset: 8, type: 0, seventh: null };
        case 8: return { offset: 10, type: 0, seventh: null };
        case 10: return { offset: 2, type: 0, seventh: null };
      }
    } else if (scaleType === 1) {
      // Natural Minor
      switch (pc) {
        case 0: return { offset: 0, type: 1, seventh: 'm7' };
        case 2: return { offset: 2, type: 3, seventh: 'm7' };
        case 4: return { offset: 3, type: 0, seventh: null }; // Wait, original script had case 4? Actually III is 3. Let's stick to standard minor.
        case 3: return { offset: 3, type: 0, seventh: 'M7' }; // III
        case 5: return { offset: 5, type: 1, seventh: 'm7' };
        case 7: return { offset: 7, type: 1, seventh: 'm7' };
        case 8: return { offset: 8, type: 0, seventh: 'M7' };
        case 10: return { offset: 10, type: 0, seventh: 'm7' };
        case 1: return { offset: 7, type: 0, seventh: null };
        case 6: return { offset: 1, type: 0, seventh: null };
        case 9: return { offset: 8, type: 0, seventh: null };
        case 11: return { offset: 10, type: 0, seventh: null };
      }
    } else if (scaleType === 2) {
      // Melodic Minor
      switch (pc) {
        case 0: return { offset: 0, type: 1, seventh: 'M7' };
        case 2: return { offset: 2, type: 1, seventh: 'm7' };
        case 3: return { offset: 3, type: 0, seventh: 'M7' };
        case 5: return { offset: 5, type: 0, seventh: 'm7' };
        case 7: return { offset: 7, type: 0, seventh: 'm7' };
        case 9: return { offset: 9, type: 3, seventh: 'm7' };
        case 11: return { offset: 11, type: 3, seventh: 'm7' };
        case 1: return { offset: 7, type: 1, seventh: null };
        case 4: return { offset: 3, type: 0, seventh: null };
        case 6: return { offset: 8, type: 0, seventh: null };
        case 8: return { offset: 10, type: 0, seventh: null };
        case 10: return { offset: 1, type: 0, seventh: null };
      }
    }
    return { offset: pc, type: 0, seventh: null };
  }

  private getMappedRootPitch(physicalPitch: number): number {
    const mappingMode = this.params.keyboardMapping;
    const pc = physicalPitch % 12;
    const octaveBase = physicalPitch - pc;

    if (mappingMode === 2) {
      // Key Mode
      const scaleData = this.getScaleData(pc, this.params.keyScale);
      const mappedPitchClass = (this.params.keyRoot + scaleData.offset) % 12;
      return octaveBase + mappedPitchClass;
    }

    if (mappingMode === 1) {
      // Circle of Fifths
      const mappedPitchClass = (pc * 7) % 12;
      return octaveBase + mappedPitchClass;
    }

    return physicalPitch; // Classic Mode
  }

  private getIntervalsForState(perfKey?: number): number[] {
    let effectiveBaseType = -1; // defaults to -1 to detect classic root-only mode
    let diatonicSeventh: 'M7' | 'm7' | null = null;

    // Diatonic default if Key Mode
    if (this.params.keyboardMapping === 2 && perfKey !== undefined) {
      const pc = perfKey % 12;
      const scaleData = this.getScaleData(pc, this.params.keyScale);
      effectiveBaseType = scaleData.type;
      diatonicSeventh = scaleData.seventh;
    } else if (this.params.keyboardMapping === 1) {
      effectiveBaseType = 0; // Circle of Fifths defaults to major
    }

    // Override from Control Octave or UI
    if (this.manualBaseType !== -1) {
      effectiveBaseType = this.manualBaseType;
    }

    const intervals = [0];
    
    // Single Note fallback if no modifiers held (Classic mode)
    if (effectiveBaseType === -1 && this.params.keyboardMapping === 0) {
      if (!this.ext_m7 && !this.ext_M7 && !this.ext_6 && !this.ext_9) {
        return []; // Indicate pure single note
      }
      if (this.ext_m7) {
        effectiveBaseType = 1; // Minor fallback
      } else {
        effectiveBaseType = 0; // Major fallback
      }
    }
    
    // Fallback if somehow still -1
    if (effectiveBaseType === -1) effectiveBaseType = 0;

    if (effectiveBaseType === 0) intervals.push(4, 7); // Major
    if (effectiveBaseType === 1) intervals.push(3, 7); // Minor
    if (effectiveBaseType === 2) intervals.push(5, 7); // Quartal/Sus style based on script
    
    const isDominant = effectiveBaseType === 3 && this.ext_alt;
    if (effectiveBaseType === 3) {
      if (isDominant) intervals.push(4, 7); // Dominant Triad
      else intervals.push(3, 6); // Diminished Triad
    }

    if (isDominant) {
      intervals.push(10); // Dominant implies b7
      if (this.ext_m7) intervals.push(13); // b9
      if (this.ext_M7) intervals.push(15); // #9
      if (this.ext_6) intervals.push(20);  // b13
      if (this.ext_9) intervals.push(22);  // #13
    } else {
      const always7 = this.params.alwaysAdd7th && this.params.keyboardMapping === 2;
      let active_m7 = this.ext_m7;
      let active_M7 = this.ext_M7;

      if (always7) {
        if (!this.ext_m7 && !this.ext_M7) {
          if (diatonicSeventh === 'M7') active_M7 = true;
          else if (diatonicSeventh === 'm7') active_m7 = true;
          else if (effectiveBaseType !== 3) {
            if (effectiveBaseType === 0) active_M7 = true;
            else active_m7 = true;
          }
        }
      }

      if (active_m7) intervals.push(10);
      if (active_M7) intervals.push(11);
      if (this.ext_6) intervals.push(9);
      if (this.ext_9) intervals.push(14);
    }

    return intervals;
  }

  private getIntervalPriority(interval: number): number {
    const pc = interval % 12;
    if (pc === 0) return 100; // Root
    if (pc === 3 || pc === 4) return 90; // 3rd
    if (pc === 10 || pc === 11) return 80; // 7th
    if (pc === 7) return 50; // 5th
    return 40 - interval; // Higher intervals have slightly lower base priority
  }

  private calculateFoldedPitches(rootPitch: number, intervals: number[]): number[] {
    const startRange = this.params.chordRegisterStart;
    const endRange = startRange + this.params.voicingRange;
    const registerStartPC = startRange % 12;

    let maxNotes = 6;
    const density = this.params.chordDensity ?? 4;
    if (density === 0) { maxNotes = 3; }
    else if (density === 1) { maxNotes = 4; }
    else if (density === 2) { maxNotes = 5; }
    else if (density === 3) { maxNotes = 5; }
    else if (density === 4) { maxNotes = 6; }
    
    let extensionBoost = 0;
    if (this.ext_m7) extensionBoost++;
    if (this.ext_M7) extensionBoost++;
    if (this.ext_6) extensionBoost++;
    if (this.ext_9) extensionBoost++;
    if (this.ext_alt) extensionBoost++;
    
    let targetNotes = maxNotes + extensionBoost;
    if (targetNotes > intervals.length) {
      targetNotes = intervals.length;
    }

    const scoredIntervals = intervals.map(interval => {
      // Deterministic scoring: base priority + tiebreaker favoring smaller intervals
      const score = this.getIntervalPriority(interval) + (100 - interval) / 100;
      return { interval, score };
    });

    scoredIntervals.sort((a, b) => b.score - a.score);
    const selectedIntervals = scoredIntervals.slice(0, targetNotes).map(s => s.interval).sort((a, b) => a - b);

    const inv = this.params.chordInversion;
    if (inv > 0) {
      for (let i = 0; i < inv; i++) {
        if (selectedIntervals.length > 0) {
          selectedIntervals[0] += 12;
          selectedIntervals.sort((a, b) => a - b);
        }
      }
    } else if (inv < 0) {
      for (let i = 0; i < Math.abs(inv); i++) {
        if (selectedIntervals.length > 0) {
          selectedIntervals[selectedIntervals.length - 1] -= 12;
          selectedIntervals.sort((a, b) => a - b);
        }
      }
    }

    const finalPitches: number[] = [];
    const rootPC = rootPitch % 12;
    const anchorPitch = startRange + ((rootPC - registerStartPC + 12) % 12);

    for (const interval of selectedIntervals) {
      let pitch = anchorPitch + interval;
      // Fold down if it exceeds range too much, but allow some natural extension bleed
      while (pitch > endRange && pitch >= startRange + 12) {
        pitch -= 12;
      }
      finalPitches.push(pitch);
    }
    
    let filteredPitches = finalPitches;

    return filteredPitches;
  }

  public getArpeggioPitches(): number[] {
    let pitchClasses: number[] = [];

    // Extract exact pitch classes from currently playing memory (mirrors Strumplate logic)
    let hasNotes = false;
    for (const [pitch, _] of this.heldKeys.entries()) {
      const memory = this.activePitchesMemory[pitch];
      if (memory) {
        for (const note of memory) {
          if (!note.isBass) {
            pitchClasses.push(note.pitch % 12);
            hasNotes = true;
          }
        }
      }
    }
    
    if (!hasNotes) return [];
    
    pitchClasses = Array.from(new Set(pitchClasses)).sort((a, b) => a - b);
    
    const allNotes: number[] = [];
    for (let i = 0; i <= 127; i++) {
       if (pitchClasses.includes(i % 12)) {
          allNotes.push(i);
       }
    }
    
    const startReg = this.params.arpeggioRegisterStart ?? 48;
    const validNotes = allNotes.filter(n => n >= startReg);
    
    if (validNotes.length === 0) return [];
    
    const firstNote = validNotes[0];
    const numOctaves = this.params.arpeggioOctaves ?? 4;
    const maxPitch = firstNote + (numOctaves * 12);
    
    return validNotes.filter(n => n < maxPitch);
  }

  public handleArpeggioNoteOn(pitch: number, velocity: number) {
    if (this.activeArpeggioNotes.has(pitch)) {
       const existing = this.activeArpeggioNotes.get(pitch);
       if (existing && existing.timeoutId) {
           clearTimeout(existing.timeoutId);
       }
       // Retrigger
       this.handleArpeggioNoteOff(pitch, true);
    }
    const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
    const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;
    this.emitNoteOn(pitch, velocity, 0, channel, false, isMidiOnly);
    
    // Auto-release arpeggio notes shortly after triggering (staccato pulse)
    const timeoutId = setTimeout(() => {
      if (this.activeArpeggioNotes.has(pitch)) {
        this.handleArpeggioNoteOff(pitch);
      }
    }, 100);
    
    this.activeArpeggioNotes.set(pitch, { pitch, mpeChannel: channel, timeoutId });
  }

  public handleArpeggioNoteOff(pitch: number, force: boolean = false) {
    const note = this.activeArpeggioNotes.get(pitch);
    if (note) {
      if (note.timeoutId) {
        clearTimeout(note.timeoutId);
      }
      this.emitNoteOff(pitch, 0, 0, note.mpeChannel);
      if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
      this.activeArpeggioNotes.delete(pitch);
    }
  }

  private recalculateActiveChords() {
    for (const pkStr in this.activePitchesMemory) {
      const perfKey = parseInt(pkStr);
      const mappedRoot = this.getMappedRootPitch(perfKey);
      const memoryArray = this.activePitchesMemory[perfKey];

      const newIntervals = this.getIntervalsForState(perfKey);
      const newPitches = this.calculateFoldedPitches(mappedRoot, newIntervals);
      
      const oldPitches = memoryArray.filter(n => !n.isBass).map(n => n.pitch);

      // Turn on new ones
      for (const p of newPitches) {
        if (!oldPitches.includes(p) && p >= 0 && p <= 127) {
          this.emitNoteOn(p, 64);
          memoryArray.push({ pitch: p, delayUsed: 0, isBass: false, isInternalSynthOnly: false });
        }
      }

      // Turn off old ones that are no longer valid
      for (const p of oldPitches) {
        if (!newPitches.includes(p)) {
          const noteObj = memoryArray.find(n => n.pitch === p && !n.isBass);
          if (noteObj) {
            this.emitNoteOff(noteObj.mpeBasePitch ?? noteObj.pitch, 0, 0, noteObj.mpeChannel);
            if (noteObj.mpeChannel) this.freeMpeChannel(noteObj.mpeChannel);
          }
          for (let k = memoryArray.length - 1; k >= 0; k--) {
            if (memoryArray[k].pitch === p && !memoryArray[k].isBass) {
              memoryArray.splice(k, 1);
            }
          }
        }
      }
    }
  }

  public updateStrumplatePitches() {
    this.strumplatePitches = [];
    const uniquePitches = new Map<number, number>(); // Map pitch to sourceKey
    for (const [pitch, _] of this.heldKeys.entries()) {
      const memory = this.activePitchesMemory[pitch];
      if (memory) {
        for (const note of memory) {
          if (!note.isBass) {
            uniquePitches.set(note.pitch, pitch);
          }
        }
      }
    }
    
    // Sort pitches
    const sortedPitches = Array.from(uniquePitches.keys()).sort((a, b) => a - b);
    for (const p of sortedPitches) {
      this.strumplatePitches.push({ pitch: p, sourceKey: uniquePitches.get(p)! });
    }
  }

  private handleStrumplate(value: number) {
    const N = this.strumplatePitches.length;
    if (N === 0) return;

    // Map 0-127 to 0 to N-1
    const scaled = (value / 127) * (N - 1);
    const currIndex = Math.round(scaled);

    if (this.lastStrumIndex !== -1 && this.lastStrumIndex !== currIndex) {
      const start = Math.min(this.lastStrumIndex, currIndex);
      const end = Math.max(this.lastStrumIndex, currIndex);
      
      for (let i = start; i <= end; i++) {
        // Trigger if passing through, avoiding re-triggering the exact same index if it was just triggered
        // Actually, just triggering them all in the sweep range is fine. 
        // We will trigger any index that wasn't the exact previous starting index.
        if (i !== this.lastStrumIndex) {
          const noteObj = this.strumplatePitches[i];
          if (!noteObj) continue; // Prevent out-of-bounds access if strumplatePitches shrunk
          
          let channel: number | undefined = undefined;
          let existing: any = null;
          const memory = this.activePitchesMemory[noteObj.sourceKey];
          if (memory) {
            existing = memory.find((n: any) => n.pitch === noteObj.pitch);
            if (existing) channel = existing.mpeChannel;
          }
          if (this.params.mpeEnabled && channel === undefined) {
            channel = this.allocateMpeChannel();
          }

          this.emitNoteOff(noteObj.pitch, 0, 0, channel, false, this.params.omnichordMode && this.params.omnichordSynthMonitor); // Ensure clean pluck retrigger
          this.emitNoteOn(noteObj.pitch, 100, 0, channel, false, this.params.omnichordMode && this.params.omnichordSynthMonitor);
          
          // In Omnichord mode, we send a short pulse for the strum so recorded MIDI notes aren't huge blocks
          if (this.params.omnichordMode) {
             setTimeout(() => {
                this.emitNoteOff(noteObj.pitch, 0, 0, channel, false, this.params.omnichordMode && this.params.omnichordSynthMonitor);
             }, 100);
          }
          
          if (memory && !existing) {
            memory.push({ pitch: noteObj.pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: noteObj.pitch, mpeCurrentPitch: noteObj.pitch, isInternalSynthOnly: false });
          }
        }
      }
    } else if (this.lastStrumIndex === -1) {
      // First touch
      const noteObj = this.strumplatePitches[currIndex];
      if (!noteObj) return; // Prevent out-of-bounds access
      
      let channel: number | undefined = undefined;
      let existing: any = null;
      const memory = this.activePitchesMemory[noteObj.sourceKey];
      if (memory) {
        existing = memory.find((n: any) => n.pitch === noteObj.pitch);
        if (existing) channel = existing.mpeChannel;
      }
      if (this.params.mpeEnabled && channel === undefined) {
        channel = this.allocateMpeChannel();
      }

      this.emitNoteOff(noteObj.pitch, 0, 0, channel, false, this.params.omnichordMode && this.params.omnichordSynthMonitor);
      this.emitNoteOn(noteObj.pitch, 100, 0, channel, false, this.params.omnichordMode && this.params.omnichordSynthMonitor);
      
      if (this.params.omnichordMode) {
         setTimeout(() => {
            this.emitNoteOff(noteObj.pitch, 0, 0, channel, false, this.params.omnichordMode && this.params.omnichordSynthMonitor);
         }, 100);
      }
      
      if (memory && !existing) {
        memory.push({ pitch: noteObj.pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: noteObj.pitch, mpeCurrentPitch: noteObj.pitch, isInternalSynthOnly: false });
      }
    }

    this.lastStrumIndex = currIndex;
  }

  private checkAndClearLatches() {
    if (this.heldKeys.size === 0 && this.physicallyReleasedKeys.size === 0) {
      let changed = false;
      if (this.baseTypeLatched) {
        this.manualBaseType = -1;
        this.baseTypeLatched = false;
        changed = true;
      }
      if (this.latchedExtensions.size > 0) {
        for (const ext of Array.from(this.latchedExtensions)) {
          this[`ext_${ext}` as any] = false;
        }
        this.latchedExtensions.clear();
        changed = true;
      }
      if (changed) {
        this.lastUpdateReason = 'chord';
        this.notifyState();
        this.retriggerHeldKeys(true);
      }
    }
  }

  public handleControlChange(cc: number, value: number, channel: number = 1) {
    if (cc === 127 && channel === 8) {
      if (this.params.omnichordMode || this.sustainPedalActive) {
        this.handleStrumplate(value);
      } else {
        const rangeStart = 24;
        const rangeEnd = 96;
        const newStart = Math.round(rangeStart + (value / 127) * (rangeEnd - rangeStart));
        this.updateRegister(newStart);
        if (this.onParamsUpdate) this.onParamsUpdate({ ...this.params });
      }
      return;
    }

    // Reset last strum index if user releases strumplate (e.g. if we had a way to know they released)
    // For CC, we just track continuous movement. If they stop, it stops.

    if (cc === 64) {
      this.sustainPedalActive = value >= 64;
      if (!this.sustainPedalActive) {
        // Flush arpeggio notes that were sustained
        for (const [pitch, note] of this.activeArpeggioNotes.entries()) {
           if (note.timeoutId) clearTimeout(note.timeoutId);
           const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;
           this.emitNoteOff(pitch, 0, 0, note.mpeChannel, false, isMidiOnly);
           if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }
        this.activeArpeggioNotes.clear();

        // Flush all physically released keys
        for (const pitch of this.physicallyReleasedKeys) {
          this.heldKeys.delete(pitch);
          if (this.activePitchesMemory[pitch]) {
            const notesToKill = this.activePitchesMemory[pitch];
            for (const note of notesToKill) {
              if (note.timeoutId) {
                clearTimeout(note.timeoutId);
              } else {
                this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel, note.isInternalSynthOnly);
              }
              if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
            }
            delete this.activePitchesMemory[pitch];
          }
        }
        this.physicallyReleasedKeys.clear();
        this.updateStrumplatePitches();
        this.checkAndClearLatches();
      }
    }
  }

  

  public handleMidi(pitch: number, velocity: number, isOn: boolean, skipBass: boolean = false, isUpdate: boolean = false, forcePlay: boolean = false, isMemoryTrigger: boolean = false, customVoicing?: number[]) {
    const controlLowBound = 24 + (this.params.controlOctave * 12);
    const controlHighBound = controlLowBound + 11;
    let isControlKey = pitch >= controlLowBound && pitch <= controlHighBound;
    
    // In Free Mode, the whole keyboard is performance keys
    let isFreeMode = this.params.keyboardMapping === 3 && !isMemoryTrigger;
    if (isFreeMode) {
      isControlKey = false;
    }
    
    if (isOn && velocity > 0 && !isUpdate && !isControlKey) {
       this.lastPerformanceKey = pitch;
       if (this.params.inversionRepeat > 0) {
         if (pitch === this.lastTriggeredChordKey) {
           this.consecutiveChordCount++;
         } else {
           this.lastTriggeredChordKey = pitch;
           this.consecutiveChordCount = 0;
         }
       } else {
         this.lastTriggeredChordKey = pitch;
         this.consecutiveChordCount = 0;
       }
       if (this.params.strumAlternate) {
         this.alternateStrumState = this.alternateStrumState === 0 ? 1 : 0;
       }
    }

    if (isFreeMode) {
      if (!isOn || velocity === 0) {
        if (this.sustainPedalActive) {
          this.physicallyReleasedKeys.add(pitch);
        } else {
          this.heldKeys.delete(pitch);
          if (this.activePitchesMemory[pitch]) {
            const notesToKill = this.activePitchesMemory[pitch];
            for (const note of notesToKill) {
              if (note.timeoutId) clearTimeout(note.timeoutId);
              else this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel, note.isInternalSynthOnly);
              if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
            }
            delete this.activePitchesMemory[pitch];
          }
        }
        if (this.onPerformanceKey) this.onPerformanceKey(pitch, false, this.heldKeys.size === 0);
      } else {
        this.heldKeys.set(pitch, velocity);
        
        let stolenNote: any = null;
        
        if (this.params.mpeEnabled && this.sustainPedalActive) {
          let closestPitch = -1;
          let minDiff = 9999;
          
          for (const pk of this.physicallyReleasedKeys) {
            if (this.activePitchesMemory[pk] && this.activePitchesMemory[pk].length > 0) {
              const diff = Math.abs(pk - pitch);
              if (diff < minDiff) {
                minDiff = diff;
                closestPitch = pk;
              }
            }
          }
          
          if (closestPitch !== -1) {
            stolenNote = this.activePitchesMemory[closestPitch][0];
            this.activePitchesMemory[closestPitch] = [];
            this.physicallyReleasedKeys.delete(closestPitch);
            this.heldKeys.delete(closestPitch);
          }
        }

        if (this.physicallyReleasedKeys.has(pitch)) {
          this.physicallyReleasedKeys.delete(pitch);
        }
        
        // Kill previous if re-triggered and not stolen
        if (this.activePitchesMemory[pitch] && this.activePitchesMemory[pitch].length > 0) {
          const notesToKill = this.activePitchesMemory[pitch];
          for (const note of notesToKill) {
            if (note.timeoutId) clearTimeout(note.timeoutId);
            else this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel, note.isInternalSynthOnly);
            if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
          }
        }

        const isSynthOnly = this.params.omnichordMode && !forcePlay;
        if (stolenNote) {
          const channel = stolenNote.mpeChannel ?? (this.params.mpeEnabled ? this.allocateMpeChannel() : undefined);
          const basePitch = stolenNote.mpeBasePitch ?? stolenNote.pitch;
          const currentPitch = stolenNote.mpeCurrentPitch ?? stolenNote.pitch;
          
          let nextBasePitch = basePitch;
          if (this.params.mpeEnabled && channel && !this.params.omnichordMode && basePitch !== pitch) {
             // Real MPE Glide
             this.emitMpePitchBend(channel, basePitch, currentPitch, pitch, 0);
          } else {
             // Same note re-trigger OR non-MPE: kill old envelope, start new
             this.emitNoteOff(basePitch, 0, 0, channel, isSynthOnly);
             this.emitNoteOn(pitch, velocity, 0, channel, isSynthOnly);
             nextBasePitch = pitch;
          }
          
          this.activePitchesMemory[pitch] = [{
            ...stolenNote,
            pitch: pitch,
            mpeBasePitch: nextBasePitch,
            mpeCurrentPitch: pitch,
            mpeChannel: channel,
            isInternalSynthOnly: isSynthOnly
          }];
        } else {
          const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
          this.emitNoteOn(pitch, velocity, 0, channel, isSynthOnly);
          this.activePitchesMemory[pitch] = [{ pitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: pitch, mpeCurrentPitch: pitch, isInternalSynthOnly: isSynthOnly }];
        }
        
        if (this.onPerformanceKey) this.onPerformanceKey(pitch, true, false);
      }
      this.updateStrumplatePitches();
      return;
    }

    if (!isOn || velocity === 0) {
      if (isControlKey) {
        // Handle momentary release
        const noteOffset = pitch - controlLowBound;
        let changed = false;
        
        if (this.params.momentaryBase) {
          if (noteOffset === 0 && this.manualBaseType === 0) { this.manualBaseType = -1; changed = true; }
          if (noteOffset === 2 && this.manualBaseType === 1) { this.manualBaseType = -1; changed = true; }
          if (noteOffset === 4 && this.manualBaseType === 2) { this.manualBaseType = -1; changed = true; }
          if (noteOffset === 5 && this.manualBaseType === 3) { this.manualBaseType = -1; changed = true; }
        }
        if (this.params.momentaryExt) {
          if (noteOffset === 1 && this.ext_m7) { this.ext_m7 = false; changed = true; }
          if (noteOffset === 3 && this.ext_M7) { this.ext_M7 = false; changed = true; }
          if (noteOffset === 6 && this.ext_6) { this.ext_6 = false; changed = true; }
          if (noteOffset === 8 && this.ext_9) { this.ext_9 = false; changed = true; }
        }
        
        if (changed) {
          this.notifyState();
          this.retriggerHeldKeys(true);
        }
        return;
      }
      
      // Note Off
      if (!isControlKey) {
        this.heldKeys.delete(pitch);
        this.heldCustomVoicings.delete(pitch);
        const allReleased = this.heldKeys.size === 0;
        if (this.onPerformanceKey) {
          this.onPerformanceKey(pitch, false, allReleased);
        }
        if (allReleased) {
          this.lastStrumIndex = -1;
        }
      }
      if (this.sustainPedalActive && !isControlKey) {
        this.physicallyReleasedKeys.add(pitch);
      } else {
        if (this.activePitchesMemory[pitch]) {
          const notesToKill = this.activePitchesMemory[pitch];
          for (const note of notesToKill) {
            if (note.timeoutId) {
              clearTimeout(note.timeoutId);
            } else {
              this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel, note.isInternalSynthOnly);
            }
            if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
          }
          delete this.activePitchesMemory[pitch];
        }
        if (!isControlKey) {
          this.checkAndClearLatches();
        }
      }
      this.updateStrumplatePitches();
      return;
    }

    // Check if it's a control octave key
    if (isControlKey) {
      const noteOffset = pitch - controlLowBound;
      let changed = false;
      
      if (noteOffset === 0) { this.manualBaseType = (this.manualBaseType === 0 && !this.params.momentaryBase) ? -1 : 0; changed = true; }
      if (noteOffset === 2) { this.manualBaseType = (this.manualBaseType === 1 && !this.params.momentaryBase) ? -1 : 1; changed = true; }
      if (noteOffset === 4) { this.manualBaseType = (this.manualBaseType === 2 && !this.params.momentaryBase) ? -1 : 2; changed = true; }
      if (noteOffset === 5) { this.manualBaseType = (this.manualBaseType === 3 && !this.params.momentaryBase) ? -1 : 3; changed = true; }
      
      if (noteOffset === 1) { this.toggleExtension('m7'); changed = true; }
      if (noteOffset === 3) { this.toggleExtension('M7'); changed = true; }
      if (noteOffset === 6) { this.toggleExtension('6'); changed = true; }
      if (noteOffset === 8) { this.toggleExtension('9'); changed = true; }
      if (noteOffset === 11) { this.clearExtensions(); changed = true; }
      
      if (changed) {
        this.lastUpdateReason = 'chord';
        this.notifyState();
        this.retriggerHeldKeys(true);
      }
      return;
    }

    // Note On (Performance Key)
    this.heldKeys.set(pitch, velocity);
    if (customVoicing) this.heldCustomVoicings.set(pitch, customVoicing);
    else this.heldCustomVoicings.delete(pitch);
    // Clean up if it was a re-triggered key while sustained
    if (this.physicallyReleasedKeys.has(pitch)) {
      this.physicallyReleasedKeys.delete(pitch);
    }
    
    let performGlideFromPrevious = false;
    let stolenMemory: any[] = [];

    // Stop previous notes if re-triggering the same physical key and NOT updating
    if (!isUpdate) {
      if (this.onPerformanceKey) {
        this.onPerformanceKey(pitch, true, false);
      }
      
      if (this.params.mpeEnabled) {
        for (const pkStr in this.activePitchesMemory) {
          const pk = parseInt(pkStr);
          if (pk !== pitch && this.activePitchesMemory[pk] && this.activePitchesMemory[pk].length > 0) {
            stolenMemory = this.activePitchesMemory[pk];
            this.activePitchesMemory[pk] = []; // Clear old key so it doesn't kill notes when released
            performGlideFromPrevious = true;
            break; // Steal from the first active chord found
          }
        }
      }

      if (this.activePitchesMemory[pitch]) {
        const notesToKill = this.activePitchesMemory[pitch];
        for (const note of notesToKill) {
          if (note.timeoutId) {
            clearTimeout(note.timeoutId);
          } else {
            this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel, note.isInternalSynthOnly);
          }
          if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }
      }
      this.activePitchesMemory[pitch] = performGlideFromPrevious ? stolenMemory : [];
    }

    // Regular Performance Key
    const mappedRoot = this.getMappedRootPitch(pitch);
    const intervals = this.getIntervalsForState(pitch);
    
    let finalPitches: number[];
    let isSingleNote = false;
    
    const extraInversions = this.params.inversionRepeat > 0 ? (this.consecutiveChordCount * this.params.inversionRepeat) : 0;

    if (customVoicing && customVoicing.length > 0) {
      finalPitches = [...customVoicing];
    } else if (intervals.length === 0) {
      finalPitches = [pitch];
      isSingleNote = true;
    } else {
      finalPitches = this.calculateFoldedPitches(mappedRoot, intervals);

      // Apply Voicing Mutation (only to generated chords)
      finalPitches.sort((a, b) => a - b);
      const voicing = this.pickVoicing();
      if (voicing === 'Drop 2' && finalPitches.length >= 2) {
        finalPitches[finalPitches.length - 2] -= 12;
      } else if (voicing === 'Drop 3' && finalPitches.length >= 3) {
        finalPitches[finalPitches.length - 3] -= 12;
      } else if (voicing === 'Drop 4' && finalPitches.length >= 4) {
        finalPitches[finalPitches.length - 4] -= 12;
      } else if (voicing === 'Open' && finalPitches.length >= 3) {
        if (finalPitches.length >= 2) finalPitches[finalPitches.length - 2] -= 12;
        if (finalPitches.length >= 4) finalPitches[finalPitches.length - 4] -= 12;
      }
      // Clamp to minimum MIDI pitch and filter out drops below startRange (but allow inversions to exceed endRange)
      const startRange = this.params.chordRegisterStart;
      finalPitches = finalPitches.filter(p => p >= startRange && p <= 127).map(p => Math.max(0, p));
    }
    
    // Apply Inversion Repeat Extra Inversions uniformly (to both custom voicings and generated chords)
    if (extraInversions > 0 && !isSingleNote) {
       for (let i = 0; i < extraInversions; i++) {
         if (finalPitches.length > 0) {
           finalPitches.sort((a,b) => a-b);
           finalPitches[0] += 12;
         }
       }
    }

    let currentDir = this.params.strumDirection;
    if (this.params.strumAlternate) {
       // Randomly pick UP (0), DOWN (1), or RANDOM (2)
       currentDir = Math.floor(Math.random() * 3);
    }

    if (currentDir === 1) { // Down
      finalPitches.sort((a, b) => b - a);
    } else if (currentDir === 0) { // Up
      finalPitches.sort((a, b) => a - b);
    } else if (currentDir === 2) { // Random
      // First sort up to ensure determinism before shuffle
      finalPitches.sort((a, b) => a - b);
      // Random shuffle
      for (let i = finalPitches.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalPitches[i], finalPitches[j]] = [finalPitches[j], finalPitches[i]];
      }
    }

    let bassPitch = mappedRoot;
    const bassSetting = this.params.autoBassRegister;
    if (bassSetting === 1) {
      while (bassPitch >= 24) bassPitch -= 12;
    } else if (bassSetting === 2) {
      while (bassPitch >= 36) bassPitch -= 12;
      while (bassPitch < 24) bassPitch += 12;
    } else if (bassSetting === 3) {
      while (bassPitch >= 48) bassPitch -= 12;
      while (bassPitch < 36) bassPitch += 12;
    }

    const suppressImmediatePlay = this.params.omnichordMode && !forcePlay;

    if (isUpdate || performGlideFromPrevious) {
      const oldMemory = this.activePitchesMemory[pitch] || [];
      const newMemory: Array<any> = [];

      // Handle Bass Diff
      if (bassSetting > 0 && bassPitch >= 0) {
        const existingBass = oldMemory.find(n => n.isBass);
        
        if (this.params.mpeEnabled && existingBass && !skipBass) {
          if (existingBass.pitch !== bassPitch || existingBass.mpeCurrentPitch !== bassPitch) {
            const basePitch = existingBass.mpeBasePitch ?? existingBass.pitch;
            const currentPitch = existingBass.mpeCurrentPitch ?? existingBass.pitch;
            const channel = existingBass.mpeChannel ?? this.allocateMpeChannel();
            
            this.emitMpePitchBend(channel, basePitch, currentPitch, bassPitch, 0);
            newMemory.push({ ...existingBass, pitch: bassPitch, mpeBasePitch: basePitch, mpeCurrentPitch: bassPitch, mpeChannel: channel });
          } else {
            newMemory.push(existingBass);
          }
        } else {
          if (existingBass && existingBass.pitch === bassPitch) {
            newMemory.push(existingBass);
          } else {
            if (existingBass && !skipBass) {
              if (existingBass.timeoutId) clearTimeout(existingBass.timeoutId);
              else this.emitNoteOff(existingBass.mpeBasePitch ?? existingBass.pitch, 0, 0, existingBass.mpeChannel, existingBass.isInternalSynthOnly);
              if (existingBass.mpeChannel) this.freeMpeChannel(existingBass.mpeChannel);
            }
            if (!skipBass || !existingBass) {
              const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
              this.emitNoteOn(bassPitch, velocity, 0, channel, suppressImmediatePlay);
              newMemory.push({ pitch: bassPitch, delayUsed: 0, isBass: true, mpeChannel: channel, mpeBasePitch: bassPitch, mpeCurrentPitch: bassPitch, isInternalSynthOnly: suppressImmediatePlay });
            } else {
              if (existingBass) newMemory.push(existingBass);
            }
          }
        }
      } else if (bassSetting === 0) {
        const existingBass = oldMemory.find(n => n.isBass);
        if (existingBass) {
          if (existingBass.timeoutId) clearTimeout(existingBass.timeoutId);
          else this.emitNoteOff(existingBass.mpeBasePitch ?? existingBass.pitch, 0, 0, existingBass.mpeChannel, existingBass.isInternalSynthOnly);
          if (existingBass.mpeChannel) this.freeMpeChannel(existingBass.mpeChannel);
        }
      }

      // Handle Chord Diff
      const oldChordNotes = oldMemory.filter(n => !n.isBass);
      const oldChordPitches = oldChordNotes.map(n => n.pitch);

      if (this.params.mpeEnabled) {
        // Smart Diffing: Match exact pitches first, then glide leftovers
        let unmatchedOld = [...oldChordNotes];
        let unmatchedNew = [...finalPitches];
        
        // 1. Exact Matches (no glide needed)
        for (let i = unmatchedOld.length - 1; i >= 0; i--) {
          const oldNote = unmatchedOld[i];
          const exactMatchIdx = unmatchedNew.indexOf(oldNote.pitch);
          if (exactMatchIdx !== -1) {
            newMemory.push(oldNote);
            unmatchedOld.splice(i, 1);
            unmatchedNew.splice(exactMatchIdx, 1);
          }
        }
        
        // 2. Glide remaining notes (if any)
        unmatchedOld.sort((a, b) => a.pitch - b.pitch);
        unmatchedNew.sort((a, b) => a - b);
        
        for (let i = 0; i < Math.max(unmatchedOld.length, unmatchedNew.length); i++) {
          const oldNote = unmatchedOld[i];
          const newPitch = unmatchedNew[i];
          
          if (oldNote && newPitch !== undefined) {
            // Glide
            if (oldNote.pitch !== newPitch || oldNote.mpeCurrentPitch !== newPitch) {
              const basePitch = oldNote.mpeBasePitch ?? oldNote.pitch;
              const currentPitch = oldNote.mpeCurrentPitch ?? oldNote.pitch;
              const channel = oldNote.mpeChannel ?? this.allocateMpeChannel();
              this.emitMpePitchBend(channel, basePitch, currentPitch, newPitch, 0);
              newMemory.push({ ...oldNote, pitch: newPitch, mpeBasePitch: basePitch, mpeCurrentPitch: newPitch, mpeChannel: channel });
            } else {
              newMemory.push(oldNote);
            }
          } else if (oldNote && newPitch === undefined) {
            if (oldNote.timeoutId) clearTimeout(oldNote.timeoutId);
            else this.emitNoteOff(oldNote.mpeBasePitch ?? oldNote.pitch, 0, 0, oldNote.mpeChannel, oldNote.isInternalSynthOnly);
            if (oldNote.mpeChannel) this.freeMpeChannel(oldNote.mpeChannel);
          } else if (!oldNote && newPitch !== undefined) {
            const channel = this.allocateMpeChannel();
            this.emitNoteOn(newPitch, velocity, 0, channel, suppressImmediatePlay);
            newMemory.push({ pitch: newPitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: newPitch, mpeCurrentPitch: newPitch, isInternalSynthOnly: suppressImmediatePlay });
          }
        }
      } else {
        for (const oldNote of oldChordNotes) {
          if (!finalPitches.includes(oldNote.pitch)) {
            if (oldNote.timeoutId) clearTimeout(oldNote.timeoutId);
            else this.emitNoteOff(oldNote.mpeBasePitch ?? oldNote.pitch, 0, 0, oldNote.mpeChannel, oldNote.isInternalSynthOnly);
            if (oldNote.mpeChannel) this.freeMpeChannel(oldNote.mpeChannel);
          } else {
            newMemory.push(oldNote);
          }
        }

        for (const newPitch of finalPitches) {
          if (!oldChordPitches.includes(newPitch)) {
            this.emitNoteOn(newPitch, velocity, 0, undefined, suppressImmediatePlay);
            newMemory.push({ pitch: newPitch, delayUsed: 0, isBass: false, isInternalSynthOnly: suppressImmediatePlay });
          }
        }
      }


      this.activePitchesMemory[pitch] = newMemory;
      this.updateStrumplatePitches();
      return;
    }

    // New Note Sequence (Not an update)
    const previousMemory = this.activePitchesMemory[pitch] || [];
    this.activePitchesMemory[pitch] = previousMemory; // keep existing bass note if there
    const playedPitches: Record<number, boolean> = {};
    
    // Mark already playing bass notes as played so we don't retrigger or conflict
    if (skipBass) {
      for (const note of previousMemory) {
        if (note.isBass) playedPitches[note.pitch] = true;
      }
    }

    if (!skipBass && bassSetting > 0 && bassPitch >= 0 && bassPitch <= 127) {
      const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
      this.emitNoteOn(bassPitch, velocity, 0, channel, suppressImmediatePlay);
      this.activePitchesMemory[pitch].push({ pitch: bassPitch, delayUsed: 0, isBass: true, mpeChannel: channel, mpeBasePitch: bassPitch, mpeCurrentPitch: bassPitch, isInternalSynthOnly: suppressImmediatePlay });
      playedPitches[bassPitch] = true;
    }

    for (let j = 0; j < finalPitches.length; j++) {
      const targetPitch = finalPitches[j];
      const delayForThisNote = (this.params.strumEngine === 1) ? (j * this.params.strumSpeedMs) : 0;

      if (targetPitch >= 0 && targetPitch <= 127 && !playedPitches[targetPitch]) {
        playedPitches[targetPitch] = true;
        const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
        const noteObj: any = { pitch: targetPitch, delayUsed: delayForThisNote, isBass: false, mpeChannel: channel, mpeBasePitch: targetPitch, mpeCurrentPitch: targetPitch, isInternalSynthOnly: suppressImmediatePlay };
        
        if (delayForThisNote > 0) {
            noteObj.timeoutId = setTimeout(() => {
              this.emitNoteOn(targetPitch, velocity, 0, noteObj.mpeChannel, suppressImmediatePlay);
              noteObj.timeoutId = undefined;
            }, delayForThisNote);
          } else {
            this.emitNoteOn(targetPitch, velocity, 0, noteObj.mpeChannel, suppressImmediatePlay);
          }
        this.activePitchesMemory[pitch].push(noteObj);
      }
    }

    this.updateStrumplatePitches();
  }

  private emitMpeExpression(channel: number, value: number, delayMs: number = 0) {
    if (this.onOutputNote) this.onOutputNote({ pitch: 0, velocity: 0, isOn: false, isExpression: true, expressionValue: value, mpeChannel: channel, delayMs });
  }

  private calculateFinalVelocity(baseVelocity: number, pitch: number, reason: 'inversion' | 'chord' | 'none'): number {
    let vel = baseVelocity;
    
    // Humanize
    if (this.params.velHumanize > 0) {
      vel -= Math.random() * this.params.velHumanize;
    }
    
    // High Register Pad
    if (this.params.velHighRegisterPad > 0) {
      // Map pitch 36 to 96 (C1 to C6) to 0.0 - 1.0 factor
      const factor = Math.max(0, Math.min(1, (pitch - 36) / 60));
      vel -= factor * this.params.velHighRegisterPad;
    }

    // Glide/Chord offsets
    if (reason === 'inversion' && this.params.velGlideInversion > 0) {
      vel -= this.params.velGlideInversion;
    } else if (reason === 'chord' && this.params.velGlideChord > 0) {
      vel -= this.params.velGlideChord;
    }

    return Math.max(1, Math.min(127, Math.round(vel)));
  }

  private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel?: number, isInternalSynthOnly: boolean = false, isMidiOnly: boolean = false) {
    const finalVelocity = this.calculateFinalVelocity(velocity, pitch, this.lastUpdateReason);
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity: finalVelocity, isOn: true, delayMs, mpeChannel: channel, isInternalSynthOnly });
    
    // Reset expression and pitch bend on note on, in case channel was reused/glided
    if (this.params.mpeEnabled) {
      this.emitMpeExpression(channel, 127, delayMs);
      if (this.onOutputNote) {
        this.onOutputNote({ pitch, velocity: 0, isOn: false, delayMs, mpeChannel: channel, isPitchBend: true, pitchBendValue: 0 });
      }
    }
  }

  private emitNoteOff(pitch: number, velocity: number = 0, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false, isMidiOnly: boolean = false) {
    if (isInternalSynthOnly && !this.params.omnichordSynthMonitor) {
      return; // Fully silent
    }
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel, isInternalSynthOnly, isMidiOnly });
  }

  public emitControlChange(ccNumber: number, ccValue: number, channel: number = 1, delayMs: number = 0) {
    if (this.onOutputNote) {
      this.onOutputNote({
        pitch: 0,
        velocity: 0,
        isOn: false,
        delayMs,
        mpeChannel: channel,
        isCC: true,
        ccNumber,
        ccValue
      });
    }
  }

}
