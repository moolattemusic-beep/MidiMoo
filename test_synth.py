import re
content = open('src/lib/SimpleSynth.ts').read()

print("Original playNote:")
print(content[content.find('private playNote'):content.find('private stopNote')])

print("Original stopNote:")
print(content[content.find('private stopNote'):content.find('setTimeout(() => {')])

