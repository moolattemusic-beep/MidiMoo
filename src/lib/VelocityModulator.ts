import { OrchidParams } from '../types';

/**
 * Velocity envelope -> pitch bend and CC1, a port of the Logic Scripter
 * "Velocity to Parameter Envelope" plugin.
 *
 * The shape is one AR envelope per chord rather than one per note: a note-on
 * that arrives more than the chord threshold after the previous one captures
 * its velocity and restarts the envelopes, so the first note of a chord drives
 * the whole thing. The envelope rises to 1 and falls straight back to 0 — there
 * is no sustain, and note-offs are not involved.
 *
 * Velocity * amount * envelope is the modulation. CC1 adds it to an anchor
 * (its resting value); pitch always rests at zero and only ever deviates while
 * the envelope is running.
 *
 * This sits at the end of the MIDI chain and never touches the engine. Pitch is
 * published as an offset that MidiDeviceManager adds to whatever bend the glide
 * engine is sending, so the two can't fight over the same channel.
 */

const TICK_MS = 10;
const MAX_STAGE_MS = 10000;

type Phase = 'idle' | 'attack' | 'release';

class Envelope {
  value = 0;
  phase: Phase = 'idle';

  trigger() {
    this.value = 0;
    this.phase = 'attack';
  }

  reset() {
    this.value = 0;
    this.phase = 'idle';
  }

  // Returns true while the envelope is still moving.
  advance(dtMs: number, attackParam: number, releaseParam: number): boolean {
    if (this.phase === 'attack') {
      const ms = stageDurationMs(attackParam);
      this.value = ms <= 0 ? 1 : this.value + dtMs / ms;
      if (this.value >= 1) {
        this.value = 1;
        this.phase = 'release';
      }
      return true;
    }
    if (this.phase === 'release') {
      const ms = stageDurationMs(releaseParam);
      this.value = ms <= 0 ? 0 : this.value - dtMs / ms;
      if (this.value <= 0) {
        this.value = 0;
        this.phase = 'idle';
      }
      return true;
    }
    return false;
  }
}

/**
 * The script advances the envelope by (101 - p)^2 * 0.00005 per ProcessMIDI
 * call, which makes its speed depend on the host's buffer size. Same curve,
 * expressed in milliseconds so it behaves identically everywhere.
 */
export function stageDurationMs(param: number): number {
  const p = Math.max(0, Math.min(100, param));
  if (p === 0) return 0; // instant
  const ticks = 20000 / Math.pow(101 - p, 2);
  return Math.min(MAX_STAGE_MS, ticks * TICK_MS);
}

/**
 * One sounding voice's share of the modulation. Under MPE each note gets its
 * own, keyed by the channel it went out on, so a strummed chord modulates
 * unevenly across its notes the way separate voices would.
 */
class Voice {
  pitchEnv = new Envelope();
  cc74Env = new Envelope();
  velocity = 0;
  sounding = 0;
  lastSentPitch: number | null = null;
  lastSentCC74: number | null = null;
}

// The key the single shared voice is filed under when notes are not being
// tracked per channel, so one code path serves both arrangements.
const GLOBAL_VOICE = 0;

export class VelocityModulator {
  private params: OrchidParams;
  private voices: Map<number, Voice> = new Map();
  private cc1Env = new Envelope();

  private triggerVelocity = 0;
  private lastNoteTime = 0;
  private timer: any = null;
  private lastTickAt = 0;

  // Vibrato: an LFO whose depth and speed fade up after each new note, so it
  // swells the way a singer leans into it rather than arriving fully formed.
  private vibratoPhase = 0;
  private vibratoElapsed = 0;
  // Vibrato only runs while something is actually sounding, otherwise the LFO
  // would keep pushing bend messages out over a silent instrument.
  private soundingNotes = 0;

  // Only send when the value actually changes, as the script does.
  private lastSentPitch: number | null = null;
  private lastSentCC1: number | null = null;
  private lastSentCC74: number | null = null;

  // Set by the physical mod wheel, which acts as a live CC1 anchor. Null means
  // the wheel hasn't been touched, so the slider's anchor applies.
  private wheelAnchor: number | null = null;

  private lastSentCC80: number | null = null;
  private lastCC80SentAt = 0;
  // Tremolo swings around, and returns to, this value. MIDI gives no way to
  // read a plugin's parameter, so it has to be told: the CENTRE control sets
  // it, and an incoming CC80 from a controller takes it over live.
  private cc80CenterOverride: number | null = null;

  private get cc80Center(): number {
    return this.cc80CenterOverride ?? (this.params.vibratoCC80Center ?? 64);
  }

  public onPitchOffset?: (semitones: number) => void;
  public onCC1?: (value: number) => void;
  public onCC80?: (value: number) => void;
  public onCC74?: (value: number) => void;
  // Per-channel outputs. Only used while notes are tracked per voice; the
  // global pair above then carries just the vibrato, which is one shape across
  // the whole instrument rather than anything a single note owns.
  public onVoicePitchOffset?: (channel: number, semitones: number) => void;
  public onVoiceCC74?: (channel: number, value: number) => void;

  constructor(params: OrchidParams) {
    this.params = params;
  }

  setParams(params: OrchidParams) {
    const wasEnabled = this.params.velModEnabled;
    // Moving the anchor slider is the player taking the anchor back off the
    // physical wheel.
    if (params.velModCC1Anchor !== this.params.velModCC1Anchor) this.wheelAnchor = null;
    // Same for the tremolo centre: moving the slider takes it back off the
    // controller.
    if (params.vibratoCC80Center !== this.params.vibratoCC80Center) this.cc80CenterOverride = null;
    this.params = params;
    if (wasEnabled && !params.velModEnabled) this.disable();
    else if (params.velModEnabled) this.ensureRunning();
  }

  /** The slider taking over again releases the wheel's hold on the anchor. */
  clearWheelAnchor() {
    this.wheelAnchor = null;
  }

  setCC80Center(value: number) {
    this.cc80CenterOverride = Math.max(0, Math.min(127, value));
  }

  setWheelAnchor(value: number) {
    this.wheelAnchor = Math.max(0, Math.min(127, value));
    if (this.params.velModEnabled) this.ensureRunning();
  }

  get cc1Anchor(): number {
    return this.wheelAnchor ?? this.params.velModCC1Anchor;
  }

  get cc74Anchor(): number {
    return this.params.velModCC74Anchor ?? 0;
  }

  /**
   * Whether this note is modulated on its own channel. Outside MPE there are no
   * member channels to separate voices onto, so everything shares one envelope
   * exactly as it always has.
   */
  private isPerVoice(channel?: number): boolean {
    return (
      channel !== undefined &&
      channel > 0 &&
      this.params.mpeEnabled === true &&
      this.params.velModPerVoice !== false
    );
  }

  private voice(key: number): Voice {
    let v = this.voices.get(key);
    if (!v) {
      v = new Voice();
      this.voices.set(key, v);
    }
    return v;
  }

  noteOn(velocity: number, channel?: number) {
    if (velocity <= 0) return;
    this.soundingNotes++;
    if (!this.params.velModEnabled) return;

    const now = Date.now();
    // Notes inside the threshold belong to the same chord and must not
    // retrigger — the first note's velocity governs. This still decides the
    // shared layers, whether or not the voices are separated below.
    const startsChord = now - this.lastNoteTime > (this.params.velModChordThresholdMs ?? 80);
    if (startsChord) {
      this.triggerVelocity = velocity;
      this.cc1Env.trigger();
      // Vibrato starts over from silent and from zero deviation, so a new note
      // never begins part way through a swing.
      this.vibratoElapsed = 0;
      this.vibratoPhase = 0;
    }

    if (this.isPerVoice(channel)) {
      // Every note triggers its own envelope from its own velocity — the chord
      // threshold governs the shared layers, not this one.
      const v = this.voice(channel!);
      v.velocity = velocity;
      v.sounding++;
      v.pitchEnv.trigger();
      v.cc74Env.trigger();
      this.ensureRunning();
    } else if (startsChord) {
      const v = this.voice(GLOBAL_VOICE);
      v.velocity = velocity;
      v.pitchEnv.trigger();
      v.cc74Env.trigger();
      this.ensureRunning();
    }

    this.lastNoteTime = now;
  }

  noteOff(channel?: number) {
    this.soundingNotes = Math.max(0, this.soundingNotes - 1);
    if (channel === undefined) return;
    const v = this.voices.get(channel);
    if (v) v.sounding = Math.max(0, v.sounding - 1);
  }

  allNotesOff() {
    this.soundingNotes = 0;
    for (const [key, v] of this.voices) {
      if (key !== GLOBAL_VOICE) this.releaseVoice(key, v);
    }
  }

  /**
   * Hand a channel back to neutral. A freed channel is reused by the next note
   * along, which would otherwise inherit whatever the last voice left on it.
   */
  private releaseVoice(key: number, v: Voice) {
    if (v.lastSentPitch !== null && v.lastSentPitch !== 0) this.onVoicePitchOffset?.(key, 0);
    if (v.lastSentCC74 !== null && v.lastSentCC74 !== this.cc74Anchor) {
      this.onVoiceCC74?.(key, clamp127(this.cc74Anchor));
    }
    this.voices.delete(key);
  }

  private ensureRunning() {
    if (this.timer !== null) return;
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Return every layer to its neutral value and stand down. */
  disable() {
    this.stop();
    // Every separated voice hands its channel back, or a disabled modulator
    // would leave the offsets it had set sitting on those channels.
    for (const [key, v] of [...this.voices]) {
      if (key !== GLOBAL_VOICE) this.releaseVoice(key, v);
    }
    this.voices.clear();
    this.cc1Env.reset();
    this.triggerVelocity = 0;
    this.vibratoPhase = 0;
    this.vibratoElapsed = 0;
    if (this.lastSentPitch !== null && this.lastSentPitch !== 0) this.onPitchOffset?.(0);
    // Put CC80 back to its resting value so a disabled tremolo can't leave the
    // synth stuck quiet.
    if (this.lastSentCC80 !== null && this.lastSentCC80 !== this.cc80Center) {
      this.onCC80?.(clamp127(this.cc80Center));
    }
    if (this.lastSentCC74 !== null && this.lastSentCC74 !== this.cc74Anchor) {
      this.onCC74?.(clamp127(this.cc74Anchor));
    }
    this.lastSentPitch = null;
    this.lastSentCC1 = null;
    this.lastSentCC74 = null;
    this.lastSentCC80 = null;
  }

  /**
   * Sensitivity steepens the velocity response around mid velocity, so a narrow
   * band of playing dynamics spans the full depth. It pivots rather than simply
   * multiplying: a plain gain would push everything above the midpoint into the
   * ceiling and flatten out exactly where you play.
   */
  private velocityFactor(velocity: number): number {
    const sensitivity = Math.max(1, this.params.velModSensitivity ?? 1);
    return Math.max(0, Math.min(1, 0.5 + ((velocity / 127) - 0.5) * sensitivity));
  }

  private tick() {
    if (!this.params.velModEnabled) {
      this.disable();
      return;
    }

    const now = Date.now();
    const dt = Math.max(1, now - this.lastTickAt);
    this.lastTickAt = now;

    // Sensitivity steepens the velocity response around mid velocity, so a
    // narrow band of playing dynamics spans the full depth. It pivots rather
    // than simply multiplying: a plain gain would push everything above the
    // midpoint into the ceiling and flatten out exactly where you play.
    const velFactor = this.velocityFactor(this.triggerVelocity);

    const pitchOn = this.params.velModPitchEnabled !== false;
    const cc1On = this.params.velModCC1Enabled !== false;
    const cc74On = this.params.velModCC74Enabled !== false;
    const cc1Moving = this.cc1Env.advance(dt, this.params.velModCC1Attack, this.params.velModCC1Release);

    const vibrato = this.advanceVibrato(dt);

    let voicesMoving = false;
    for (const [key, v] of [...this.voices]) {
      const separate = key !== GLOBAL_VOICE;
      // Each voice's own velocity when it has one; the chord's velocity is what
      // the shared voice was triggered with.
      const vFactor = this.velocityFactor(v.velocity);
      const pitchMoving = v.pitchEnv.advance(dt, this.params.velModPitchAttack, this.params.velModPitchRelease);
      const cc74Moving = v.cc74Env.advance(dt, this.params.velModCC74Attack, this.params.velModCC74Release);
      if (pitchMoving || cc74Moving) voicesMoving = true;

      // Pitch has no anchor: it rests at zero. Off on its own channel the
      // velocity envelope travels alone, because the vibrato is applied once
      // across the instrument rather than per voice; sharing one voice, the two
      // layers sum into the single offset as they always have.
      const envPitch = pitchOn ? this.params.velModPitchAmount * vFactor * v.pitchEnv.value : 0;
      const pitch = quantize(separate ? envPitch : envPitch + vibrato.offset);
      if (pitch !== v.lastSentPitch) {
        v.lastSentPitch = pitch;
        if (separate) {
          this.onVoicePitchOffset?.(key, pitch);
        } else {
          // Mirrored onto the instrument-wide record, which is what standing
          // down consults to decide whether pitch needs returning to neutral.
          this.lastSentPitch = pitch;
          this.onPitchOffset?.(pitch);
        }
      }

      const cc74 = clamp127(Math.round(
        this.cc74Anchor + (cc74On ? (this.params.velModCC74Amount / 100) * 127 * vFactor * v.cc74Env.value : 0)
      ));
      if (cc74On && cc74 !== v.lastSentCC74) {
        v.lastSentCC74 = cc74;
        if (separate) {
          this.onVoiceCC74?.(key, cc74);
        } else {
          // Mirrored onto the instrument-wide record so standing down knows
          // whether CC74 was ever moved off its resting value.
          this.lastSentCC74 = cc74;
          this.onCC74?.(cc74);
        }
      }

      // A separated voice that has finished and been let go hands its channel
      // back; the shared one stays, since it is not tied to a channel at all.
      if (separate && !pitchMoving && !cc74Moving && v.sounding === 0) this.releaseVoice(key, v);
    }

    // With the voices separated the shared offset carries the vibrato alone, so
    // it still reaches every channel without being counted twice.
    if (this.voices.size === 0 || !this.voices.has(GLOBAL_VOICE)) {
      const vibratoOnly = quantize(vibrato.offset);
      if (vibratoOnly !== this.lastSentPitch) {
        this.lastSentPitch = vibratoOnly;
        this.onPitchOffset?.(vibratoOnly);
      }
    }

    const cc1 = clamp127(
      Math.round(this.cc1Anchor + (cc1On ? (this.params.velModCC1Amount / 100) * 127 * velFactor * this.cc1Env.value : 0))
    );
    if (cc1On && cc1 !== this.lastSentCC1) {
      this.lastSentCC1 = cc1;
      this.onCC1?.(cc1);
    }

    // Once everything has settled on its resting value there is nothing left to
    // compute; the next note or slider move starts the clock again.
    if (!voicesMoving && !cc1Moving && !vibrato.active) this.stop();
  }

  /**
   * Depth and rate both scale with how far the fade has progressed: the rate
   * starts at half speed and climbs to full, which is what makes it sound like
   * a player winding the vibrato on rather than switching it on.
   */
  private advanceVibrato(dtMs: number): { offset: number; active: boolean } {
    const depth = this.params.vibratoDepth ?? 0;
    const cc80Depth = this.params.vibratoCC80Depth ?? 0;
    const running = this.params.vibratoEnabled && this.soundingNotes > 0 && (depth > 0 || cc80Depth !== 0);

    if (!running) {
      this.vibratoElapsed = 0;
      this.vibratoPhase = 0;
      // Leave CC80 sitting at its resting value rather than wherever in the
      // swing it happened to stop.
      if (cc80Depth !== 0 && this.lastSentCC80 !== null) this.sendCC80(this.cc80Center, true);
      return { offset: 0, active: false };
    }

    this.vibratoElapsed += dtMs;
    const fadeMs = this.params.vibratoFadeMs ?? 0;
    const progress = fadeMs <= 0 ? 1 : Math.min(1, this.vibratoElapsed / fadeMs);
    // A note can begin with some intensity already in hand rather than from
    // nothing; the fade then covers the remaining distance to full.
    const start = Math.max(0, Math.min(100, this.params.vibratoFadeStart ?? 0)) / 100;
    const fade = start + (1 - start) * progress;

    const rateHz = (this.params.vibratoRateHz ?? 5.5) * (0.5 + 0.5 * fade);
    this.vibratoPhase += (dtMs / 1000) * rateHz * TWO_PI;
    if (this.vibratoPhase > TWO_PI) this.vibratoPhase -= TWO_PI;

    // One sine drives both, so the tremolo and the pitch vibrato stay locked
    // together — that coupling is what sells it as a voice rather than two
    // separate effects that happen to be running.
    const swing = Math.sin(this.vibratoPhase);
    if (cc80Depth !== 0) {
      this.sendCC80(clamp127(Math.round(this.cc80Center + swing * cc80Depth * fade)), false);
    }

    return { offset: swing * depth * fade, active: true };
  }

  /**
   * CC is 7-bit and goes to every channel, so an LFO running at the tick rate
   * would put out far more messages than the resolution justifies. Send only on
   * a real change, and no faster than CC80_MIN_INTERVAL_MS.
   */
  private sendCC80(value: number, force: boolean) {
    if (value === this.lastSentCC80) return;
    const now = Date.now();
    if (!force && now - this.lastCC80SentAt < CC80_MIN_INTERVAL_MS) return;
    this.lastCC80SentAt = now;
    this.lastSentCC80 = value;
    this.onCC80?.(value);
  }
}

const TWO_PI = Math.PI * 2;
const CC80_MIN_INTERVAL_MS = 20;
const clamp127 = (v: number) => Math.max(0, Math.min(127, v));
// A hundredth of a semitone is finer than the bend resolution anyone can hear,
// and quantising here stops the vibrato emitting a message per tick for changes
// too small to matter.
const quantize = (v: number) => Math.round(v * 100) / 100;
