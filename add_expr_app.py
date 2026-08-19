import re

content = open('src/App.tsx').read()

old = """        if (event.isPitchBend) {
          midiManager.sendMpePitchBend(event.mpeChannel || 1, event.pitchBendValue || 0, params.mpeBendRange, event.delayMs);
        } else {"""

new = """        if (event.isPitchBend) {
          midiManager.sendMpePitchBend(event.mpeChannel || 1, event.pitchBendValue || 0, params.mpeBendRange, event.delayMs);
        } else if (event.isExpression) {
          midiManager.sendMpeExpression(event.mpeChannel || 1, event.expressionValue || 127, event.delayMs);
        } else {"""

content = content.replace(old, new)
open('src/App.tsx', 'w').write(content)
