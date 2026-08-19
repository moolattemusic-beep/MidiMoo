import re
content = open('src/components/ArpeggioXYPad.tsx').read()

old_xy_render = """        <div className="absolute top-2 left-2 label-meta pointer-events-none text-white/50 text-[10px]">VELOCITY →</div>
        <div className="absolute bottom-2 left-2 label-meta pointer-events-none text-white/50 text-[10px]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>PITCH ↑</div>

        {activePitch !== null && ("""

new_xy_render = """        <div className="absolute top-2 left-2 label-meta pointer-events-none text-white/50 text-[10px]">VELOCITY →</div>
        <div className="absolute bottom-2 left-2 label-meta pointer-events-none text-white/50 text-[10px]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>PITCH ↑</div>
        
        {/* XY Visual Indicator */}
        <div 
          className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-[var(--accent)] pointer-events-none shadow-[0_0_10px_var(--accent)] transition-all duration-75" 
          style={{ 
            left: `${nx * 100}%`, 
            top: `${(1 - ny) * 100}%`,
            opacity: isDragging || activePitch !== null ? 1 : 0.4
          }} 
        />

        {activePitch !== null && ("""

if old_xy_render in content:
    content = content.replace(old_xy_render, new_xy_render)
    open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
    print("Patched XY pad visual")
else:
    print("Failed to patch XY pad visual")
