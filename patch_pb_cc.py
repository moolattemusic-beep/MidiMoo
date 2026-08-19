import re
content = open('src/components/ArpeggioXYPad.tsx').read()

old_pb_def = "function MagneticPitchBend({ engine }: { engine: OrchidEngine | null }) {"
new_pb_def = "function MagneticPitchBend({ engine, incomingCC }: { engine: OrchidEngine | null, incomingCC?: {cc: number, val: number, ch: number, t: number} | null }) {"

if old_pb_def in content:
    content = content.replace(old_pb_def, new_pb_def)
    
old_pb_jsx = "<MagneticPitchBend engine={engine} />"
new_pb_jsx = "<MagneticPitchBend engine={engine} incomingCC={incomingCC} />"

if old_pb_jsx in content:
    content = content.replace(old_pb_jsx, new_pb_jsx)

old_pb_state = """  const containerRef = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(64);"""
  
new_pb_state = """  const containerRef = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(64);
  
  useEffect(() => {
    if (incomingCC && incomingCC.ch === 8 && incomingCC.cc === 126) {
       setVal(incomingCC.val);
    }
  }, [incomingCC]);"""
  
if old_pb_state in content:
    content = content.replace(old_pb_state, new_pb_state)

open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
print("Patched MagneticPitchBend CC")
