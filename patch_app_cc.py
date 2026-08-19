import re
content = open('src/App.tsx').read()

old_logic = """        if (event.isPitchBend) {
          midiManager.sendMpePitchBend(event.mpeChannel || 1, event.pitchBendValue || 0, params.mpeBendRange, event.delayMs);
        } else if (event.isExpression) {
          midiManager.sendMpeExpression(event.mpeChannel || 1, event.expressionValue || 127, event.delayMs);
        } else {
          midiManager.sendNote(event.pitch, event.velocity, event.isOn, event.delayMs, event.mpeChannel || 1);"""

new_logic = """        if (event.isPitchBend) {
          midiManager.sendMpePitchBend(event.mpeChannel || 1, event.pitchBendValue || 0, params.mpeBendRange, event.delayMs);
        } else if (event.isExpression) {
          midiManager.sendMpeExpression(event.mpeChannel || 1, event.expressionValue || 127, event.delayMs);
        } else if (event.isCC) {
          midiManager.sendControlChange(event.ccNumber!, event.ccValue!, event.delayMs || 0, event.mpeChannel || 1);
        } else {
          midiManager.sendNote(event.pitch, event.velocity, event.isOn, event.delayMs, event.mpeChannel || 1);"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    open('src/App.tsx', 'w').write(content)
    print("Patched App.tsx for CC")
else:
    print("Failed to patch App.tsx for CC")
