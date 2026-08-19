import re
content = open('src/lib/OrchidEngine.ts').read()

# Fix redeclarations
content = content.replace(
    'const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;\n      this.emitNoteOff(noteObj.pitch, 0, 0, channel, false, isMidiOnly);',
    'this.emitNoteOff(noteObj.pitch, 0, 0, channel, false, this.params.omnichordMode && this.params.omnichordSynthMonitor);'
)
content = content.replace(
    'const isMidiOnly = this.params.omnichordMode && this.params.omnichordSynthMonitor;\n      this.emitNoteOn(noteObj.pitch, 100, 0, channel, false, isMidiOnly);',
    'this.emitNoteOn(noteObj.pitch, 100, 0, channel, false, this.params.omnichordMode && this.params.omnichordSynthMonitor);'
)

# Fix emitNoteOn signature
content = re.sub(
    r'private emitNoteOn\(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false\)',
    'private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel?: number, isInternalSynthOnly: boolean = false, isMidiOnly: boolean = false)',
    content
)

# Fix emitNoteOff signature
content = re.sub(
    r'private emitNoteOff\(pitch: number, velocity: number = 0, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false\)',
    'private emitNoteOff(pitch: number, velocity: number = 0, delayMs: number = 0, channel?: number, isInternalSynthOnly: boolean = false, isMidiOnly: boolean = false)',
    content
)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Fixed Engine")
