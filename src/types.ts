export interface OrchidParams {
  mappingMode: number; // 0=Orchid, 1=Free
  controlOctave: number; // 0=C0, 1=C1, 2=C2, 3=C3
  voicingRange: number; // 12 to 36
  momentaryBase: boolean;
  momentaryExt: boolean;
  alwaysAdd7th: boolean;
  keyboardMapping: number; // 0=Classic, 1=Circle, 2=Key Mode
  keyRoot: number; // 0=C to 11=B
  keyScale: number; // 0=Major, 1=Minor, 2=Melodic Minor
  registerMode: number; // 0=Absolute Start, 1=Inversions
  chordRegisterStart: number; // 24 to 96
  chordInversion: number; // 0 to 16
  chordDensity: number; // 0=3, 1=4, 2=5, 3=3-5, 4=4-6
  mpeEnabled: boolean;
  mpeBendRange: number;
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
  keyRoot: 0,
  keyScale: 0,
  registerMode: 0,
  chordRegisterStart: 60,
  chordInversion: 0,
  chordDensity: 4,
  mpeEnabled: false,
  mpeBendRange: 48,
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
}
