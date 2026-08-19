import re
content = open('src/lib/SimpleSynth.ts').read()

# Replace existingNodes.length = 0; with this.activeOscillators.delete(pitch);
content = content.replace('existingNodes.length = 0; // Clear them', 'this.activeOscillators.delete(pitch);')

open('src/lib/SimpleSynth.ts', 'w').write(content)
