export interface OrchidParams {
  mappingMode: number; // 0=Orchid, 1=Free
  controlOctave: number; // 0=C0, 1=C1, 2=C2, 3=C3
  voicingRange: number; // 12 to 36
  momentaryBase: boolean;
  momentaryExt: boolean;
  alwaysAdd7th: boolean;
  keyboardMapping: number; // 0=Classic, 1=Circle, 2=Key Mode, 3=Free, 4=Walk
  /** In WALK, keys at or above this are the cursor; below it they are chord keys as usual. */
  walkSplit: number;
  /** Walk the whole held voicing rather than a single note. */
  walkChord: boolean;
  /** Hold each note until the next has sounded, so the line never breaks. */
  walkLegato: boolean;
  /** How many voices the walker stacks: 1, 2 or 3. */
  walkStack: number;
  /** How many chord tones apart the stacked voices sit. */
  walkStackTones: number;
  /** How loosely the stacked voices follow: a little late, a little softer. */
  walkHumanize: number;
  /** Keep walking in time rather than a step per press. */
  walkSync: boolean;
  walkBpm: number;
  /** Steps per beat: 1 a quarter, 2 an eighth, 3 a triplet eighth, 4 a sixteenth. */
  walkRate: number;
  keyRoot: number; // 0=C to 11=B
  keyScale: number; // 0=Major, 1=Minor, 2=Melodic Minor
  chordRegisterStart: number; // 24 to 96
  chordInversion: number; // 0 to 16
  mpeEnabled: boolean;
  mpeBendRange: number;
  /** How a voice enters when the new chord has more notes than the old: 0 attack, 1 unison then glide, 2 drop. */
  mpeNewVoice: number;
  /** The strum pad runs over the chord's scale rather than only its own notes. */
  arpeggioScale: boolean;
  /** The strip beside the pad: 0 sends pitch bend and springs back, 1 sends CC1 and stays put. */
  arpeggioStripMode: number;
  mpeGlideTimeMs: number;
  mpeGlideMode: number; // 0=Legato (overlap only), 1=Grace window, 2=Hold, 3=Free MOO
  mpeGraceMs: number; // Grace-window length used by mpeGlideMode 1
  mpeMaxVoices: number; // Free MOO voice pool size
  mpeChordWindowMs: number; // Free MOO: note-ons this close together are one chord gesture
  autoBassRegister: number; // 0=OFF, 1=C0, 2=C1, 3=C2
  strumEngine: number; // 0=OFF, 1=ON
  strumDirection: number; // 0=Up, 1=Down, 2=Random
  strumAlternate: boolean;
  inversionRepeat: number; // 0 to 8
  strumSpeedMs: number; // 0 to 360
  voicingX: number; // -1 to 1
  voicingY: number; // -1 to 1
  omnichordMode: boolean;
  omnichordSynthMonitor: boolean;
  velHumanize: number;
  velHighRegisterPad: number;
  velGlideInversion: number;
  velGlideChord: number;
  arpeggioOctaves: number;
  arpeggioMaxVelocity: number;
  arpeggioRegisterStart: number;
  arpeggioNoteLengthMs: number; // how long a strum-pad note rings before release
  arpeggioPattern: number; // 0=Up, 1=Down, 2=Two up one down, 3=Alternate, 4=Thirds, 5=Pendulum, 6=Outside-in, 7=Random
  arpeggioTapToPlay: boolean; // sound a note when the pad is tapped, not only when swiped
  // The three arpeggio routings are independent of each other: a note can be on
  // its own channel and glide, or neither, and RAW overrides both by taking the
  // note out of the modulation entirely.
  arpeggioMpeChannels: boolean; // one MPE channel per arpeggio note
  arpeggioGlide: boolean; // bend from the previous arpeggio note into the new one
  arpeggioRaw: boolean; // no velocity modulation or vibrato, velocity only

  // Velocity envelope -> pitch bend and CC1, applied to the MIDI output only.
  velModEnabled: boolean;
  velModPitchEnabled: boolean;
  velModCC1Enabled: boolean;
  velModSensitivity: number; // gain on the velocity reading before it drives anything
  velModPitchAmount: number; // semitones added at full velocity
  velModPitchAttack: number; // 0-100, same curve as the Logic script
  velModPitchRelease: number;
  velModCC1Anchor: number; // 0-127 at rest
  velModCC1Amount: number; // -100..100 % of full scale at full velocity
  velModCC1Attack: number;
  velModCC1Release: number;
  // CC74 is the one expression MPE defines per note, so it is what carries the
  // per-voice modulation. It also sends outside MPE, on the master channel.
  velModCC74Enabled: boolean;
  velModCC74Anchor: number; // 0-127 at rest
  velModCC74Amount: number; // -100..100 % of full scale at full velocity
  velModCC74Attack: number;
  velModCC74Release: number;
  // With MPE on, each sounding voice runs its own velocity envelope from its
  // own note's velocity, so a strummed chord modulates unevenly across it.
  velModPerVoice: boolean;
  // A voicing saved by hand in free mode follows the register slider rather
  // than staying at the exact notes it was played at.
  memoryFollowRegister: boolean;
  // Rhythmic pattern applied to a chord's voices. The clock is the app's own —
  // a tempo typed in rather than taken from a host.
  patternEnabled: boolean;
  patternIndex: number;
  patternBpm: number;
  patternCustom: string | null; // an edited or generated pattern, as JSON
  // 0 = the running pattern keeps its place and the notes become the new
  // chord's, 1 = the change waits for the start of the next cycle.
  patternChordChange: number;
  // 0 = the lowest voice is the bass, 1 = the bass is independent of the
  // pattern and sounds on the downbeat.
  patternBassMode: number;
  memoryMomentary: boolean;
  // The register slider moves the next chord rather than the one sounding, so
  // it can be set up in advance without announcing itself.
  registerSilent: boolean;
  // How long pattern notes are held, as a percentage of their written length.
  // Kept off the editor on purpose: it is one feel control for the whole
  // pattern, and drawing it would clutter the notes being edited.
  patternRelease: number;
  // Snap and grid for the editor, in ticks.
  patternGrid: number;
  // On a chord change the pedal is lifted for a moment even if it is being
  // held, so the chord before does not sustain into the one after.
  patternPedalLift: boolean;
  // The pattern plays at its own level rather than at whatever the keys were
  // struck at, so a weighted or unweighted controller makes no difference.
  patternFixedVelocity: boolean;
  patternVelocity: number; // 1-127, the level a full-accent note plays at
  // A chord let go and replaced within the grace window rejoins the cycle
  // rather than starting a new one, so chords need not be overlapped to keep
  // the pattern running.
  patternGraceEnabled: boolean;
  patternGraceMs: number;
  // Rotates which chord tone each voice of the pattern plays, wrapping up an
  // octave as it passes the top: the pattern's own inversion, live.
  patternInversion: number;
  // How the generator is steered.
  patternRandomDensity: number; // 0-100, how much of the grid is filled
  patternRandomOverlap: number; // 0-100, how often voices sound together
  // How many octaves of the chord a pattern can reach. The voicing has one note
  // per chord tone; this repeats those tones upward so a pattern has more rungs
  // to climb than the chord has notes — which is what a harpist or guitarist
  // does with a three-note chord.
  patternSpread: number; // 1-3 octaves
  // How much colour the chord carries, dry to rich. The tensions are added in
  // the order each quality wants them.
  chordColor: number; // 0-4
  // How many notes a chord is voiced with, plainly. Replaces the old density
  // bands, which said things like "4-6" and left the actual count implicit.
  chordMaxNotes: number; // 1-8
  // Which tensions each quality of chord may take, as JSON. Null means the
  // ordinary set for each.
  chordColorMatrix: string | null;
  // Voice chords the way they are actually played, from the library of shapes
  // taken off written progressions, rather than by stacking thirds and dropping
  // one of them.
  voicingPlayed: boolean;
  // The range everything leaving the app has to fit in. A note outside it is
  // moved by whole octaves until it fits, so nothing is lost and nothing sounds
  // in a register the part was never meant to reach.
  outputRangeLow: number;
  outputRangeHigh: number;
  // How far MODIFY moves the pattern it is given.
  patternModifyAmount: number; // 0-100
  // Half and double time. The tempo stays as typed; this is how fast the
  // pattern runs against it.
  patternRate: number; // 0.25 - 4
  // Sound the chord itself at the top of each cycle, with the pattern moving
  // over it.
  patternChordLayer: boolean;
  // Once started, the transport keeps running: chords change the notes it is
  // playing rather than starting and stopping it.
  patternContinuous: boolean;
  // Where the weight sits between the figure and the chord under it. Fifty is
  // level; below it the pattern leads, above it the chord does.
  patternChordBalance: number; // 0-100
  // How far notes are allowed off the grid. Most of that movement is late
  // rather than early, because a part that rushes sounds nervous where one that
  // drags sounds played.
  patternHumanize: number; // 0-100
  velModChordThresholdMs: number; // notes closer than this share one envelope

  // Vibrato that fades in after each note, like a singer leaning into it.
  vibratoEnabled: boolean;
  vibratoDepth: number; // semitones at full intensity
  vibratoRateHz: number; // speed at full intensity; starts at half and climbs
  vibratoFadeMs: number; // time from note to full intensity
  vibratoFadeStart: number; // 0-100%, how much intensity a note starts with
  // The same LFO drives CC80, so tremolo stays locked to the pitch vibrato.
  vibratoCC80Depth: number; // -127..127 swing; negative flips the direction
  vibratoCC80Center: number; // 0-127 the value CC80 swings around and returns to
  memoryVelocity: number;
}

export const defaultParams: OrchidParams = {
  mappingMode: 0,
  controlOctave: 0,
  voicingRange: 12,
  momentaryBase: true,
  momentaryExt: true,
  alwaysAdd7th: false,
  keyboardMapping: 0,
  walkSplit: 60,
  walkChord: false,
  walkLegato: false,
  walkStack: 1,
  walkStackTones: 2,
  walkHumanize: 25,
  walkSync: false,
  walkBpm: 120,
  walkRate: 2,
  keyRoot: 0,
  keyScale: 0,
  chordRegisterStart: 60,
  chordInversion: 0,
  mpeEnabled: false,
  mpeBendRange: 48,
  mpeNewVoice: 0,
  arpeggioScale: false,
  arpeggioStripMode: 0,
  mpeGlideTimeMs: 150,
  mpeGlideMode: 0,
  mpeGraceMs: 250,
  mpeMaxVoices: 5,
  mpeChordWindowMs: 60,
  autoBassRegister: 0,
  strumEngine: 1,
  strumDirection: 0,
  strumAlternate: false,
  inversionRepeat: 0,
  strumSpeedMs: 40,
  voicingX: 0,
  voicingY: -1, // default to top (Closed)
  omnichordMode: false,
  omnichordSynthMonitor: true,
  velHumanize: 10,
  velHighRegisterPad: 20,
  velGlideInversion: 10,
  velGlideChord: 10,
  arpeggioOctaves: 4,
  arpeggioMaxVelocity: 127,
  arpeggioRegisterStart: 48,
  arpeggioNoteLengthMs: 100,
  arpeggioPattern: 0,
  arpeggioTapToPlay: false,
  arpeggioMpeChannels: true, // what the arpeggiator has always done under MPE
  arpeggioGlide: false,
  arpeggioRaw: false,
  velModEnabled: false,
  velModPitchEnabled: true,
  velModCC1Enabled: true,
  velModSensitivity: 1,
  velModPitchAmount: 0,
  velModPitchAttack: 0,
  velModPitchRelease: 20,
  velModCC1Anchor: 0,
  velModCC1Amount: 0,
  velModCC1Attack: 0,
  velModCC1Release: 20,
  velModCC74Enabled: true,
  velModCC74Anchor: 0,
  velModCC74Amount: 0,
  velModCC74Attack: 0,
  velModCC74Release: 20,
  velModPerVoice: true,
  memoryFollowRegister: true,
  patternEnabled: false,
  patternIndex: 0,
  patternBpm: 100,
  patternCustom: null,
  patternChordChange: 0,
  patternBassMode: 0,
  memoryMomentary: true,
  registerSilent: false,
  patternRelease: 100,
  patternGrid: 24,
  patternPedalLift: true,
  patternFixedVelocity: false,
  patternVelocity: 100,
  patternGraceEnabled: true,
  patternGraceMs: 350,
  patternInversion: 0,
  patternRandomDensity: 45,
  patternRandomOverlap: 30,
  patternSpread: 1,
  chordColor: 0,
  chordMaxNotes: 6,
  chordColorMatrix: null,
  voicingPlayed: true,
  outputRangeLow: 24,
  outputRangeHigh: 96,
  patternModifyAmount: 25,
  patternRate: 1,
  patternChordLayer: false,
  patternContinuous: false,
  patternChordBalance: 50,
  patternHumanize: 0,
  velModChordThresholdMs: 80,
  vibratoEnabled: false,
  vibratoDepth: 0.3,
  vibratoRateHz: 5.5,
  vibratoFadeMs: 800,
  vibratoFadeStart: 0,
  vibratoCC80Depth: 0,
  vibratoCC80Center: 64,
  memoryVelocity: 100,
};

export interface NoteEvent {
  pitch: number;
  velocity: number;
  isOn: boolean;
  delayMs?: number;
  mpeChannel?: number;
  isPitchBend?: boolean;
  pitchBendValue?: number; // -48 to 48 semitones, engine will convert
  isExpression?: boolean;
  expressionValue?: number; // 0 to 127
  isCC?: boolean;
  ccNumber?: number;
  ccValue?: number;
  isInternalSynthOnly?: boolean;
  isMidiOnly?: boolean;
  // Sent without any velocity modulation or vibrato — the arpeggiator's RAW
  // routing, where only the played velocity reaches the synth.
  isRaw?: boolean;
  // The first note of a pattern cycle. The shared modulation layers restart
  // here and nowhere else, so vibrato swells once per cycle instead of being
  // re-zeroed by every note in the rhythm.
  isCycleStart?: boolean;
}
