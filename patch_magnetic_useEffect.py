import re
content = open('src/components/ArpeggioXYPad.tsx').read()

old_eff = """  useEffect(() => {
    if (incomingCC && incomingCC.ch === 8 && incomingCC.cc === 126) {
       setVal(incomingCC.val);
       if (engine) {
          engine.emitControlChange(126, incomingCC.val, 8);
       }
    }
  }, [incomingCC, engine]);"""

new_eff = """  useEffect(() => {
    if (incomingCC && incomingCC.ch === 8 && incomingCC.cc === 126) {
       setVal(incomingCC.val);
       if (engine) {
          engine.emitControlChange(126, incomingCC.val, 8);
          if (engine.onOutputNote) {
             engine.onOutputNote({
               pitch: 0, velocity: 0, isOn: false, isPitchBend: true,
               pitchBendValue: ((incomingCC.val - 64) / 64) * 2, mpeChannel: 8
             });
          }
       }
    }
  }, [incomingCC, engine]);"""

if old_eff in content:
    content = content.replace(old_eff, new_eff)
    open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
    print("Patched MagneticPitchBend CC propagation")
else:
    print("Failed to patch")
