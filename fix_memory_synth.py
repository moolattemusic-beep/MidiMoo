import re

content = open('src/lib/OrchidEngine.ts').read()

# Replace the messy typeof expression with false everywhere first
content = content.replace(
    'isInternalSynthOnly: typeof suppressImmediatePlay !== "undefined" ? suppressImmediatePlay : false',
    'isInternalSynthOnly: false'
)

# Now, only for the parts in handleMidi after suppressImmediatePlay is defined (i.e. around line 1053+),
# we replace isInternalSynthOnly: false with isInternalSynthOnly: suppressImmediatePlay.
# Let's just use string replace for the specific blocks.
# Actually, the simplest way is to find suppressImmediatePlay declaration, and replace inside that block.
parts = content.split('const suppressImmediatePlay = this.params.omnichordMode && !forcePlay;')
if len(parts) == 2:
    part0 = parts[0]
    part1 = parts[1].replace('isInternalSynthOnly: false', 'isInternalSynthOnly: suppressImmediatePlay')
    content = part0 + 'const suppressImmediatePlay = this.params.omnichordMode && !forcePlay;' + part1

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Cleaned up suppressImmediatePlay")
