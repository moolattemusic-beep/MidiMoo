import re
content = open('src/App.tsx').read()

# Add onPanic to MobileView rendering in App.tsx
old_mob_render = """          onUpdateSlots={setMemorySlots}
          lastPlayedChord={lastPlayedChord}
        />"""
        
new_mob_render = """          onUpdateSlots={setMemorySlots}
          lastPlayedChord={lastPlayedChord}
          onPanic={() => {
            if (engine) engine.panic();
            synth.panic();
            midiManager.panic();
          }}
        />"""
        
content = content.replace(old_mob_render, new_mob_render)
open('src/App.tsx', 'w').write(content)

content_mob = open('src/components/MobileView.tsx').read()
old_interface = """  onUpdateSlots: (slots: MemorySlot[]) => void;
  lastPlayedChord: MemorySlot | null;
}"""

new_interface = """  onUpdateSlots: (slots: MemorySlot[]) => void;
  lastPlayedChord: MemorySlot | null;
  onPanic?: () => void;
}"""

content_mob = content_mob.replace(old_interface, new_interface)

old_args = """  onUpdateSlots,
  lastPlayedChord
}: MobileViewProps) {"""

new_args = """  onUpdateSlots,
  lastPlayedChord,
  onPanic
}: MobileViewProps) {"""

content_mob = content_mob.replace(old_args, new_args)

old_header = """      <div className="flex justify-between items-center p-2 bg-[var(--wood)] border-b-2 border-black shrink-0">
        <span className="font-bold tracking-widest uppercase text-black text-sm">MOBILE PERFORMANCE</span>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-black text-[var(--accent)] border border-black rounded-sm">
          X
        </button>
      </div>"""

new_header = """      <div className="flex justify-between items-center p-2 bg-[var(--wood)] border-b-2 border-black shrink-0">
        <span className="font-bold tracking-widest uppercase text-black text-sm">MOBILE PERFORMANCE</span>
        <div className="flex items-center gap-2">
          {onPanic && (
            <button 
              onClick={onPanic}
              className="px-2 h-8 flex items-center justify-center bg-red-900/80 text-red-100 border border-red-500 rounded-sm text-xs font-bold"
            >
              PANIC
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-black text-[var(--accent)] border border-black rounded-sm">
            X
          </button>
        </div>
      </div>"""

content_mob = content_mob.replace(old_header, new_header)
open('src/components/MobileView.tsx', 'w').write(content_mob)

