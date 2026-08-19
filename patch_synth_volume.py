content = open('src/lib/SimpleSynth.ts').read()

content = content.replace(
    'private masterGain: GainNode | null = null;',
    'private masterGain: GainNode | null = null;\n  private masterVolume: number = 0.3;\n\n  public setVolume(value: number) {\n    this.masterVolume = value;\n    if (this.masterGain) {\n      this.masterGain.gain.value = value;\n    }\n  }'
)
content = content.replace(
    'this.masterGain.gain.value = 0.3; // prevent clipping',
    'this.masterGain.gain.value = this.masterVolume; // prevent clipping'
)

open('src/lib/SimpleSynth.ts', 'w').write(content)
print("Patched SimpleSynth")
