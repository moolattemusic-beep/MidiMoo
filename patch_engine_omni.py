import re

content = open('src/lib/OrchidEngine.ts').read()

# 1. Update emitNoteOn and emitNoteOff signatures
content = content.replace(
    'private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1) {',
    'private emitNoteOn(pitch: number, velocity: number, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false) {'
)
content = content.replace(
    'if (this.onOutputNote) this.onOutputNote({ pitch, velocity: finalVelocity, isOn: true, delayMs, mpeChannel: channel });',
    'if (this.onOutputNote) this.onOutputNote({ pitch, velocity: finalVelocity, isOn: true, delayMs, mpeChannel: channel, isInternalSynthOnly });'
)

content = content.replace(
    'private emitNoteOff(pitch: number, velocity: number = 0, delayMs: number = 0, channel: number = 1) {',
    'private emitNoteOff(pitch: number, velocity: number = 0, delayMs: number = 0, channel: number = 1, isInternalSynthOnly: boolean = false) {'
)
content = content.replace(
    'if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel });',
    'if (this.onOutputNote) this.onOutputNote({ pitch, velocity, isOn: false, delayMs, mpeChannel: channel, isInternalSynthOnly });'
)

# 2. Update all emitNoteOff calls reading from memory or activeArpeggioNotes
content = re.sub(
    r'this\.emitNoteOff\((note\.mpeBasePitch \?\? note\.pitch), 0, 0, (note\.mpeChannel)\);',
    r'this.emitNoteOff(\1, 0, 0, \2, note.isInternalSynthOnly);',
    content
)
content = re.sub(
    r'this\.emitNoteOff\((oldNote\.mpeBasePitch \?\? oldNote\.pitch), 0, 0, (oldNote\.mpeChannel)\);',
    r'this.emitNoteOff(\1, 0, 0, \2, oldNote.isInternalSynthOnly);',
    content
)
content = re.sub(
    r'this\.emitNoteOff\((existingBass\.mpeBasePitch \?\? existingBass\.pitch), 0, 0, (existingBass\.mpeChannel)\);',
    r'this.emitNoteOff(\1, 0, 0, \2, existingBass.isInternalSynthOnly);',
    content
)

# 3. Handle suppressImmediatePlay in handleNoteOn
# Instead of conditionally emitting, we always emit but pass the flag

content = re.sub(
    r'if \(!suppressImmediatePlay\) \{\s*this\.emitNoteOn\(bassPitch, velocity, 0, channel\);\s*\}',
    r'this.emitNoteOn(bassPitch, velocity, 0, channel, suppressImmediatePlay);',
    content
)
content = re.sub(
    r'if \(!suppressImmediatePlay\) this\.emitNoteOn\(newPitch, velocity, 0, channel\);',
    r'this.emitNoteOn(newPitch, velocity, 0, channel, suppressImmediatePlay);',
    content
)
content = re.sub(
    r'if \(!suppressImmediatePlay\) \{\s*this\.emitNoteOn\(newPitch, velocity, 0\); \/\/ Updates happen instantly\s*\}',
    r'this.emitNoteOn(newPitch, velocity, 0, undefined, suppressImmediatePlay);',
    content
)

content = re.sub(
    r'if \(!suppressImmediatePlay\) \{\s*if \(delayForThisNote > 0\) \{\s*noteObj\.timeoutId = setTimeout\(\(\) => \{\s*this\.emitNoteOn\(targetPitch, velocity, 0, noteObj\.mpeChannel\);\s*noteObj\.timeoutId = undefined;\s*\}, delayForThisNote\);\s*\} else \{\s*this\.emitNoteOn\(targetPitch, velocity, 0, noteObj\.mpeChannel\);\s*\}\s*\}',
    r'''if (delayForThisNote > 0) {
            noteObj.timeoutId = setTimeout(() => {
              this.emitNoteOn(targetPitch, velocity, 0, noteObj.mpeChannel, suppressImmediatePlay);
              noteObj.timeoutId = undefined;
            }, delayForThisNote);
          } else {
            this.emitNoteOn(targetPitch, velocity, 0, noteObj.mpeChannel, suppressImmediatePlay);
          }''',
    content
)

# And make sure isInternalSynthOnly is added to the memory pushed.
content = re.sub(
    r'isBass: (true|false), mpeChannel: (.*?), mpeBasePitch: (.*?), mpeCurrentPitch: (.*?) \}',
    r'isBass: \1, mpeChannel: \2, mpeBasePitch: \3, mpeCurrentPitch: \4, isInternalSynthOnly: typeof suppressImmediatePlay !== "undefined" ? suppressImmediatePlay : false }',
    content
)

content = re.sub(
    r'isBass: false \}',
    r'isBass: false, isInternalSynthOnly: typeof suppressImmediatePlay !== "undefined" ? suppressImmediatePlay : false }',
    content
)

# 4. Arpeggiator short notes (staccato)
content = content.replace(
    'this.activeArpeggioNotes.set(pitch, { pitch, mpeChannel: channel });',
    '''this.activeArpeggioNotes.set(pitch, { pitch, mpeChannel: channel });
    
    // Auto-release arpeggio notes shortly after triggering (staccato pulse)
    setTimeout(() => {
      if (this.activeArpeggioNotes.has(pitch)) {
        this.handleArpeggioNoteOff(pitch);
      }
    }, 50);'''
)

# 5. Remove retriggering from inversion slider
content = content.replace(
    '''        this.params.chordInversion = newInversion;
        if (this.onParamsUpdate) this.onParamsUpdate({ ...this.params });
        this.retriggerHeldKeys(true, true);''',
    '''        this.params.chordInversion = newInversion;
        if (this.onParamsUpdate) this.onParamsUpdate({ ...this.params });'''
)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched Engine!")
