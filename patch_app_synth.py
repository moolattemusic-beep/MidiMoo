import re

content = open('src/App.tsx').read()

# 1. Update onOutputNote
on_output_note_old = """      engine.onOutputNote = (event: NoteEvent) => {
        if (isSynthEnabled) synth.handleNoteEvent(event);
        
        midiManager.sendNoteEvent(event);"""
on_output_note_new = """      engine.onOutputNote = (event: NoteEvent) => {
        if (isSynthEnabled) synth.handleNoteEvent(event);
        if (!event.isInternalSynthOnly) {
          midiManager.sendNoteEvent(event);
        }"""
content = content.replace(on_output_note_old, on_output_note_new)

# 2. Add Synth Volume Slider
synth_ui_old = """          <span className="label-meta ml-4">SYNTH</span>
          <div 
            className={`toggle-switch ${isSynthEnabled ? 'on' : ''}`}
            onClick={handleEnableAudio}
          ></div>"""
synth_ui_new = """          <div className="flex items-center gap-2 ml-4">
            <span className="label-meta">SYNTH VOL</span>
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              defaultValue="0.3" 
              onChange={(e) => synth.setVolume(parseFloat(e.target.value))}
              className="w-16 accent-[var(--accent)]"
            />
          </div>
          <span className="label-meta ml-4">SYNTH ON/OFF</span>
          <div 
            className={`toggle-switch ${isSynthEnabled ? 'on' : ''}`}
            onClick={handleEnableAudio}
          ></div>"""
content = content.replace(synth_ui_old, synth_ui_new)

open('src/App.tsx', 'w').write(content)
print("Patched App.tsx")
