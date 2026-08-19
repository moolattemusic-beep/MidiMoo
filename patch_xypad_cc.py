import re
content = open('src/components/ArpeggioXYPad.tsx').read()

old_props = """interface ArpeggioXYPadProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
}

export function ArpeggioXYPad({ engine, params, setParams }: ArpeggioXYPadProps) {"""

new_props = """interface ArpeggioXYPadProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  incomingCC?: {cc: number, val: number, ch: number, t: number} | null;
}

export function ArpeggioXYPad({ engine, params, setParams, incomingCC }: ArpeggioXYPadProps) {"""

if old_props in content:
    content = content.replace(old_props, new_props)

old_state = """  const [isDragging, setIsDragging] = useState(false);
  const [activePitch, setActivePitch] = useState<number | null>(null);
  
  // To avoid re-triggering the same note while dragging horizontally
  const activePitchRef = useRef<number | null>(null);"""

new_state = """  const [isDragging, setIsDragging] = useState(false);
  const [activePitch, setActivePitch] = useState<number | null>(null);
  
  // To avoid re-triggering the same note while dragging horizontally
  const activePitchRef = useRef<number | null>(null);
  
  // Track CC state internally for external MIDI
  const [nx, setNx] = useState(0.5);
  const [ny, setNy] = useState(0.5);
  
  useEffect(() => {
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

if old_state in content:
    content = content.replace(old_state, new_state)

old_handler = """  const handlePointer = (clientX: number, clientY: number, type: 'down' | 'move' | 'up') => {
    if (!engine || !containerRef.current) return;
    
    if (type === 'up') {
      setIsDragging(false);"""

new_handler = """  const handlePointerInternal = (lx: number, ly: number, type: 'down' | 'move' | 'up') => {
    if (!engine) return;
    
    if (type === 'up') {
      setIsDragging(false);
      if (activePitchRef.current !== null) {
         engine.handleArpeggioNoteOff(activePitchRef.current);
      }
      activePitchRef.current = null;
      setActivePitch(null);
      return;
    }
    
    const yVal = ly;
    const xVal = lx;
    
    engine.emitControlChange(124, Math.round(xVal * 127), 8);
    engine.emitControlChange(125, Math.round((1 - yVal) * 127), 8);
    
    const pitches = engine.getArpeggioPitches();
    if (pitches.length === 0) return;
    
    const index = Math.floor(yVal * pitches.length);
    const safeIndex = Math.min(pitches.length - 1, Math.max(0, index));
    const targetPitch = pitches[safeIndex];
    
    if (type === 'down') {
       const maxVel = params.arpeggioMaxVelocity ?? 127;
       const velocity = Math.max(1, Math.min(maxVel, Math.round(xVal * maxVel)));
       engine.handleArpeggioNoteOn(targetPitch, velocity);
       activePitchRef.current = targetPitch;
       setActivePitch(targetPitch);
       (containerRef as any).lastIndex = safeIndex;
    } else if (type === 'move' && targetPitch !== activePitchRef.current) {
       const maxVel = params.arpeggioMaxVelocity ?? 127;
       const velocity = Math.max(1, Math.min(maxVel, Math.round(xVal * maxVel)));
       const lastIndex = (containerRef as any).lastIndex ?? safeIndex;
       
       const minIdx = Math.min(lastIndex, safeIndex);
       const maxIdx = Math.max(lastIndex, safeIndex);
       
       if (activePitchRef.current !== null) {
          engine.handleArpeggioNoteOff(activePitchRef.current);
       }
       
       for (let i = minIdx; i <= maxIdx; i++) {
         if (i !== lastIndex) {
            engine.handleArpeggioNoteOn(pitches[i], velocity);
            if (i !== safeIndex) {
               engine.handleArpeggioNoteOff(pitches[i]);
            }
         }
       }
       
       activePitchRef.current = targetPitch;
       setActivePitch(targetPitch);
       (containerRef as any).lastIndex = safeIndex;
    }
  };

  const handlePointer = (clientX: number, clientY: number, type: 'down' | 'move' | 'up') => {
    if (!engine || !containerRef.current) return;
    
    if (type === 'up') {
      setIsDragging(false);
      handlePointerInternal(nx, ny, 'up');
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    let lnx = (clientX - rect.left) / rect.width;
    let lny = (clientY - rect.top) / rect.height;
    
    lnx = Math.max(0, Math.min(1, lnx));
    lny = Math.max(0, Math.min(1, lny));
    
    setNx(lnx);
    setNy(1 - lny);
    
    handlePointerInternal(lnx, 1 - lny, type);
  };"""

if old_handler in content:
    # Need to remove the rest of old_handler
    rest_pattern = re.compile(r"    const yVal = 1 - ny;.*?\} else if \(type === 'move' && targetPitch !== activePitchRef\.current\) \{.*?\}", re.DOTALL)
    # Actually wait, let's just replace the whole function.
    pass

# Using a simpler replace
full_old_handler = re.search(r"(  const handlePointer = \(clientX: number.*?\n  };\n)", content, re.DOTALL).group(1)
if full_old_handler:
    content = content.replace(full_old_handler, new_handler)
    print("Patched handler")

open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
print("Finished ArpeggioXYPad patch")
