import re
content = open('src/components/ArpeggioXYPad.tsx').read()

old_state = """  const [isDragging, setIsDragging] = useState(false);
  const [activePitch, setActivePitch] = useState<number | null>(null);
  
  // To avoid re-triggering the same note while dragging horizontally
  const activePitchRef = useRef<number | null>(null);
  
  // Track CC state internally for external MIDI
  const [nx, setNx] = useState(0.5);
  const [ny, setNy] = useState(0.5);"""

new_state = """  const [isDragging, setIsDragging] = useState(false);
  const [activePitch, setActivePitch] = useState<number | null>(null);
  
  // To avoid re-triggering the same note while dragging horizontally
  const activePitchRef = useRef<number | null>(null);
  
  // Track CC state internally for external MIDI
  const [nx, setNx] = useState(0.5);
  const [ny, setNy] = useState(0.5);
  const lastMidiTimeRef = useRef<number>(0);"""

if old_state in content:
    content = content.replace(old_state, new_state)

old_effect = """  useEffect(() => {
    if (incomingCC && incomingCC.ch === 8) {
      if (incomingCC.cc === 124) {
        const val = incomingCC.val / 127;
        setNx(val);
      } else if (incomingCC.cc === 125) {
        const val = 1 - (incomingCC.val / 127);
        setNy(val);
        // We only trigger 'move' when Y changes, as Y is the strumming axis
        handlePointerInternal(nx, val, 'move');
      }
    }
  }, [incomingCC]);"""

new_effect = """  useEffect(() => {
    if (incomingCC && incomingCC.ch === 8) {
      if (incomingCC.cc === 124) {
        const val = incomingCC.val / 127;
        setNx(val);
      } else if (incomingCC.cc === 125) {
        const val = 1 - (incomingCC.val / 127);
        setNy(val);
        
        const now = Date.now();
        if (now - lastMidiTimeRef.current > 200) {
           // It's been more than 200ms since the last Y movement, consider this a "jump" to a new location.
           // User explicitly requested NOT to play a sound just by changing location, only when swiping.
           handlePointerInternal(nx, val, 'midi_jump');
        } else {
           // Continuous rapid CC messages count as a swipe
           handlePointerInternal(nx, val, 'midi_move');
        }
        lastMidiTimeRef.current = now;
      } else if (incomingCC.cc === 123) {
        // Optional Z-axis mapped to CC 123 for discrete touch down/up
        if (incomingCC.val > 0) {
           handlePointerInternal(nx, ny, 'midi_jump'); // Register touch but don't play
        } else {
           handlePointerInternal(nx, ny, 'up'); // Release
        }
      }
    }
  }, [incomingCC]);"""

if old_effect in content:
    content = content.replace(old_effect, new_effect)

old_internal_def = "  const handlePointerInternal = (lx: number, ly: number, type: 'down' | 'move' | 'up') => {"
new_internal_def = "  const handlePointerInternal = (lx: number, ly: number, type: 'down' | 'move' | 'up' | 'midi_jump' | 'midi_move') => {"

if old_internal_def in content:
    content = content.replace(old_internal_def, new_internal_def)

old_down = """    if (type === 'down') {
       const maxVel = params.arpeggioMaxVelocity ?? 127;
       const velocity = Math.max(1, Math.min(maxVel, Math.round(xVal * maxVel)));
       engine.handleArpeggioNoteOn(targetPitch, velocity);
       activePitchRef.current = targetPitch;
       setActivePitch(targetPitch);
       (containerRef as any).lastIndex = safeIndex;
    } else if (type === 'move' && targetPitch !== activePitchRef.current) {"""

new_down = """    if (type === 'down') {
       const maxVel = params.arpeggioMaxVelocity ?? 127;
       const velocity = Math.max(1, Math.min(maxVel, Math.round(xVal * maxVel)));
       engine.handleArpeggioNoteOn(targetPitch, velocity);
       activePitchRef.current = targetPitch;
       setActivePitch(targetPitch);
       (containerRef as any).lastIndex = safeIndex;
    } else if (type === 'midi_jump') {
       // Clear old note if it was held
       if (activePitchRef.current !== null) {
          engine.handleArpeggioNoteOff(activePitchRef.current);
       }
       // Update cursor position silently without playing a note
       activePitchRef.current = targetPitch;
       setActivePitch(targetPitch);
       (containerRef as any).lastIndex = safeIndex;
    } else if ((type === 'move' || type === 'midi_move') && targetPitch !== activePitchRef.current) {"""

if old_down in content:
    content = content.replace(old_down, new_down)
    open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
    print("Patched handlePointerInternal for MIDI jump logic")
else:
    print("Failed to patch down logic")

