/**
 * MODEL D — a monophonic front end for an outboard synth.
 *
 * A port of Brian's Logic Scripter plugin, the one that normally sits on an
 * External Instrument track feeding the Moog. It exists because a mono synth
 * given a chord picks one note arbitrarily and gates badly: what it wants is a
 * single voice, retriggered cleanly, and a buffer deciding which of the held
 * notes gets it.
 *
 * Two behaviours, chosen by how many notes are held:
 *   one note   — last note played sounds, with a gap before the retrigger so
 *                the envelope actually restarts rather than sliding.
 *   two or more— the held notes are arpeggiated, optionally accelerating.
 *
 * Kept free of MIDI so the whole thing can be driven by a test at whatever
 * speed it likes: notes leave through `onNoteOn`/`onNoteOff`, and time comes
 * from an injectable clock.
 */

export interface ModelDParams {
  /** Silence between a note ending and the next beginning, so the gate resets. */
  gapMs: number;
  /** How many held notes the buffer remembers before it starts dropping them. */
  maxNotes: number;
  /** On overflow drop something other than the lowest note, keeping the bass. */
  lowestNotePriority: boolean;
  arpOn: boolean;
  baseArpSpeedMs: number;
  /** Weight the arp towards the lowest note, for a pedal-tone effect. */
  lowestNoteBiasEnabled: boolean;
  lowestNoteProb: number;
  curveEnabled: boolean;
  /** How long the chord runs at its base speed before the curve takes hold. */
  curveDelayMs: number;
  /** Positive accelerates, negative slows. Per step, in tenths of a percent. */
  arpCurveAmount: number;
  /** At the 25ms floor, turn round and decelerate instead of staying pinned. */
  foldbackEnabled: boolean;
}

export const defaultModelDParams: ModelDParams = {
  gapMs: 10,
  maxNotes: 5,
  lowestNotePriority: true,
  arpOn: true,
  baseArpSpeedMs: 40,
  lowestNoteBiasEnabled: false,
  lowestNoteProb: 50,
  curveEnabled: true,
  curveDelayMs: 500,
  arpCurveAmount: 0,
  foldbackEnabled: false,
};

/** The arp floor, and the speed foldback turns round at. */
const SPEED_FLOOR_MS = 25;
const SPEED_MIN_MS = 10;
const SPEED_MAX_MS = 2000;

/**
 * How often the arp clock wakes to decide whether a note is due. The Scripter
 * original got this for free — `ProcessMIDI` runs once per audio buffer, about
 * every 3ms at 44.1k/128 — so this matches that rather than trying to schedule
 * each note exactly, which would drift as the curve changes the interval.
 */
const TICK_MS = 2;

interface HeldNote {
  pitch: number;
  velocity: number;
  /** The channel it arrived on, so MPE bend can follow the sounding note. */
  channel: number;
}

export class ModelD {
  public params: ModelDParams = { ...defaultModelDParams };

  public onNoteOn?: (pitch: number, velocity: number, delayMs: number) => void;
  public onNoteOff?: (pitch: number, delayMs: number) => void;

  private held: HeldNote[] = [];
  private soundingPitch = -1;
  private soundingChannel = 1;
  private arpIndex = 0;
  private lastArpTime = 0;
  private dynamicSpeedMs = defaultModelDParams.baseArpSpeedMs;
  private wasArpeggiating = false;
  private chordStartTime = 0;
  private curveDirection = 1;

  private clock: ReturnType<typeof setInterval> | null = null;
  /** Notes still waiting out a strum's delay, so a reset can cancel them. */
  private pending = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private now: () => number = () => Date.now(),
    private random: () => number = () => Math.random(),
  ) {}

  /** The channel of whatever is sounding, for routing per-note pitch bend. */
  public get soundingOnChannel(): number { return this.soundingChannel; }
  public get isSounding(): boolean { return this.soundingPitch !== -1; }
  public get heldCount(): number { return this.held.length; }

  // ---- input -------------------------------------------------------------

  public noteOn(pitch: number, velocity: number, delayMs = 0, channel = 1) {
    if (delayMs > 0) { this.later(() => this.noteOnNow(pitch, velocity, channel), delayMs); return; }
    this.noteOnNow(pitch, velocity, channel);
  }

  public noteOff(pitch: number, delayMs = 0) {
    if (delayMs > 0) { this.later(() => this.noteOffNow(pitch), delayMs); return; }
    this.noteOffNow(pitch);
  }

  private noteOnNow(pitch: number, velocity: number, channel: number) {
    // A repeated pitch replaces its entry rather than adding a second, so the
    // buffer holds distinct notes and the arp cannot land on one twice running.
    this.held = this.held.filter(n => n.pitch !== pitch);
    this.held.push({ pitch, velocity, channel });

    while (this.held.length > Math.max(1, this.params.maxNotes)) {
      let dropIndex = 0; // oldest, unless the bass is being protected
      if (this.params.lowestNotePriority && this.held.length > 1) {
        let lowest = 128;
        for (const n of this.held) if (n.pitch < lowest) lowest = n.pitch;
        for (let k = 0; k < this.held.length; k++) {
          if (this.held[k].pitch !== lowest) { dropIndex = k; break; }
        }
      }
      this.held.splice(dropIndex, 1);
    }

    this.evaluate(true);
  }

  private noteOffNow(pitch: number) {
    const i = this.held.findIndex(n => n.pitch === pitch);
    if (i === -1) return;
    this.held.splice(i, 1);
    this.evaluate(false);
  }

  /** Everything off and forgotten. Safe to call when nothing is sounding. */
  public reset() {
    for (const t of this.pending) clearTimeout(t);
    this.pending.clear();
    this.stopClock();
    this.held = [];
    this.wasArpeggiating = false;
    this.kill();
  }

  // ---- routing -----------------------------------------------------------

  private evaluate(isNewNote: boolean) {
    const arpeggiating = this.params.arpOn && this.held.length > 1;

    if (arpeggiating) {
      // A chord that has just formed, or gained a note, restarts the curve from
      // its base speed — otherwise a new chord would inherit the last one's
      // acceleration and take off immediately.
      if (!this.wasArpeggiating || isNewNote) {
        this.dynamicSpeedMs = this.params.baseArpSpeedMs;
        this.lastArpTime = 0; // due now: the next tick plays straight away
        this.chordStartTime = this.now();
        this.curveDirection = 1;
        // Enter on a note that is not already sounding, so adding a note to a
        // held chord is heard rather than repeating what is under the finger.
        for (let i = 0; i < this.held.length; i++) {
          if (this.held[i].pitch !== this.soundingPitch) { this.arpIndex = i; break; }
        }
      }
      this.wasArpeggiating = true;
      this.startClock();
      return;
    }

    this.wasArpeggiating = false;
    this.stopClock();

    if (this.held.length === 0) { this.kill(); return; }

    // Last note played wins — the buffer decides what is *available*, not what
    // sounds, so releasing a note falls back to whatever is still down.
    const latest = this.held[this.held.length - 1];
    if (this.soundingPitch !== latest.pitch) {
      this.kill(latest.pitch);
      this.play(latest, this.params.gapMs);
    }
  }

  /** One arp step, if one is due. Mirrors the Scripter's `ProcessMIDI`. */
  public tick() {
    if (!this.params.arpOn || this.held.length <= 1) return;
    const now = this.now();
    if (now - this.lastArpTime < this.dynamicSpeedMs) return;
    this.lastArpTime = now;

    const next = this.chooseArpNote();
    if (!next) return;

    // Chosen before the kill so the trailing safety note-off knows which pitch
    // is about to start and can stand out of its way.
    this.kill(next.pitch);

    let safeGap = Math.min(this.params.gapMs, this.dynamicSpeedMs - 5);
    if (safeGap < 0) safeGap = 0;
    this.play(next, safeGap);

    this.applyCurve(now);
  }

  private chooseArpNote(): HeldNote | null {
    if (this.held.length === 0) return null;

    if (this.params.lowestNoteBiasEnabled) {
      let lowest = 128;
      for (const n of this.held) if (n.pitch < lowest) lowest = n.pitch;

      if (this.random() * 100 < this.params.lowestNoteProb) {
        return this.held.find(n => n.pitch === lowest) ?? this.held[0];
      }
      const upper = this.held.filter(n => n.pitch !== lowest);
      if (upper.length === 0) return this.held[0];
      if (this.arpIndex >= upper.length) this.arpIndex = 0;
      const chosen = upper[this.arpIndex];
      this.arpIndex++;
      return chosen;
    }

    if (this.arpIndex >= this.held.length) this.arpIndex = 0;
    const chosen = this.held[this.arpIndex];
    this.arpIndex = (this.arpIndex + 1) % this.held.length;
    return chosen;
  }

  private applyCurve(now: number) {
    if (!this.params.curveEnabled || this.params.arpCurveAmount === 0) return;
    if (now - this.chordStartTime < this.params.curveDelayMs) return;

    const factor = 1.0 - ((this.params.arpCurveAmount * this.curveDirection) / 1000);
    this.dynamicSpeedMs *= factor;

    if (this.params.foldbackEnabled && this.dynamicSpeedMs <= SPEED_FLOOR_MS) {
      this.dynamicSpeedMs = SPEED_FLOOR_MS;
      this.curveDirection = -1;
    }
    this.dynamicSpeedMs = Math.max(SPEED_MIN_MS, Math.min(SPEED_MAX_MS, this.dynamicSpeedMs));
  }

  // ---- emitting ----------------------------------------------------------

  /**
   * Stop whatever is sounding. The note-off goes twice — now, and again after
   * the gap — because a mono synth that misses one is left gated open with
   * nothing able to close it.
   *
   * `nextPitch` is what is about to start. The original script always sent the
   * trailing off, which is harmless while the pitch changes but chokes a
   * repeated note: the note-on lands at `gapMs` and the safety off at
   * `gapMs + 2`, cutting it to two milliseconds. Only reachable through the
   * lowest-note bias, where the same note can legitimately come round twice,
   * which is exactly where it was heard as a stutter.
   */
  private kill(nextPitch?: number) {
    if (this.soundingPitch === -1) return;
    const pitch = this.soundingPitch;
    this.onNoteOff?.(pitch, 0);
    if (this.params.gapMs > 0 && pitch !== nextPitch) {
      this.onNoteOff?.(pitch, this.params.gapMs + 2);
    }
    this.soundingPitch = -1;
  }

  private play(note: HeldNote, delayMs: number) {
    this.onNoteOn?.(note.pitch, note.velocity, delayMs > 0 ? delayMs : 0);
    // Marked as sounding immediately, though it starts after the gap: what
    // matters is that the next kill knows there is something to stop.
    this.soundingPitch = note.pitch;
    this.soundingChannel = note.channel;
  }

  // ---- clock -------------------------------------------------------------

  private startClock() {
    if (this.clock) return;
    this.clock = setInterval(() => this.tick(), TICK_MS);
  }

  private stopClock() {
    if (!this.clock) return;
    clearInterval(this.clock);
    this.clock = null;
  }

  private later(fn: () => void, delayMs: number) {
    const t = setTimeout(() => { this.pending.delete(t); fn(); }, delayMs);
    this.pending.add(t);
  }
}
