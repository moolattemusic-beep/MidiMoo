import { OrchidParams, NoteEvent } from '../types';
import { CHORD_PATTERNS, ChordPattern, PatternEvent, patternDurationMs, patternTicks } from './ChordPatterns';

// One voice in the Free MOO pool: a held MPE channel that is bent around
// rather than retriggered.
interface MooVoice {
  channel: number;
  basePitch: number; // pitch of the note-on, the reference for pitch bend
  currentPitch: number; // where it is sounding right now (updated while gliding)
  targetPitch: number;
  sourceKey: number; // performance key that currently owns it
  released: boolean; // key lifted but still ringing under the sustain pedal
  isInternalSynthOnly: boolean;
  glideTimers: any[];
}

interface PatternRun {
  pitches: number[];
  bassPitch: number | null;
  bassChannel?: number;
  // A bass the run has been handed but not yet sounded; it waits for the next
  // note so it arrives with the rhythm.
  nextBass?: number | null;
  bassOwed?: boolean;
  pending: { pitches: number[]; bassPitch: number | null } | null;
  velocity: number;
  cycleStartMs: number;
  nextIdx: number;
  channels: Map<number, number>;
  sounding: Map<number, { pitch: number; channel?: number; offTimer: any }>;
  // Notes that ring on rather than being re-struck: keyed by the event that
  // started them, so a pattern can hold several at once.
  holds: Map<string, { pitch: number; channel?: number }>;
  holdsStale: boolean;
  timers: Set<any>;
}

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
  private activePitchesMemory: Record<number, Array<{ pitch: number, delayUsed: number, isBass: boolean, timeoutId?: any, mpeChannel?: number, mpeBasePitch?: number, mpeCurrentPitch?: number, mpeTargetPitch?: number, isInternalSynthOnly?: boolean, heldByPedal?: boolean }>> = {};
  private mpeChannelsAllocated: boolean[] = new Array(16).fill(false);

  /**
   * Member channels are 2-15. Chords take from the bottom and the arpeggiator
   * from the top, so a busy arpeggio — whose notes can ring for seconds — can
   * only exhaust its own end of the pool. Sharing one end meant a long arpeggio
   * could take every channel and leave held chords colliding on the fallback,
   * where two notes fight over one channel's expression.
   */
  private allocateMpeChannel(fromTop: boolean = false): number {
    if (fromTop) {
      for (let ch = 15; ch >= 2; ch--) {
        if (!this.mpeChannelsAllocated[ch - 1]) {
          this.mpeChannelsAllocated[ch - 1] = true;
          return ch;
        }
      }
      return 15; // fallback
    }
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

  // --- MPE glide carry ---------------------------------------------------
  // A released note can't be bent, so glide between non-overlapping chords is
  // only possible if the previous chord is kept sounding. Keys parked here have
  // been released but are still playing, waiting to be glided from.
  // Value = grace-window timeout, or undefined in Hold mode (no auto-release).
  private glideCarryKeys: Map<number, any> = new Map();

  // 0=Legato (overlap only, nothing is carried), 1=Grace window, 2=Hold.
  private get glideCarryMode(): number {
    if (!this.params.mpeEnabled) return 0;
    const mode = this.params.mpeGlideMode || 0;
    // Free MOO runs its own voice pool and only applies in Free mode. Outside
    // it nothing may be carried, or the chord modes would stop releasing notes.
    if (mode === 3) return 0;
    return mode;
  }

  // --- Pattern transport --------------------------------------------------
  // A pattern is the one thing in the engine that is not edge-triggered: a key
  // press starts a clock that keeps placing notes until the key is let go.
  //
  // Events are scheduled a short way ahead rather than for the whole cycle. A
  // message handed to the MIDI port with a future timestamp cannot be recalled,
  // so a long lookahead would leave notes committed to a chord that has already
  // changed — the same trap that made glides land on the wrong note. Sixty
  // milliseconds is enough to keep the timing steady and short enough that a
  // chord change is heard almost at once.
  private patternRuns: Map<number, PatternRun> = new Map();
  private patternClock: any = null;
  // Where the cycle currently in progress began. Shared by every run so a chord
  // change joins the rhythm rather than restarting it.
  private patternPhaseStart: number | null = null;
  private pedalLiftTimer: any = null;
  private patternGraceTimer: any = null;
  private patternCache: { key: string; pattern: ChordPattern } | null = null;

  /** The pattern in force: an edited one if there is one, else the library. */
  public getActivePattern(): ChordPattern {
    const custom = this.params.patternCustom;
    const key = custom ?? `#${this.params.patternIndex}`;
    if (this.patternCache && this.patternCache.key === key) return this.patternCache.pattern;

    let pattern: ChordPattern;
    if (custom) {
      try {
        pattern = JSON.parse(custom) as ChordPattern;
      } catch {
        pattern = CHORD_PATTERNS[0];
      }
    } else {
      pattern = CHORD_PATTERNS[Math.max(0, Math.min(CHORD_PATTERNS.length - 1, this.params.patternIndex ?? 0))];
    }
    // Scheduling walks the events in time order, so they are sorted once here
    // rather than on every tick.
    pattern = { ...pattern, events: [...pattern.events].sort((a, b) => a.start - b.start) };
    this.patternCache = { key, pattern };
    return pattern;
  }

  /** Where the cycle has got to, 0 to 1, or null when nothing is running. */
  /** How long one cycle lasts, tempo and half/double time together. */
  private patternCycleMs(): number {
    const rate = Math.max(0.25, Math.min(4, this.params.patternRate ?? 1));
    return patternDurationMs(this.getActivePattern(), this.params.patternBpm ?? 100) / rate;
  }

  public getPatternPhase(): number | null {
    if (this.patternRuns.size === 0 || this.patternPhaseStart === null) return null;
    const cycleMs = this.patternCycleMs();
    if (cycleMs <= 0) return null;
    // The anchor is where the cycle first began and does not move, so the
    // modulo alone says where in the cycle we are. Advancing it as each cycle
    // was scheduled put it a cycle into the future — scheduling always runs
    // ahead of the sound — and the phase then read as zero.
    const cycleMs2 = cycleMs;
    const elapsed = (((Date.now() - this.patternPhaseStart) % cycleMs2) + cycleMs2) % cycleMs2;
    return Math.max(0, Math.min(1, elapsed / cycleMs2));
  }

  private startPatternRun(key: number, pitches: number[], bassPitch: number | null, velocity: number) {
    if (pitches.length === 0) {
      this.stopPatternRun(key);
      return;
    }

    // A chord arriving over one already playing takes the running cycle over
    // rather than starting a second one beside it. Two runs would both keep
    // firing, which is the two chords sounding through each other; handing the
    // cycle across means the notes simply become the new chord's at the next
    // note the pattern reaches.
    const existingKey = this.patternRuns.size > 0 ? [...this.patternRuns.keys()][0] : null;
    if (existingKey !== null) {
      const run = this.patternRuns.get(existingKey)!;
      if (existingKey !== key) {
        this.patternRuns.delete(existingKey);
        this.patternRuns.set(key, run);
      }
      run.velocity = velocity;
      this.handPatternVoicing(run, { pitches: [...pitches].sort((a, b) => a - b), bassPitch });
      return;
    }
    // The clock starts under the finger rather than on a grid of its own, so a
    // chord placed off the beat keeps the pattern where it was played. Changing
    // chord while one is already running is a different matter: the new chord
    // joins the cycle already in progress instead of restarting it, so the
    // rhythm carries across the change unbroken.
    const now = Date.now();
    // Either something else is still playing, or the grace window is still open.
    const continuing = this.patternPhaseStart !== null;
    if (this.patternGraceTimer) {
      clearTimeout(this.patternGraceTimer);
      this.patternGraceTimer = null;
    }
    const pattern = this.getActivePattern();
    const cycleMs = this.patternCycleMs();
    let cycleStartMs = now;
    let nextIdx = 0;
    if (continuing) {
      // Wind the shared phase forward to the cycle this moment falls in, then
      // skip whatever has already gone by so the new chord does not replay it.
      cycleStartMs = this.patternPhaseStart!;
      while (cycleStartMs + cycleMs <= now) cycleStartMs += cycleMs;
      const elapsedTicks = ((now - cycleStartMs) / cycleMs) * patternTicks(pattern);
      while (nextIdx < pattern.events.length && pattern.events[nextIdx].start < elapsedTicks) nextIdx++;
    } else {
      this.patternPhaseStart = now;
    }

    const run: PatternRun = {
      pitches: [...pitches].sort((a, b) => a - b),
      bassPitch,
      pending: null,
      velocity,
      cycleStartMs,
      nextIdx,
      channels: new Map(),
      sounding: new Map(),
      holds: new Map(),
      holdsStale: false,
      timers: new Set(),
    };
    this.patternRuns.set(key, run);
    if (bassPitch !== null) {
      run.bassChannel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
      run.bassPitch = null;
      run.nextBass = bassPitch;
      run.bassOwed = true;
    }
    this.ensurePatternClock();
    this.runPatternTick();
  }

  /**
   * Hand the run a new voicing. Either it takes effect where the pattern
   * already is, so a chord change does not interrupt the rhythm, or it waits
   * for the cycle to come round.
   */
  private updatePatternRun(key: number, pitches: number[], bassPitch: number | null) {
    const run = this.patternRuns.get(key);
    if (!run) return;
    this.handPatternVoicing(run, { pitches: [...pitches].sort((a, b) => a - b), bassPitch });
  }

  private handPatternVoicing(run: PatternRun, next: { pitches: number[]; bassPitch: number | null }) {
    if ((this.params.patternChordChange ?? 0) === 1) run.pending = next;
    else this.applyPatternVoicing(run, next);
  }

  private applyPatternVoicing(run: PatternRun, next: { pitches: number[]; bassPitch: number | null }) {
    run.pitches = next.pitches;
    // The bass is not struck here. It is marked as owed and sounded by the next
    // note the pattern reaches, so it lands with the rhythm rather than the
    // moment a key happened to go down.
    if (next.bassPitch !== run.bassPitch) {
      run.nextBass = next.bassPitch;
      run.bassOwed = true;
    }
    // Held notes are not cut off here. They keep ringing under the change and
    // are exchanged for the new chord's where the pattern next reaches them,
    // which is what carries a sustained part across a chord change.
    run.holdsStale = true;
  }

  private stopPatternRun(key: number) {
    const run = this.patternRuns.get(key);
    if (!run) return;
    // Anything already scheduled is cancelled, and anything already sounding is
    // released here and now. A pattern that can leave a note on is worse than
    // one that stops raggedly.
    for (const t of run.timers) clearTimeout(t);
    run.timers.clear();
    for (const [, note] of run.sounding) {
      if (note.offTimer) clearTimeout(note.offTimer);
      this.emitNoteOff(note.pitch, 0, 0, note.channel);
    }
    run.sounding.clear();
    for (const [, held] of run.holds) this.emitNoteOff(held.pitch, 0, 0, held.channel);
    run.holds.clear();
    for (const [, channel] of run.channels) this.freeMpeChannel(channel);
    run.channels.clear();
    if (run.bassPitch !== null) {
      this.emitNoteOff(run.bassPitch, 0, 0, run.bassChannel);
      if (run.bassChannel) this.freeMpeChannel(run.bassChannel);
    }
    this.patternRuns.delete(key);
    if (this.patternRuns.size === 0) {
      this.stopPatternClock();
      // The cycle outlives the chord for a moment. A chord let go and replaced
      // inside the grace window rejoins the cycle where it had got to, so
      // chords need not be overlapped to keep the pattern running; leave it
      // longer than that and the next chord starts a cycle of its own.
      if (this.params.patternGraceEnabled !== false) {
        if (this.patternGraceTimer) clearTimeout(this.patternGraceTimer);
        this.patternGraceTimer = setTimeout(() => {
          this.patternGraceTimer = null;
          if (this.patternRuns.size === 0) this.patternPhaseStart = null;
        }, Math.max(0, this.params.patternGraceMs ?? 350));
      } else {
        this.patternPhaseStart = null;
      }
    }
  }

  /**
   * Lift the pedal for a moment even though it is being held, so the chord
   * before does not sustain into the one after. The pedal is forwarded to the
   * synth, so the synth has to be told as well as our own memory of what is
   * sounding — dropping only our notes would leave the synth holding them.
   */
  private momentaryPedalLift(ms: number = 20) {
    if (!this.sustainPedalActive || this.pedalLiftTimer) return;
    this.emitCC(64, 0);
    this.flushSustainedNotes();
    this.pedalLiftTimer = setTimeout(() => {
      this.pedalLiftTimer = null;
      // Only put it back down if it is still being held.
      if (this.sustainPedalActive) this.emitCC(64, 127);
    }, ms);
  }

  private emitCC(cc: number, value: number, channel: number = 1) {
    if (this.onOutputNote) {
      this.onOutputNote({ pitch: 0, velocity: 0, isOn: false, isCC: true, ccNumber: cc, ccValue: value, mpeChannel: channel });
    }
  }

  public stopAllPatternRuns() {
    for (const key of [...this.patternRuns.keys()]) this.stopPatternRun(key);
  }

  private ensurePatternClock() {
    if (this.patternClock !== null) return;
    this.patternClock = setInterval(() => this.runPatternTick(), 25);
  }

  private stopPatternClock() {
    if (this.patternClock !== null) clearInterval(this.patternClock);
    this.patternClock = null;
  }

  /**
   * A voice keeps the same channel for as long as the chord is held. That caps
   * a pattern at one channel per voice however dense it is, lets a retrigger
   * reuse its own channel, and keeps each voice's expression on one channel
   * instead of scattering it across the pool.
   */
  private patternChannelForVoice(run: PatternRun, voice: number): number | undefined {
    if (!this.params.mpeEnabled) return undefined;
    let channel = run.channels.get(voice);
    if (channel === undefined) {
      channel = this.allocateMpeChannel();
      run.channels.set(voice, channel);
    }
    return channel;
  }

  private runPatternTick() {
    if (!this.params.patternEnabled) {
      this.stopAllPatternRuns();
      return;
    }
    const pattern = this.getActivePattern();
    const events = pattern.events;
    if (events.length === 0) return;

    const cycleMs = this.patternCycleMs();
    const msPerTick = cycleMs / Math.max(1, patternTicks(pattern));
    const now = Date.now();
    const horizon = now + 60;

    for (const [, run] of this.patternRuns) {
      // Guard against a runaway: at a very fast tempo a cycle could otherwise
      // be scheduled many times over inside one tick.
      let guard = 0;
      while (guard++ < 256) {
        if (run.nextIdx >= events.length) {
          run.nextIdx = 0;
          run.cycleStartMs += cycleMs;
          if (run.pending) {
            this.applyPatternVoicing(run, run.pending);
            run.pending = null;
          }
          continue;
        }
        const event = events[run.nextIdx];
        const at = run.cycleStartMs + event.start * msPerTick;
        if (at > horizon) break;
        const isCycleStart = run.nextIdx === 0;
        if (isCycleStart && this.params.patternChordLayer) {
          // The chord itself under the figure. It is placed at the top of the
          // cycle rather than when a key happens to go down, so it lands with
          // the pattern, and it lasts the cycle so the two layers move together.
          this.schedulePatternChord(run, Math.max(0, at - now), cycleMs);
        }
        // The written length is what the editor shows; how long it actually
        // rings is one control for the whole pattern, applied here.
        const release = Math.max(5, Math.min(400, this.params.patternRelease ?? 100)) / 100;
        this.schedulePatternEvent(run, event, Math.max(0, at - now), event.length * msPerTick * release, isCycleStart);
        run.nextIdx++;
      }
    }
  }

  /**
   * The whole chord, struck once at the top of a cycle. Its notes take channels
   * of their own rather than the pattern's, so the figure's expression and the
   * chord's stay apart.
   */
  private schedulePatternChord(run: PatternRun, delayMs: number, lengthMs: number) {
    const pitches = [...run.pitches];
    const velocity = this.params.patternFixedVelocity
      ? Math.max(1, Math.min(127, this.params.patternVelocity ?? 100))
      : run.velocity;

    const timer = setTimeout(() => {
      run.timers.delete(timer);
      pitches.forEach((pitch, i) => {
        if (pitch < 0 || pitch > 127) return;
        // Filed under a voice key of its own, well clear of the pattern's, so
        // the two layers never take each other's channel.
        const key = 1000 + i;
        const channel = this.patternChannelForVoice(run, key);
        const previous = run.sounding.get(key);
        if (previous) {
          if (previous.offTimer) clearTimeout(previous.offTimer);
          this.emitNoteOff(previous.pitch, 0, 0, previous.channel);
        }
        this.emitNoteOn(pitch, Math.max(1, Math.round(velocity * 0.85)), 0, channel);
        const offTimer = setTimeout(() => {
          const held = run.sounding.get(key);
          if (held && held.pitch === pitch) {
            this.emitNoteOff(pitch, 0, 0, channel);
            run.sounding.delete(key);
          }
        }, Math.max(20, lengthMs * 0.95));
        run.sounding.set(key, { pitch, channel, offTimer });
      });
    }, delayMs);
    run.timers.add(timer);
  }

  private schedulePatternEvent(run: PatternRun, event: PatternEvent, delayMs: number, lengthMs: number, isCycleStart: boolean) {
    const fire = () => {
      run.timers.delete(timer);

      // Whatever bass is owed is settled here, on a note rather than on a key
      // press: the old one goes as the new one arrives, so the two roots never
      // sound across each other.
      if (run.bassOwed) {
        run.bassOwed = false;
        if (run.bassPitch !== null) this.emitNoteOff(run.bassPitch, 0, 0, run.bassChannel);
        run.bassPitch = run.nextBass ?? null;
        if (run.bassPitch !== null) {
          if (run.bassChannel === undefined && this.params.mpeEnabled) run.bassChannel = this.allocateMpeChannel();
          this.emitNoteOn(run.bassPitch, run.velocity, 0, run.bassChannel);
        }
      }

      if (run.pitches.length === 0) return;
      // A pattern may name more voices than the chord has. Wrapping keeps the
      // rhythm whole where dropping the event would punch holes in it.
      // Inversion rotates which chord tone this voice plays and is read here
      // rather than stored, so moving the slider is heard on the next note.
      // Rotating past the top wraps round an octave up, which is what makes it
      // an inversion rather than a jump back to the bottom.
      const len = run.pitches.length;
      // The chord's tones repeated upward: with a spread of one this is just the
      // chord, and a pattern naming more voices than it has wraps round in
      // place as it always did. Widen the spread and those extra voices climb
      // instead — voice 4 on a triad becomes the root an octave up. The notes
      // are the same ones the voicing chose; there are simply more rungs to
      // play them on, which is how three pitches become a harp part.
      const spread = Math.max(1, Math.min(3, Math.round(this.params.patternSpread ?? 1)));
      const rungs = len * spread;
      const rung = ((event.voice - 1) % rungs + rungs) % rungs;
      const ladderOctaves = Math.floor(rung / len);
      // The inversion rotates which tone a rung plays, and carries its own
      // octave when it passes the top.
      const rotated = (rung % len) + Math.round(this.params.patternInversion ?? 0);
      const index = ((rotated % len) + len) % len;
      const wrapOctaves = ladderOctaves + Math.floor(rotated / len);
      const base = run.pitches[index];
      if (base === undefined) return;
      // An octave written into the event, so a pattern can drop its bass or
      // throw a voice up top without the voicing having to know.
      const pitch = base + 12 * ((event.octave ?? 0) + wrapOctaves) + (event.semitones ?? 0);
      if (pitch < 0 || pitch > 127) return;
      // The written velocity is an accent on what was played, not a replacement
      // for it, so the pattern shapes the dynamics without flattening them. On a
      // fixed level the keys stop having a say and the accents ride on the
      // level set instead, which is what makes the pattern play the same however
      // the controller is weighted.
      const source = this.params.patternFixedVelocity
        ? Math.max(1, Math.min(127, this.params.patternVelocity ?? 100))
        : run.velocity;
      const velocity = Math.max(1, Math.min(127, Math.round((source * event.velocity) / 127)));
      const channel = this.patternChannelForVoice(run, event.voice);

      if (event.hold) {
        const holdKey = `${event.voice}:${event.start}`;
        const current = run.holds.get(holdKey);
        // Already ringing at the right pitch: leave it alone. Re-striking is
        // precisely what a held note must not do.
        if (current && current.pitch === pitch && !run.holdsStale) return;
        if (current) this.emitNoteOff(current.pitch, 0, 0, current.channel);
        this.emitNoteOn(pitch, velocity, 0, channel, false, false, false, isCycleStart);
        run.holds.set(holdKey, { pitch, channel });
        // Once every hold has caught up with the new voicing they are current
        // again, and the next cycle leaves them be.
        if (run.holdsStale && [...run.holds.values()].every(h => run.pitches.includes(h.pitch - 12 * (event.octave ?? 0) - (event.semitones ?? 0)))) {
          run.holdsStale = false;
        }
        return;
      }

      // The same voice sounding again before it was released takes its own
      // channel back, which means releasing the old note first.
      const previous = run.sounding.get(event.voice);
      if (previous) {
        if (previous.offTimer) clearTimeout(previous.offTimer);
        this.emitNoteOff(previous.pitch, 0, 0, previous.channel);
        run.sounding.delete(event.voice);
      }

      this.emitNoteOn(pitch, velocity, 0, channel, false, false, false, isCycleStart);
      const offTimer = setTimeout(() => {
        const held = run.sounding.get(event.voice);
        if (held && held.pitch === pitch) {
          this.emitNoteOff(pitch, 0, 0, channel);
          run.sounding.delete(event.voice);
        }
      }, Math.max(20, lengthMs));
      run.sounding.set(event.voice, { pitch, channel, offTimer });
    };

    const timer = setTimeout(fire, delayMs);
    run.timers.add(timer);
  }

  /**
   * Release everything the pedal is holding. Called when the pedal lifts, and
   * when a new chord arrives over a held pedal so the two do not sound through
   * each other.
   */
  private flushSustainedNotes() {
    for (const pitch of this.physicallyReleasedKeys) {
      this.heldKeys.delete(pitch);
      // The pedal held the pattern on past the key; this is where that run ends.
      this.stopPatternRun(pitch);
      const notesToKill = this.activePitchesMemory[pitch];
      if (notesToKill) {
        for (const note of notesToKill) {
          if (note.timeoutId) clearTimeout(note.timeoutId);
          else this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel, note.isInternalSynthOnly);
          if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        }
        delete this.activePitchesMemory[pitch];
      }
    }
    this.physicallyReleasedKeys.clear();

    // Notes the pedal was keeping under a still-held key: the stack the
    // register slider built. Lifting the pedal is what ends those, leaving the
    // voicing that is current still sounding.
    for (const key in this.activePitchesMemory) {
      const notes = this.activePitchesMemory[key];
      if (!notes) continue;
      for (let i = notes.length - 1; i >= 0; i--) {
        const note = notes[i];
        if (!note.heldByPedal) continue;
        if (note.timeoutId) clearTimeout(note.timeoutId);
        else this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel, note.isInternalSynthOnly);
        if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
        notes.splice(i, 1);
      }
    }
  }

  private silenceMemory(pitch: number) {
    this.stopPatternRun(pitch);
    const notes = this.activePitchesMemory[pitch];
    if (!notes) return;
    for (const note of notes) {
      if (note.timeoutId) clearTimeout(note.timeoutId);
      else this.emitNoteOff(note.mpeBasePitch ?? note.pitch, 0, 0, note.mpeChannel, note.isInternalSynthOnly);
      if (note.mpeChannel) this.freeMpeChannel(note.mpeChannel);
    }
    delete this.activePitchesMemory[pitch];
  }

  // Keep a released chord alive so the next chord can glide out of it.
  private carryGlideNotes(pitch: number) {
    const existing = this.glideCarryKeys.get(pitch);
    if (existing) clearTimeout(existing);

    if (this.glideCarryMode === 1) {
      const graceMs = this.params.mpeGraceMs ?? 250;
      const timeoutId = setTimeout(() => {
        this.glideCarryKeys.delete(pitch);
        this.silenceMemory(pitch);
        this.updateStrumplatePitches();
      }, graceMs);
      this.glideCarryKeys.set(pitch, timeoutId);
    } else {
      // Hold mode: sustain until something glides from it, or PANIC.
      this.glideCarryKeys.set(pitch, undefined);
    }
  }

  // Take ownership of a carried key so its pending release doesn't fire.
  private claimGlideCarry(pitch: number) {
    const timeoutId = this.glideCarryKeys.get(pitch);
    if (timeoutId) clearTimeout(timeoutId);
    this.glideCarryKeys.delete(pitch);
  }

  // Release everything parked for glide. Used on panic and when the glide
  // mode changes, so Hold mode can never strand notes.
  public flushGlideCarry() {
    for (const [pitch, timeoutId] of this.glideCarryKeys.entries()) {
      if (timeoutId) clearTimeout(timeoutId);
      this.silenceMemory(pitch);
    }
    this.glideCarryKeys.clear();
    for (const voice of [...this.mooVoices]) this.mooReleaseVoice(voice);
    this.clearMooGesture();
    this.syncMooMirror();
    this.updateStrumplatePitches();
  }

  // --- Free MOO mode -----------------------------------------------------
  // A fixed pool of MPE voices the player re-voices by ear. Notes played close
  // together count as one chord gesture; a lone note edits a single voice.

  private mooVoices: MooVoice[] = [];
  private mooGesture: number[] = [];
  private mooGestureTimer: any = null;
  private mooMirrorKeys: Set<number> = new Set();
  // Voices spawned while a gesture was still arriving — provisional until the
  // finished chord shows how many voices it actually needs.
  private mooGestureBorn: Set<MooVoice> = new Set();

  public isFreeMooActive(): boolean {
    return this.params.mpeEnabled
      && (this.params.mpeGlideMode || 0) === 3
      && this.params.keyboardMapping === 3;
  }

  private mooMaxVoices(): number {
    return Math.max(1, Math.min(14, this.params.mpeMaxVoices ?? 5));
  }

  // The voice pool owns its notes, but the strum plate and panic read
  // activePitchesMemory, so keep a mirror of the pool in there.
  private syncMooMirror() {
    for (const key of this.mooMirrorKeys) delete this.activePitchesMemory[key];
    this.mooMirrorKeys.clear();

    for (const voice of this.mooVoices) {
      const entry = {
        pitch: Math.round(voice.currentPitch),
        delayUsed: 0,
        isBass: false,
        mpeChannel: voice.channel,
        mpeBasePitch: voice.basePitch,
        mpeCurrentPitch: voice.currentPitch,
        isInternalSynthOnly: voice.isInternalSynthOnly,
      };
      if (this.mooMirrorKeys.has(voice.sourceKey)) {
        this.activePitchesMemory[voice.sourceKey].push(entry);
      } else {
        this.activePitchesMemory[voice.sourceKey] = [entry];
        this.mooMirrorKeys.add(voice.sourceKey);
      }
    }
  }

  private emitMooBend(voice: MooVoice, pitch: number) {
    if (this.onOutputNote) {
      this.onOutputNote({
        pitch: voice.basePitch,
        velocity: 0,
        isOn: false,
        mpeChannel: voice.channel,
        isPitchBend: true,
        pitchBendValue: pitch - voice.basePitch,
      });
    }
  }

  // Glide steps run on cancellable timers rather than being pre-scheduled to
  // the MIDI port, so a gesture can re-target a voice that is still moving.
  private mooGlide(voice: MooVoice, targetPitch: number) {
    for (const t of voice.glideTimers) clearTimeout(t);
    voice.glideTimers = [];
    voice.targetPitch = targetPitch;

    const from = voice.currentPitch;
    if (from === targetPitch) return;

    const glideMs = this.params.mpeGlideTimeMs || 0;
    if (glideMs <= 0) {
      voice.currentPitch = targetPitch;
      this.emitMooBend(voice, targetPitch);
      return;
    }

    const steps = 20;
    const stepTime = glideMs / steps;
    for (let i = 1; i <= steps; i++) {
      const timer = setTimeout(() => {
        const pitch = from + (targetPitch - from) * (i / steps);
        voice.currentPitch = pitch;
        this.emitMooBend(voice, pitch);
        if (i === steps) voice.glideTimers = [];
      }, i * stepTime);
      voice.glideTimers.push(timer);
    }
  }

  private mooNearestVoice(pitch: number, pool: MooVoice[] = this.mooVoices): MooVoice | undefined {
    let best: MooVoice | undefined;
    let bestDiff = Infinity;
    for (const voice of pool) {
      const diff = Math.abs(voice.currentPitch - pitch);
      if (diff < bestDiff) { bestDiff = diff; best = voice; }
    }
    return best;
  }

  // Lifting a key marks its voice expendable, so that is what gets taken first.
  private mooPickVictim(pitch: number): MooVoice | undefined {
    const released = this.mooVoices.filter(v => v.released);
    return this.mooNearestVoice(pitch, released.length > 0 ? released : this.mooVoices);
  }

  // Every live voice must own a distinct MIDI note number. Receivers that key
  // notes by pitch — the internal synth does, for both note-on and bend — drop
  // one of two voices sharing a number. Where the natural number is taken,
  // borrow a free one and let pitch bend cover the difference.
  private mooFreeNoteNumber(preferred: number, exclude?: MooVoice): number {
    const taken = new Set(
      this.mooVoices.filter(v => v !== exclude).map(v => v.basePitch)
    );
    if (!taken.has(preferred)) return preferred;
    for (let offset = 1; offset <= 24; offset++) {
      if (preferred - offset >= 0 && !taken.has(preferred - offset)) return preferred - offset;
      if (preferred + offset <= 127 && !taken.has(preferred + offset)) return preferred + offset;
    }
    return preferred;
  }

  private mooStartVoice(notePitch: number, soundAt: number, velocity: number, isSynthOnly: boolean): MooVoice {
    const basePitch = this.mooFreeNoteNumber(notePitch);
    const voice: MooVoice = {
      channel: this.allocateMpeChannel(),
      basePitch,
      currentPitch: soundAt,
      targetPitch: notePitch,
      sourceKey: notePitch,
      released: false,
      isInternalSynthOnly: isSynthOnly,
      glideTimers: [],
    };

    this.emitNoteOn(basePitch, velocity, 0, voice.channel, isSynthOnly);
    this.mooVoices.push(voice);
    // emitNoteOn resets bend to zero, so place the voice afterwards.
    if (soundAt !== basePitch) this.emitMooBend(voice, soundAt);
    if (soundAt !== notePitch) this.mooGlide(voice, notePitch);
    return voice;
  }

  private mooAddVoice(pitch: number, velocity: number, isSynthOnly: boolean): MooVoice {
    // Swoop in from a voice that was already sounding before this gesture —
    // that is what makes a chord grow by splitting a note. A chord played from
    // silence has nothing to swoop from, so it attacks cleanly.
    const settled = this.mooVoices.filter(v => !this.mooGestureBorn.has(v));
    const neighbour = this.mooNearestVoice(pitch, settled);
    return this.mooStartVoice(pitch, neighbour ? neighbour.currentPitch : pitch, velocity, isSynthOnly);
  }

  private mooRetriggerVoice(voice: MooVoice, pitch: number, velocity: number) {
    for (const t of voice.glideTimers) clearTimeout(t);
    voice.glideTimers = [];
    this.emitNoteOff(voice.basePitch, 0, 0, voice.channel, voice.isInternalSynthOnly);
    voice.basePitch = this.mooFreeNoteNumber(pitch, voice);
    voice.currentPitch = pitch;
    voice.targetPitch = pitch;
    this.emitNoteOn(voice.basePitch, velocity, 0, voice.channel, voice.isInternalSynthOnly);
    if (pitch !== voice.basePitch) this.emitMooBend(voice, pitch);
  }

  private mooSplitVoice(source: MooVoice, targetPitch: number, velocity: number) {
    if (this.mooVoices.length >= this.mooMaxVoices()) return;
    // Starts in unison with the voice it splits off, then glides to its target.
    this.mooStartVoice(targetPitch, source.currentPitch, velocity, source.isInternalSynthOnly);
  }

  private mooReleaseVoice(voice: MooVoice) {
    for (const t of voice.glideTimers) clearTimeout(t);
    voice.glideTimers = [];
    this.emitNoteOff(voice.basePitch, 0, 0, voice.channel, voice.isInternalSynthOnly);
    this.freeMpeChannel(voice.channel);
    const idx = this.mooVoices.indexOf(voice);
    if (idx !== -1) this.mooVoices.splice(idx, 1);
  }

  private clearMooGesture() {
    if (this.mooGestureTimer) clearTimeout(this.mooGestureTimer);
    this.mooGestureTimer = null;
    this.mooGesture = [];
    this.mooGestureBorn.clear();
  }

  // Monotone (order-preserving) assignment of sounding voices to target pitches,
  // minimising total movement. Moves are restricted to exactly the split/merge
  // budget the note counts imply: with equal counts this is a strict 1:1
  // pairing, so voices can never double up on a pitch and abandon another.
  private mooAlign(voicePitches: number[], targets: number[]): Array<[number, number]> {
    const n = voicePitches.length;
    const m = targets.length;
    const allowSplit = m > n; // one voice covers several targets
    const allowMerge = n > m; // several voices land on one target

    const cost: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
    cost[0][0] = 0;

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        let best = cost[i - 1][j - 1];
        if (allowSplit && cost[i][j - 1] < best) best = cost[i][j - 1];
        if (allowMerge && cost[i - 1][j] < best) best = cost[i - 1][j];
        if (best === Infinity) continue;
        cost[i][j] = Math.abs(voicePitches[i - 1] - targets[j - 1]) + best;
      }
    }

    const pairs: Array<[number, number]> = [];
    let i = n;
    let j = m;
    while (i > 0 && j > 0) {
      pairs.push([i - 1, j - 1]);
      const diag = cost[i - 1][j - 1];
      const left = allowSplit ? cost[i][j - 1] : Infinity;
      const up = allowMerge ? cost[i - 1][j] : Infinity;
      if (diag <= left && diag <= up) { i--; j--; }
      else if (left <= up) { j--; }
      else { i--; }
    }
    return pairs.reverse();
  }

  // A gesture of two or more notes is a new chord: every voice is re-assigned
  // to it, splitting or merging as the note count demands.
  private mooReplaceChord(gesture: number[]) {
    if (this.mooVoices.length === 0) return;

    let targets = Array.from(new Set(gesture)).sort((a, b) => a - b);
    const max = this.mooMaxVoices();
    if (targets.length > max) targets = targets.slice(0, max);

    // Voices born mid-gesture were a guess made before the chord was complete.
    // If the finished chord needs fewer, drop those again — merging them would
    // leave a doubled note and burn a voice. Genuine shrinking still merges.
    let surplus = this.mooVoices.length - targets.length;
    if (surplus > 0 && this.mooGestureBorn.size > 0) {
      const born = this.mooVoices.filter(v => this.mooGestureBorn.has(v));
      for (let k = born.length - 1; k >= 0 && surplus > 0; k--) {
        this.mooReleaseVoice(born[k]);
        this.mooGestureBorn.delete(born[k]);
        surplus--;
      }
    }

    const voices = [...this.mooVoices].sort((a, b) => a.currentPitch - b.currentPitch);
    const pairs = this.mooAlign(voices.map(v => v.currentPitch), targets);

    const targetsForVoice = new Map<number, number[]>();
    for (const [vi, ti] of pairs) {
      const list = targetsForVoice.get(vi);
      if (list) { if (!list.includes(ti)) list.push(ti); }
      else targetsForVoice.set(vi, [ti]);
    }

    for (const [vi, tis] of targetsForVoice.entries()) {
      const voice = voices[vi];
      const keepPitch = targets[tis[0]];
      voice.released = false;
      voice.sourceKey = keepPitch;
      this.mooGlide(voice, keepPitch);

      for (let k = 1; k < tis.length; k++) {
        const splitPitch = targets[tis[k]];
        this.mooSplitVoice(voice, splitPitch, this.heldKeys.get(splitPitch) ?? 100);
      }
    }

    // A gesture resolves after its window closes, by which time a staccato
    // chord may already be back up. Voices left owned by a key that is no
    // longer down would never be sent a note-off, so settle them here.
    for (const voice of [...this.mooVoices]) {
      const keyStillDown = this.heldKeys.has(voice.sourceKey)
        && !this.physicallyReleasedKeys.has(voice.sourceKey);
      if (keyStillDown) continue;
      if (this.sustainPedalActive) voice.released = true;
      else this.mooReleaseVoice(voice);
    }

    this.syncMooMirror();
    this.updateStrumplatePitches();
  }

  private freeMooNoteOn(pitch: number, velocity: number) {
    this.heldKeys.set(pitch, velocity);
    if (this.physicallyReleasedKeys.has(pitch)) this.physicallyReleasedKeys.delete(pitch);

    // Group note-ons that land together, then re-voice once the window closes.
    this.mooGesture.push(pitch);
    if (this.mooGestureTimer) clearTimeout(this.mooGestureTimer);
    this.mooGestureTimer = setTimeout(() => {
      const gesture = this.mooGesture;
      this.mooGesture = [];
      this.mooGestureTimer = null;
      if (gesture.length >= 2) this.mooReplaceChord(gesture);
      this.mooGestureBorn.clear();
    }, this.params.mpeChordWindowMs ?? 60);

    // Act now so playing never waits on the window; the gesture pass refines it.
    const isSynthOnly = this.params.omnichordMode;
    const owned = this.mooVoices.find(v => v.sourceKey === pitch);

    if (owned) {
      owned.released = false;
      this.mooRetriggerVoice(owned, pitch, velocity);
    } else if (this.mooVoices.length < this.mooMaxVoices()) {
      this.mooGestureBorn.add(this.mooAddVoice(pitch, velocity, isSynthOnly));
    } else {
      const victim = this.mooPickVictim(pitch);
      if (victim) {
        victim.released = false;
        victim.sourceKey = pitch;
        this.mooGlide(victim, pitch);
      }
    }

    this.syncMooMirror();
    if (this.onPerformanceKey) this.onPerformanceKey(pitch, true, false);
  }

  private freeMooNoteOff(pitch: number) {
    const owned = this.mooVoices.filter(v => v.sourceKey === pitch);

    if (this.sustainPedalActive) {
      this.physicallyReleasedKeys.add(pitch);
      // Still ringing, but now first in line to be stolen.
      for (const voice of owned) voice.released = true;
    } else {
      this.heldKeys.delete(pitch);
      for (const voice of owned) this.mooReleaseVoice(voice);
    }

    this.syncMooMirror();
    if (this.onPerformanceKey) this.onPerformanceKey(pitch, false, this.heldKeys.size === 0);
  }

  private releaseMooSustainedVoices() {
    for (const voice of [...this.mooVoices]) {
      if (!voice.released) continue;
      this.heldKeys.delete(voice.sourceKey);
      this.mooReleaseVoice(voice);
    }
    this.syncMooMirror();
  }

  // Glide steps in flight, per MIDI channel. Messages handed to the MIDI port
  // with a future timestamp cannot be recalled, so a glide that outlives its
  // note would keep bending whatever plays on that channel next. Running the
  // steps on timers instead means a channel can be cut short.
  private channelGlideTimers: Map<number, any[]> = new Map();

  private cancelChannelGlide(channel?: number) {
    if (channel === undefined) return;
    const timers = this.channelGlideTimers.get(channel);
    if (!timers) return;
    for (const t of timers) clearTimeout(t);
    this.channelGlideTimers.delete(channel);
  }

  private cancelAllChannelGlides() {
    for (const timers of this.channelGlideTimers.values()) {
      for (const t of timers) clearTimeout(t);
    }
    this.channelGlideTimers.clear();
  }

  // `note` is updated as the glide progresses, so a re-target part way through
  // (dragging a slider, say) continues from where the note actually is rather
  // than from where the last glide was aiming.
  private emitMpePitchBend(channel: number, basePitch: number, currentPitch: number, targetPitch: number, delayOffset: number, note?: any) {
    const steps = 20; // 20 steps over the glide time
    const glideMs = this.params.mpeGlideTimeMs || 0;
    const stepTime = glideMs / steps;

    // Whatever this channel was doing is superseded.
    this.cancelChannelGlide(channel);
    if (note) note.mpeTargetPitch = targetPitch;

    const sendStep = (pitch: number) => {
      if (note) note.mpeCurrentPitch = pitch;
      if (this.onOutputNote) {
        this.onOutputNote({
          pitch: basePitch,
          velocity: 0,
          isOn: false,
          delayMs: 0,
          mpeChannel: channel,
          isPitchBend: true,
          pitchBendValue: pitch - basePitch
        });
      }
    };

    if (glideMs <= 0 || currentPitch === targetPitch) {
      sendStep(targetPitch);
      return;
    }

    const timers: any[] = [];
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const pitchAtStep = currentPitch + (targetPitch - currentPitch) * progress;
      const timer = setTimeout(() => {
        sendStep(pitchAtStep);
        if (i === steps) this.channelGlideTimers.delete(channel);
      }, delayOffset + (i * stepTime));
      timers.push(timer);
    }
    this.channelGlideTimers.set(channel, timers);
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
  // Where the arpeggio glides from, kept separate from the chord voices so the
  // two can glide independently of each other.
  private lastArpeggioPitch: number | null = null;
  private arpChannel: number | null = null;

  /**
   * One channel the whole arpeggio shares. Held rather than allocated per note,
   * so turning per-note channels off gives the arpeggio a single voice whose
   * expression is its own but never spreads across the pool.
   */
  private arpSharedChannel(): number {
    if (this.arpChannel === null) this.arpChannel = this.allocateMpeChannel(true);
    return this.arpChannel;
  }


  constructor(initialParams: OrchidParams) {
    this.params = { ...initialParams };
  }


  public panic() {
    if (this.pedalLiftTimer) { clearTimeout(this.pedalLiftTimer); this.pedalLiftTimer = null; }
    if (this.patternGraceTimer) { clearTimeout(this.patternGraceTimer); this.patternGraceTimer = null; }
    this.patternPhaseStart = null;
    this.stopAllPatternRuns();
    this.cancelAllChannelGlides();
    // The arpeggio's own channel and glide origin are part of what panic is
    // for: a stuck arpeggio should come back on a clean channel.
    if (this.arpChannel !== null) {
      this.freeMpeChannel(this.arpChannel);
      this.arpChannel = null;
    }
    this.lastArpeggioPitch = null;
    for (const timeoutId of this.glideCarryKeys.values()) {
      if (timeoutId) clearTimeout(timeoutId);
    }
    this.glideCarryKeys.clear();
    for (const voice of this.mooVoices) {
      for (const t of voice.glideTimers) clearTimeout(t);
      this.freeMpeChannel(voice.channel);
    }
    this.mooVoices = [];
    this.mooMirrorKeys.clear();
    this.clearMooGesture();
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
    this.heldChordIntervals.clear();
    this.heldMemoryKeys.clear();
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
  // Intervals of a pasted chord symbol, kept so retriggers (a register move,
  // an inversion change) rebuild the same chord rather than the default one.
  public heldChordIntervals: Map<number, number[]> = new Map();
  // Which held keys came from a memory pad. In Free mode the pads still play
  // chords, so a retrigger has to go back down the chord path — routing it
  // through the free-mode branch instead would strand the chord's notes.
  public heldMemoryKeys: Set<number> = new Set();

  public retriggerHeldKeys(skipBass: boolean = false, forcePlay: boolean = false) {
    const keysToRetrigger = Array.from(this.heldKeys.entries());
    
    for (const [pitch, velocity] of keysToRetrigger) {
      if (pitch <= 127) {
         const cv = this.heldCustomVoicings.get(pitch);
         const ci = this.heldChordIntervals.get(pitch);
         this.handleMidi(pitch, velocity, true, skipBass, true, forcePlay, this.heldMemoryKeys.has(pitch), cv, ci);
      }
    }
  }

  public updateRegister(newStart: number) {
    this.params.chordRegisterStart = newStart;
    this.lastUpdateReason = 'chord';
    // Silent: the slider is being set up for what comes next rather than
    // played, so nothing sounding is disturbed and nothing new is announced.
    if (this.params.registerSilent) return;
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

    return this.addColour(intervals, effectiveBaseType, isDominant);
  }

  /**
   * Dry to rich. Each quality takes its tensions in the order it wants them, so
   * turning one knob walks a plain triad out to the sort of chord these
   * instruments are usually voiced with.
   *
   * The orders avoid the notes that fight the chord: a natural 11th sits a
   * semitone above a major third and clouds it, so major and dominant take a
   * raised 11th and take it last, while a minor chord has no such quarrel and
   * takes its 11th early.
   */
  private addColour(intervals: number[], baseType: number, _isDominant: boolean): number[] {
    const colour = Math.max(0, Math.min(4, Math.round(this.params.chordColor ?? 0)));
    if (colour === 0 || intervals.length === 0) return intervals;

    // What the chord actually is, read off its own notes rather than off which
    // button was pressed. A major third with a flat seventh is a dominant
    // however it arrived — played by hand, or handed over by the key as the
    // fifth degree — and it must not then be given a major seventh on top of
    // its flat one, which is what made colour sound wrong on those chords.
    const pcs = new Set(intervals.map(i => ((i % 12) + 12) % 12));
    const majorThird = pcs.has(4);
    const minorThird = pcs.has(3);
    const flatSeventh = pcs.has(10);
    const isDominantChord = majorThird && flatSeventh;

    let order: number[];
    if (isDominantChord) {
      // A dominant is already carrying its seventh, so colour goes straight to
      // the alterations, and takes them in the order they are usually voiced.
      order = [13, 15, 20, 18];                            // b9, #9, b13, #11
    } else if (minorThird && baseType !== 3) {
      order = [10, 14, 17, 21];                            // minor: b7, 9, 11, 13
    } else if (baseType === 2) {
      order = [10, 14, 21, 18];                            // sus, which leans dominant
    } else if (baseType === 3) {
      order = [10, 14, 20, 17];                            // diminished
    } else {
      order = [11, 14, 21, 18];                            // major: maj7, 9, 13, #11
    }

    const out = [...intervals];
    for (const tone of order.slice(0, colour)) {
      const pc = tone % 12;
      // Never twice, and never a tone the chord already states in another
      // octave — a written extension keeps its own place.
      if (out.some(i => ((i % 12) + 12) % 12 === pc)) continue;
      // Never a seventh against the other seventh, or a ninth against the other
      // ninth: those are not colour, they are two chords at once.
      if ((pc === 11 && flatSeventh) || (pc === 10 && pcs.has(11))) continue;
      if ((pc === 1 || pc === 3) && pcs.has(2)) continue;
      out.push(tone);
    }
    return out.sort((a, b) => a - b);
  }

  private getIntervalPriority(interval: number): number {
    const pc = interval % 12;
    if (pc === 0) return 100; // Root
    if (pc === 3 || pc === 4) return 90; // 3rd
    if (pc === 10 || pc === 11) return 80; // 7th
    if (pc === 7) return 50; // 5th
    return 40 - interval; // Higher intervals have slightly lower base priority
  }

  /**
   * Ranking used when MAX VOICES caps a memory chord. The 5th goes before any
   * extension: an altered chord is named for its alterations, so thinning
   * B7(b13,#9) down to a plain B7 would throw away the point of it. Played
   * chords keep using getIntervalPriority, which is unchanged.
   */
  private getVoiceCapPriority(interval: number): number {
    const pc = interval % 12;
    if (pc === 0) return 100; // root
    if (pc === 3 || pc === 4) return 90; // 3rd
    if (pc === 10 || pc === 11) return 80; // 7th
    if (pc === 7) return 20; // 5th: the first thing a player drops
    return 60 - interval / 100; // colour tones, lower ones first
  }

  /**
   * Move a hand-played voicing to the register without rebuilding it. Notes
   * that fall below the start are lifted an octave at a time, so sliding up
   * walks the voicing through its own inversions — the same idea as folding a
   * chord, but working on the notes that were actually played rather than on
   * intervals. Nothing is dropped and nothing above the start is touched, so
   * the voicing keeps its content and its upward spread; running it through the
   * chord folding instead would thin it by density and close up the spacing,
   * which is the whole of what free mode was for.
   */
  private reRegisterVoicing(voicing: number[]): number[] {
    const start = this.params.chordRegisterStart;
    return voicing.map(note => {
      let n = note;
      while (n < start) n += 12;
      return n > 127 ? note : n;
    });
  }

  private calculateFoldedPitches(rootPitch: number, intervals: number[], keepAllTones = false, noteLimit?: number): number[] {
    const startRange = this.params.chordRegisterStart;
    const endRange = startRange + this.params.voicingRange;
    const registerStartPC = startRange % 12;

    // A plain count rather than a band. Extensions and colour no longer raise it
    // behind the player's back: if the chord wants more notes than this, the
    // slider is where to say so.
    const maxNotes = Math.max(1, Math.min(8, Math.round(this.params.chordMaxNotes ?? 6)));
    
    // A chord pasted as a symbol is played as spelled: thinning it by density
    // would drop the very alteration that gives it its name. MAX VOICES is a
    // deliberate limit though, so it still applies.
    let targetNotes = keepAllTones ? intervals.length : maxNotes;
    if (noteLimit !== undefined) targetNotes = noteLimit;
    if (targetNotes > intervals.length) {
      targetNotes = intervals.length;
    }
    if (targetNotes < 1) targetNotes = 1;

    const scoredIntervals = intervals.map(interval => {
      // Deterministic scoring: base priority + tiebreaker favoring smaller intervals
      const score = noteLimit !== undefined
        ? this.getVoiceCapPriority(interval)
        : this.getIntervalPriority(interval) + (100 - interval) / 100;
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

  // --- Arpeggio patterns -------------------------------------------------
  // The pad maps its Y axis onto a list of chord tones. A pattern reorders and
  // lengthens that list, so a swipe walks the figure instead of running
  // straight up the chord. getArpeggioPitches stays the plain ascending list.

  // Most patterns are a window of offsets slid along the notes by a fixed step:
  // [0,1,2] step 1 gives "1 2 3, 2 3 4, 3 4 5". The window wraps at the top so
  // the last groups still complete.
  private arpWindow(pitches: number[], offsets: number[], step: number): number[] {
    const n = pitches.length;
    const out: number[] = [];
    for (let start = 0; start < n; start += step) {
      for (const offset of offsets) {
        out.push(pitches[(start + offset) % n]);
      }
    }
    return out;
  }

  private arpRandomCache: { key: string; sequence: number[] } | null = null;

  public getArpeggioSequence(): number[] {
    const pitches = this.getArpeggioPitches();
    const n = pitches.length;
    if (n === 0) return [];

    switch (this.params.arpeggioPattern ?? 0) {
      case 1: // Down
        return [...pitches].reverse();

      case 2: // Two up, one down
        return this.arpWindow(pitches, [0, 1, 2], 1);

      case 3: // Alternate: 1 3 2 4, 3 5 4 6
        return this.arpWindow(pitches, [0, 2, 1, 3], 2);

      case 4: { // Thirds: every other note up, then the ones it skipped —
        // 1 3 5, 2 4 6. A sliding [0,2] window would just reproduce Alternate.
        const odd: number[] = [];
        const even: number[] = [];
        pitches.forEach((p, i) => (i % 2 === 0 ? odd : even).push(p));
        return [...odd, ...even];
      }

      case 5: { // Pendulum: up then back down, without repeating the turns
        return n < 3 ? [...pitches] : [...pitches, ...pitches.slice(1, -1).reverse()];
      }

      case 6: { // Outside-in: 1 n 2 n-1 3 ...
        const out: number[] = [];
        for (let lo = 0, hi = n - 1; lo <= hi; lo++, hi--) {
          out.push(pitches[lo]);
          if (lo !== hi) out.push(pitches[hi]);
        }
        return out;
      }

      case 7: { // Random, held steady until the chord itself changes
        const key = pitches.join(',');
        if (this.arpRandomCache && this.arpRandomCache.key === key) {
          return this.arpRandomCache.sequence;
        }
        const shuffled = [...pitches];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        this.arpRandomCache = { key, sequence: shuffled };
        return shuffled;
      }

      default: // Up
        return pitches;
    }
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
    // The three routings are independent. A note can be on its own channel, or
    // share the arpeggiator's one; it can glide in from the note before it; and
    // RAW takes it out of the modulation without affecting either of those.
    const perNoteChannels = this.params.arpeggioMpeChannels !== false;
    const channel = this.params.mpeEnabled
      ? (perNoteChannels ? this.allocateMpeChannel(true) : this.arpSharedChannel())
      : undefined;
    const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;
    const raw = this.params.arpeggioRaw === true;
    this.emitNoteOn(pitch, velocity, 0, channel, false, isMidiOnly, raw);

    // Glide is bend, so it needs a channel of its own to bend on: without MPE
    // the only channel available is the master, and bending that would drag any
    // chord being held underneath along with it.
    if (channel && this.params.arpeggioGlide && this.lastArpeggioPitch !== null && this.lastArpeggioPitch !== pitch) {
      this.emitMpePitchBend(channel, pitch, this.lastArpeggioPitch, pitch, 0);
    }
    this.lastArpeggioPitch = pitch;
    
    // Auto-release arpeggio notes after their set length (a staccato pulse by
    // default, longer when you want the notes to ring without a sustain pedal).
    const timeoutId = setTimeout(() => {
      if (this.activeArpeggioNotes.has(pitch)) {
        this.handleArpeggioNoteOff(pitch);
      }
    }, this.params.arpeggioNoteLengthMs ?? 100);
    
    this.activeArpeggioNotes.set(pitch, { pitch, mpeChannel: channel, timeoutId });
  }

  public handleArpeggioNoteOff(pitch: number, force: boolean = false) {
    const note = this.activeArpeggioNotes.get(pitch);
    if (note) {
      if (note.timeoutId) {
        clearTimeout(note.timeoutId);
      }
      this.emitNoteOff(pitch, 0, 0, note.mpeChannel);
      // The shared channel outlives its notes by design, so it is not handed
      // back — releasing it would let a chord take it mid-arpeggio.
      if (note.mpeChannel && note.mpeChannel !== this.arpChannel) this.freeMpeChannel(note.mpeChannel);
      this.activeArpeggioNotes.delete(pitch);
    }
  }

  private recalculateActiveChords() {
    for (const pkStr in this.activePitchesMemory) {
      const perfKey = parseInt(pkStr);
      const pasted = this.heldChordIntervals.get(perfKey);
      const mappedRoot = pasted ? perfKey : this.getMappedRootPitch(perfKey);
      const memoryArray = this.activePitchesMemory[perfKey];
      const limit = (this.heldMemoryKeys.has(perfKey) && this.params.mpeEnabled)
        ? Math.max(1, this.params.mpeMaxVoices ?? 5)
        : undefined;

      // A held free-mode voicing is re-registered rather than rebuilt, so
      // dragging the slider inverts the voicing that is actually sounding.
      const heldVoicing = this.heldCustomVoicings.get(perfKey);
      let newPitches: number[];
      if (heldVoicing && heldVoicing.length > 0) {
        newPitches = this.params.memoryFollowRegister !== false
          ? this.reRegisterVoicing(heldVoicing)
          : [...heldVoicing];
      } else {
        const newIntervals = pasted ?? this.getIntervalsForState(perfKey);
        newPitches = this.calculateFoldedPitches(mappedRoot, newIntervals, !!pasted, limit);
      }
      
      // A running pattern is handed the new voicing rather than having notes
      // diffed against it: the pattern decides when they sound, not this.
      if (this.patternRuns.has(perfKey)) {
        this.updatePatternRun(perfKey, newPitches, null);
        continue;
      }

      const oldPitches = memoryArray.filter(n => !n.isBass).map(n => n.pitch);

      // Turn on new ones
      for (const p of newPitches) {
        if (!oldPitches.includes(p) && p >= 0 && p <= 127) {
          this.emitNoteOn(p, 64);
          memoryArray.push({ pitch: p, delayUsed: 0, isBass: false, isInternalSynthOnly: false });
        }
      }

      // Turn off old ones that are no longer valid. Under the pedal they are
      // kept instead: sliding the register then stacks each voicing on the last
      // rather than replacing it, which is what makes an arpeggio out of the
      // slider. They are released when the pedal lifts, along with everything
      // else it is holding.
      const holdUnderPedal = this.sustainPedalActive;
      for (const p of oldPitches) {
        if (!newPitches.includes(p) && !holdUnderPedal) {
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

        // Free MOO owns its notes, so let the pool release them before the
        // generic flush below can touch the mirror entries.
        if (this.isFreeMooActive()) {
          this.releaseMooSustainedVoices();
          this.physicallyReleasedKeys.clear();
        }

        this.flushSustainedNotes();
        this.updateStrumplatePitches();
        this.checkAndClearLatches();
      }
    }
  }

  

  public handleMidi(pitch: number, velocity: number, isOn: boolean, skipBass: boolean = false, isUpdate: boolean = false, forcePlay: boolean = false, isMemoryTrigger: boolean = false, customVoicing?: number[], chordIntervals?: number[]) {
    const controlLowBound = 24 + (this.params.controlOctave * 12);
    const controlHighBound = controlLowBound + 11;
    let isControlKey = pitch >= controlLowBound && pitch <= controlHighBound;
    
    // In Free Mode, the whole keyboard is performance keys
    let isFreeMode = this.params.keyboardMapping === 3 && !isMemoryTrigger;
    if (isFreeMode) {
      isControlKey = false;
    }
    
    // A chord played over a held pedal releases what the pedal was holding, so
    // the two chords do not sound through each other. A slider retrigger is not
    // a new chord and deliberately does not do this.
    //
    // Glide is the exception, and it has to be: with glide on there is no
    // overlap to prevent, because the chord under the pedal is not left ringing
    // beneath the new one — it is bent into it. Releasing it here would leave
    // the glide nothing to move from, and the chord would be struck afresh
    // instead of gliding.
    // Any MPE mode, legato included: under the pedal the previous chord is still
    // sounding, which is exactly the condition legato glides from.
    const glideWillCarry = this.params.mpeEnabled;
    if (isOn && velocity > 0 && !isUpdate && !isControlKey && this.sustainPedalActive) {
      if (this.params.patternEnabled && this.params.patternPedalLift !== false) {
        // A pattern restates the chord constantly, so anything the pedal is
        // still holding from the chord before piles up underneath it. The lift
        // is momentary and isUpdate is excluded, so re-voicing the same chord
        // with the register slider does not interrupt the sustain.
        this.momentaryPedalLift(20);
      } else if (!glideWillCarry) {
        this.flushSustainedNotes();
      }
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
      if (this.isFreeMooActive()) {
        if (!isOn || velocity === 0) this.freeMooNoteOff(pitch);
        else this.freeMooNoteOn(pitch, velocity);
        this.updateStrumplatePitches();
        return;
      }

      if (!isOn || velocity === 0) {
        if (this.sustainPedalActive) {
          this.physicallyReleasedKeys.add(pitch);
        } else if (this.glideCarryMode > 0 && this.activePitchesMemory[pitch]?.length > 0) {
          // Keep it sounding so the next note can glide from it.
          this.heldKeys.delete(pitch);
          this.carryGlideNotes(pitch);
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
        // Re-pressing a carried key re-attacks it, so drop its pending release
        // before it can silence the new note.
        this.claimGlideCarry(pitch);

        let stolenNote: any = null;
        
        if (this.params.mpeEnabled) {
          // Glide from the nearest note that has been released but is still
          // sounding — either held by the sustain pedal or parked for glide.
          // Keys the player is still physically holding are left alone so Free
          // mode stays polyphonic.
          const candidates = new Set<number>();
          if (this.sustainPedalActive) {
            for (const pk of this.physicallyReleasedKeys) candidates.add(pk);
          }
          for (const pk of this.glideCarryKeys.keys()) candidates.add(pk);

          let closestPitch = -1;
          let minDiff = 9999;

          for (const pk of candidates) {
            if (pk !== pitch && this.activePitchesMemory[pk] && this.activePitchesMemory[pk].length > 0) {
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
            this.claimGlideCarry(closestPitch);
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
        this.heldChordIntervals.delete(pitch);
        this.heldMemoryKeys.delete(pitch);
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
      } else if (!isControlKey && this.glideCarryMode > 0 && this.activePitchesMemory[pitch]?.length > 0) {
        // Keep it sounding so the next chord can glide from it.
        this.carryGlideNotes(pitch);
        this.checkAndClearLatches();
      } else {
        // The pattern is what is sounding this key's notes, so letting go of
        // the key has to stop its clock as well as its notes.
        this.stopPatternRun(pitch);
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
    if (chordIntervals) this.heldChordIntervals.set(pitch, chordIntervals);
    else this.heldChordIntervals.delete(pitch);
    if (isMemoryTrigger) this.heldMemoryKeys.add(pitch);
    else this.heldMemoryKeys.delete(pitch);
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
        // A carried chord on this same key must glide too — two memory pads can
        // share a root pitch (e.g. Cmaj -> Cmin), and the search below skips
        // the current key. Only carried (already released) notes qualify:
        // re-pressing a key that is still held should re-attack, not glide.
        if (this.glideCarryKeys.has(pitch) && this.activePitchesMemory[pitch]?.length > 0) {
          stolenMemory = this.activePitchesMemory[pitch];
          this.claimGlideCarry(pitch);
          this.activePitchesMemory[pitch] = [];
          performGlideFromPrevious = true;
        } else {
          for (const pkStr in this.activePitchesMemory) {
            const pk = parseInt(pkStr);
            if (pk !== pitch && this.activePitchesMemory[pk] && this.activePitchesMemory[pk].length > 0) {
              stolenMemory = this.activePitchesMemory[pk];
              this.activePitchesMemory[pk] = []; // Clear old key so it doesn't kill notes when released
              this.claimGlideCarry(pk);
              performGlideFromPrevious = true;
              break; // Steal from the first active chord found
            }
          }
        }
      }

      // Drop any leftover carry for this key so a pending grace timer can't
      // silence the notes we are about to play. No-op if already claimed above.
      this.claimGlideCarry(pitch);

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
    const usingPastedChord = !!(chordIntervals && chordIntervals.length > 0);
    // With MPE glide on, the voice pool size decides how many notes a memory
    // chord is voiced with. Played chords keep using MAX NOTES.
    const memoryVoiceLimit = (isMemoryTrigger && this.params.mpeEnabled)
      ? Math.max(1, this.params.mpeMaxVoices ?? 5)
      : undefined;
    // A pasted symbol names its own root, so it is taken literally rather than
    // run through the key-mode or circle-of-fifths remapping.
    const mappedRoot = usingPastedChord ? pitch : this.getMappedRootPitch(pitch);
    // A pasted chord symbol supplies its own intervals; the modifier pads and
    // key-mode defaults do not reshape it.
    const intervals = usingPastedChord ? chordIntervals! : this.getIntervalsForState(pitch);
    
    let finalPitches: number[];
    let isSingleNote = false;
    
    const extraInversions = this.params.inversionRepeat > 0 ? (this.consecutiveChordCount * this.params.inversionRepeat) : 0;

    if (customVoicing && customVoicing.length > 0) {
      finalPitches = this.params.memoryFollowRegister !== false
        ? this.reRegisterVoicing(customVoicing)
        : [...customVoicing];
    } else if (intervals.length === 0) {
      finalPitches = [pitch];
      isSingleNote = true;
    } else {
      finalPitches = this.calculateFoldedPitches(mappedRoot, intervals, usingPastedChord, memoryVoiceLimit);

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

    // A pattern owns the timing, so an update hands it the new voicing rather
    // than diffing notes into the output: the notes it is already playing keep
    // their place in the cycle and simply become the new chord's. Diffing here
    // would sound the new voicing immediately alongside the one the pattern is
    // still working through.
    if (isUpdate && this.params.patternEnabled && this.patternRuns.has(pitch)) {
      const patternPitches = finalPitches.filter(p => p >= 0 && p <= 127);
      const runBass = (!skipBass && bassSetting > 0 && bassPitch >= 0 && bassPitch <= 127) ? bassPitch : null;
      this.updatePatternRun(pitch, patternPitches, runBass);
      this.updateStrumplatePitches();
      return;
    }

    if (isUpdate || performGlideFromPrevious) {
      const oldMemory = this.activePitchesMemory[pitch] || [];
      const newMemory: Array<any> = [];

      // Handle Bass Diff
      if (bassSetting > 0 && bassPitch >= 0) {
        const existingBass = oldMemory.find(n => n.isBass);
        
        if (this.params.mpeEnabled && existingBass && !skipBass) {
          const bassAimingAt = existingBass.mpeTargetPitch ?? existingBass.mpeCurrentPitch ?? existingBass.pitch;
          if (existingBass.pitch !== bassPitch || bassAimingAt !== bassPitch) {
            const basePitch = existingBass.mpeBasePitch ?? existingBass.pitch;
            const currentPitch = existingBass.mpeCurrentPitch ?? existingBass.pitch;
            const channel = existingBass.mpeChannel ?? this.allocateMpeChannel();

            // Update in place rather than copying: a strum-delayed note clears
            // its own timeoutId when it fires, and a copy would keep the stale
            // id, making the release path skip its note-off.
            existingBass.pitch = bassPitch;
            existingBass.mpeBasePitch = basePitch;
            existingBass.mpeChannel = channel;
            this.emitMpePitchBend(channel, basePitch, currentPitch, bassPitch, 0, existingBass);
            newMemory.push(existingBass);
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
            // Compare against where the note is heading, not where it is: while
            // a glide is running mpeCurrentPitch is still catching up, and
            // re-aiming at the same target would restart it on every update.
            const aimingAt = oldNote.mpeTargetPitch ?? oldNote.mpeCurrentPitch ?? oldNote.pitch;
            if (oldNote.pitch !== newPitch || aimingAt !== newPitch) {
              const basePitch = oldNote.mpeBasePitch ?? oldNote.pitch;
              const currentPitch = oldNote.mpeCurrentPitch ?? oldNote.pitch;
              const channel = oldNote.mpeChannel ?? this.allocateMpeChannel();
              // Update in place rather than copying: a strum-delayed note clears
              // its own timeoutId when it fires, and a copy would keep the stale
              // id, making the release path skip its note-off.
              oldNote.pitch = newPitch;
              oldNote.mpeBasePitch = basePitch;
              oldNote.mpeChannel = channel;
              this.emitMpePitchBend(channel, basePitch, currentPitch, newPitch, 0, oldNote);
              newMemory.push(oldNote);
            } else {
              newMemory.push(oldNote);
            }
          } else if (oldNote && newPitch === undefined) {
            // Under the pedal a voicing the slider has moved past is kept
            // rather than dropped, so sliding stacks each one on the last into
            // an arpeggio. It stays in memory and goes when the pedal lifts.
            if (this.sustainPedalActive) {
              oldNote.heldByPedal = true;
              newMemory.push(oldNote);
            } else {
              if (oldNote.timeoutId) clearTimeout(oldNote.timeoutId);
              else this.emitNoteOff(oldNote.mpeBasePitch ?? oldNote.pitch, 0, 0, oldNote.mpeChannel, oldNote.isInternalSynthOnly);
              if (oldNote.mpeChannel) this.freeMpeChannel(oldNote.mpeChannel);
            }
          } else if (!oldNote && newPitch !== undefined) {
            const channel = this.allocateMpeChannel();
            this.emitNoteOn(newPitch, velocity, 0, channel, suppressImmediatePlay);
            newMemory.push({ pitch: newPitch, delayUsed: 0, isBass: false, mpeChannel: channel, mpeBasePitch: newPitch, mpeCurrentPitch: newPitch, isInternalSynthOnly: suppressImmediatePlay });
          }
        }
      } else {
        for (const oldNote of oldChordNotes) {
          const stillInChord = finalPitches.includes(oldNote.pitch);
          if (stillInChord) {
            oldNote.heldByPedal = false;
            newMemory.push(oldNote);
          } else if (this.sustainPedalActive) {
            // The slider has moved past this note but the pedal is down, so it
            // is kept and each voicing stacks on the last. Marked, because the
            // pedal lifting is what ends it — the key is still held.
            oldNote.heldByPedal = true;
            newMemory.push(oldNote);
          } else {
            if (oldNote.timeoutId) clearTimeout(oldNote.timeoutId);
            else this.emitNoteOff(oldNote.mpeBasePitch ?? oldNote.pitch, 0, 0, oldNote.mpeChannel, oldNote.isInternalSynthOnly);
            if (oldNote.mpeChannel) this.freeMpeChannel(oldNote.mpeChannel);
          }
        }

        for (const newPitch of finalPitches) {
          // A pitch the pedal is already holding is left alone rather than
          // struck again, or sliding back over it would double the note.
          const alreadySounding = newMemory.some(n => !n.isBass && n.pitch === newPitch);
          if (!oldChordPitches.includes(newPitch) && !alreadySounding) {
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

    // With a pattern running the bass belongs to it: sounding it here would put
    // the new chord's root over the old chord's notes, which is the overlap you
    // hear when changing chord. The run picks it up at its next note instead.
    const patternOwnsBass = this.params.patternEnabled;
    if (!skipBass && !patternOwnsBass && bassSetting > 0 && bassPitch >= 0 && bassPitch <= 127) {
      const channel = this.params.mpeEnabled ? this.allocateMpeChannel() : undefined;
      this.emitNoteOn(bassPitch, velocity, 0, channel, suppressImmediatePlay);
      this.activePitchesMemory[pitch].push({ pitch: bassPitch, delayUsed: 0, isBass: true, mpeChannel: channel, mpeBasePitch: bassPitch, mpeCurrentPitch: bassPitch, isInternalSynthOnly: suppressImmediatePlay });
      playedPitches[bassPitch] = true;
    }

    // A pattern places the notes itself, so the strum — which is the same stage
    // doing a simpler job — steps aside rather than fighting it for the timing.
    if (this.params.patternEnabled) {
      const patternPitches = finalPitches.filter(p => p >= 0 && p <= 127 && !playedPitches[p]);
      const runBass = (!skipBass && bassSetting > 0 && bassPitch >= 0 && bassPitch <= 127) ? bassPitch : null;
      this.startPatternRun(pitch, patternPitches, runBass, velocity);
      this.updateStrumplatePitches();
      return;
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

  private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel?: number, isInternalSynthOnly: boolean = false, isMidiOnly: boolean = false, isRaw: boolean = false, isCycleStart: boolean = false) {
    // A glide still running on this channel belongs to the note being replaced;
    // letting it continue would bend the note starting here.
    this.cancelChannelGlide(channel);
    const finalVelocity = this.calculateFinalVelocity(velocity, pitch, this.lastUpdateReason);
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity: finalVelocity, isOn: true, delayMs, mpeChannel: channel, isInternalSynthOnly, isRaw, isCycleStart });
    
    // Reset expression and pitch bend on note on, in case channel was reused/glided
    if (this.params.mpeEnabled) {
      this.emitMpeExpression(channel, 127, delayMs);
      if (this.onOutputNote) {
        this.onOutputNote({ pitch, velocity: 0, isOn: false, delayMs, mpeChannel: channel, isPitchBend: true, pitchBendValue: 0 });
      }
    }
  }

  private emitNoteOff(pitch: number, velocity: number = 0, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false, isMidiOnly: boolean = false) {
    // The note is ending; its glide must not outlive it and bend the next one.
    this.cancelChannelGlide(channel);
    if (isInternalSynthOnly && !this.params.omnichordSynthMonitor) {
      return; // Fully silent
    }
    if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel, isInternalSynthOnly, isMidiOnly });
  }

  /**
   * Sweep a controller up and down so a plugin's MIDI-learn can catch it.
   * Ends back at the middle, which is also where the tremolo will centre.
   */
  public wiggleCC(ccNumber: number, channel: number = 1) {
    const path = [0, 32, 64, 96, 127, 96, 64, 32, 0, 64];
    path.forEach((value, i) => this.emitControlChange(ccNumber, value, channel, i * 45));
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
