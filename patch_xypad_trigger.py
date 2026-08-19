import re
content = open('src/components/ArpeggioXYPad.tsx').read()

old_move = """    } else if (type === 'move' && targetPitch !== activePitchRef.current) {
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
    }"""

new_move = """    } else if (type === 'move' && targetPitch !== activePitchRef.current) {
       const maxVel = params.arpeggioMaxVelocity ?? 127;
       const velocity = Math.max(1, Math.min(maxVel, Math.round(xVal * maxVel)));
       
       // If no note was previously active, treat this first movement as a down trigger
       if (activePitchRef.current === null) {
           engine.handleArpeggioNoteOn(targetPitch, velocity);
           activePitchRef.current = targetPitch;
           setActivePitch(targetPitch);
           (containerRef as any).lastIndex = safeIndex;
       } else {
           const lastIndex = (containerRef as any).lastIndex ?? safeIndex;
           const minIdx = Math.min(lastIndex, safeIndex);
           const maxIdx = Math.max(lastIndex, safeIndex);
           
           engine.handleArpeggioNoteOff(activePitchRef.current);
           
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
    }"""

if old_move in content:
    content = content.replace(old_move, new_move)
    open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
    print("Patched handlePointerInternal move logic")
else:
    print("Failed to patch move logic")
