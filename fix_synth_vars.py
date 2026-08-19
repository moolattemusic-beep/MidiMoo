import re
content = open('src/lib/SimpleSynth.ts').read()

content = content.replace(
    'private activeOscillators: Map<number, { osc: OscillatorNode; gain: GainNode }[]> = new Map();',
    "private activeOscillators: Map<number, { osc: OscillatorNode; gain: GainNode }[]> = new Map();\n  private activeChannels: Map<number, number> = new Map();"
)
open('src/lib/SimpleSynth.ts', 'w').write(content)
