import re
content = open('src/lib/OrchidEngine.ts').read()
content = content.replace(
    'private emitNoteOff(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1) {',
    'private emitNoteOff(pitch: number, velocity: number = 0, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false) {'
)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Fixed emitNoteOff")
