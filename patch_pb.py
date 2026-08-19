import re

content = open('src/App.tsx').read()
old = """    midiManager.onPitchBend = (value, channel) => {
      addLog('PB', channel, value);
      // If it's channel 8, let's treat PitchBend as CC 126 (val 0-127) for our UI mapping
      // Pitch Bend is 14-bit (0-16383). Center is 8192.
      if (channel === 8) {
         const scaledVal = Math.round((value / 16383) * 127);
         setIncomingCC({ cc: 126, val: scaledVal, ch: channel, t: Date.now() });
      }
    };"""

new = """    midiManager.onPitchBend = (value, channel) => {
      addLog('PB', channel, value);
      if (channel === 8) {
         const scaledVal = Math.round((value / 16383) * 127);
         setIncomingCC({ cc: 126, val: scaledVal, ch: channel, t: Date.now() });
      } else {
         // Forward physical pitch bend to engine
         const semitones = ((value - 8192) / 8192) * paramsRef.current.mpeBendRange;
         if (newEngine) {
            newEngine.onOutputNote?.({ pitch: 0, velocity: 0, isOn: false, isPitchBend: true, pitchBendValue: semitones, mpeChannel: channel });
         }
      }
    };"""

content = content.replace(old, new)
open('src/App.tsx', 'w').write(content)
print("Patched Pitch Bend")
