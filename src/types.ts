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
