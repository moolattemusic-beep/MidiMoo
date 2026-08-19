import re
content = open('src/components/ArpeggioXYPad.tsx').read()

old_refs = """  const [nx, setNx] = useState(0.5);
  const [ny, setNy] = useState(0.5);
  const lastMidiTimeRef = useRef<number>(0);"""

new_refs = """  const [nx, setNx] = useState(0.5);
  const [ny, setNy] = useState(0.5);
  const lastMidiTimeRef = useRef<number>(0);
  const jumpOriginYRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);"""

if old_refs in content:
    content = content.replace(old_refs, new_refs)

old_jump = """    } else if (type === 'midi_jump') {
       // Clear old note if it was held
       if (activePitchRef.current !== null) {
          engine.handleArpeggioNoteOff(activePitchRef.current);
       }
       // Update cursor position silently without playing a note
       activePitchRef.current = targetPitch;
       setActivePitch(targetPitch);
       (containerRef as any).lastIndex = safeIndex;
    } else if ((type === 'move' || type === 'midi_move') && targetPitch !== activePitchRef.current) {"""

new_jump = """    } else if (type === 'midi_jump') {
       // Clear old note if it was held
       if (activePitchRef.current !== null) {
          engine.handleArpeggioNoteOff(activePitchRef.current);
       }
       // Update cursor position silently without playing a note
       activePitchRef.current = targetPitch;
       setActivePitch(targetPitch);
       (containerRef as any).lastIndex = safeIndex;
       
       jumpOriginYRef.current = ly;
       isSwipingRef.current = false;
    } else if ((type === 'move' || type === 'midi_move') && targetPitch !== activePitchRef.current) {
       if (type === 'midi_move' && !isSwipingRef.current) {
          if (Math.abs(ly - jumpOriginYRef.current) > 0.03) {
             isSwipingRef.current = true;
          } else {
             // Still just jittering around the jump origin, update cursor but stay silent
             activePitchRef.current = targetPitch;
             setActivePitch(targetPitch);
             (containerRef as any).lastIndex = safeIndex;
             return;
          }
       }
"""

if old_jump in content:
    content = content.replace(old_jump, new_jump)
    open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
    print("Patched XY Pad swipe threshold")
else:
    print("Failed to patch XY Pad swipe")
