import re
content = open('src/App.tsx').read()

old_logic = """      engine.onOutputNote = (event: NoteEvent) => {
        if (isSynthEnabled) synth.handleNoteEvent(event);
        midiManager.sendNote(event.pitch, event.velocity, event.isOn, event.delayMs);
        
        // Delay UI update so it respects strumming visually
        if (event.delayMs && event.delayMs > 0) {
          setTimeout(() => {
            setActiveNotes(prev => event.isOn 
              ? (prev.includes(event.pitch) ? prev : [...prev, event.pitch]) 
              : prev.filter(p => p !== event.pitch));
          }, event.delayMs);
        } else {
          setActiveNotes(prev => event.isOn 
            ? (prev.includes(event.pitch) ? prev : [...prev, event.pitch]) 
            : prev.filter(p => p !== event.pitch));
        }
      };"""

new_logic = """      engine.onOutputNote = (event: NoteEvent) => {
        if (isSynthEnabled) synth.handleNoteEvent(event);
        
        if (event.isPitchBend) {
          midiManager.sendMpePitchBend(event.mpeChannel || 1, event.pitchBendValue || 0, params.mpeBendRange, event.delayMs);
        } else {
          midiManager.sendNote(event.pitch, event.velocity, event.isOn, event.delayMs, event.mpeChannel || 1);
          
          // Delay UI update so it respects strumming visually
          if (event.delayMs && event.delayMs > 0) {
            setTimeout(() => {
              setActiveNotes(prev => event.isOn 
                ? (prev.includes(event.pitch) ? prev : [...prev, event.pitch]) 
                : prev.filter(p => p !== event.pitch));
            }, event.delayMs);
          } else {
            setActiveNotes(prev => event.isOn 
              ? (prev.includes(event.pitch) ? prev : [...prev, event.pitch]) 
              : prev.filter(p => p !== event.pitch));
          }
        }
      };"""

content = content.replace(old_logic, new_logic)
open('src/App.tsx', 'w').write(content)
