import re

content = open('src/lib/OrchidEngine.ts').read()

content = content.replace(
    'mpeCurrentPitch?: number }>> = {};',
    'mpeCurrentPitch?: number, isInternalSynthOnly?: boolean }>> = {};'
)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Fixed type")
