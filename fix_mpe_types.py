import re
content = open('src/types.ts').read()

mpe_params = """  chordDensity: number; // 0=3, 1=4, 2=5, 3=3-5, 4=4-6
  mpeEnabled: boolean;
  mpeBendRange: number;
  mpeGlideTimeMs: number;
"""
content = content.replace('  chordDensity: number; // 0=3, 1=4, 2=5, 3=3-5, 4=4-6\n', mpe_params)

mpe_default = """  chordDensity: 4,
  mpeEnabled: false,
  mpeBendRange: 48,
  mpeGlideTimeMs: 150,
"""
content = content.replace('  chordDensity: 4,\n', mpe_default)

event_type = """export interface NoteEvent {
  pitch: number;
  velocity: number;
  isOn: boolean;
  delayMs?: number;
  mpeChannel?: number;
  isPitchBend?: boolean;
  pitchBendValue?: number; // -48 to 48 semitones, engine will convert
}"""

content = re.sub(r'export interface NoteEvent \{.*?\}', event_type, content, flags=re.DOTALL)

open('src/types.ts', 'w').write(content)
