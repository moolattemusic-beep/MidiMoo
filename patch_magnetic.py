import re
content = open('src/components/ArpeggioXYPad.tsx').read()

old_use_effect = """  useEffect(() => {
    if (incomingCC && incomingCC.ch === 8 && incomingCC.cc === 126) {
       setVal(incomingCC.val);
    }
  }, [incomingCC]);"""

new_use_effect = """  useEffect(() => {
    if (incomingCC && incomingCC.ch === 8 && incomingCC.cc === 126) {
       setVal(incomingCC.val);
       if (engine && engine.onOutputNote) {
         // PB semitones based on OrchidEngine MPE Bend Range, but we'll use a hardcoded 4 for this strip's visual mapping
         const normalized = (incomingCC.val - 64) / 64; // -1 to 1
         engine.onOutputNote({
           pitch: 0, velocity: 0, isOn: false, isPitchBend: true,
           pitchBendValue: normalized * 4, mpeChannel: 8
         });
       }
    }
  }, [incomingCC, engine]);"""

if old_use_effect in content:
    content = content.replace(old_use_effect, new_use_effect)

open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
