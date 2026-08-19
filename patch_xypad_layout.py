import re
content = open('src/components/ArpeggioXYPad.tsx').read()

old_jsx = """      <div className="w-full flex gap-4 mb-4">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px]">OCTAVES</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px]">{params.arpeggioOctaves ?? 4}</span>
          </div>
          <CustomSlider 
            min={1} max={6} step={1} 
            value={params.arpeggioOctaves ?? 4} 
            onChange={(v) => {
              const newParams = { ...params, arpeggioOctaves: v };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }} 
          />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px]">MAX VELOCITY</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px]">{params.arpeggioMaxVelocity ?? 127}</span>
          </div>
          <CustomSlider 
            min={10} max={127} step={1} 
            value={params.arpeggioMaxVelocity ?? 127} 
            onChange={(v) => {
              const newParams = { ...params, arpeggioMaxVelocity: v };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }} 
          />
        </div>
      </div>
      
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-[240px] bg-[#12120f] border-[8px] border-[var(--surface)] rounded-md relative shadow-[inset_0_0_20px_#000] touch-none overflow-hidden group"
      >"""

new_jsx = """      <div className="w-full flex gap-4 mb-4">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px]">LOWEST NOTE</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px]">{
              (() => {
                const p = params.arpeggioRegisterStart ?? 48;
                const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                return `${names[p % 12]}${Math.floor(p / 12) - 1}`;
              })()
            }</span>
          </div>
          <CustomSlider 
            min={24} max={84} step={1} 
            value={params.arpeggioRegisterStart ?? 48} 
            onChange={(v) => {
              const newParams = { ...params, arpeggioRegisterStart: v };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }} 
          />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px]">OCTAVES</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px]">{params.arpeggioOctaves ?? 4}</span>
          </div>
          <CustomSlider 
            min={1} max={6} step={1} 
            value={params.arpeggioOctaves ?? 4} 
            onChange={(v) => {
              const newParams = { ...params, arpeggioOctaves: v };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }} 
          />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px]">MAX VEL</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px]">{params.arpeggioMaxVelocity ?? 127}</span>
          </div>
          <CustomSlider 
            min={10} max={127} step={1} 
            value={params.arpeggioMaxVelocity ?? 127} 
            onChange={(v) => {
              const newParams = { ...params, arpeggioMaxVelocity: v };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }} 
          />
        </div>
      </div>
      
      <div className="flex gap-4 w-full h-[240px]">
        {/* Global Pitch Bend Strip */}
        <MagneticPitchBend engine={engine} />
        
        {/* XY Pad */}
        <div 
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="flex-1 h-full bg-[#12120f] border-[8px] border-[var(--surface)] rounded-md relative shadow-[inset_0_0_20px_#000] touch-none overflow-hidden group"
        >"""

if old_jsx in content:
    content = content.replace(old_jsx, new_jsx)

# Need to append MagneticPitchBend at the end
pb_strip = """

function MagneticPitchBend({ engine }: { engine: OrchidEngine | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(64);
  
  const handlePointer = (clientX: number, clientY: number, type: 'down' | 'move' | 'up') => {
    if (!containerRef.current || !engine) return;
    
    if (type === 'up') {
      setVal(64);
      engine.emitControlChange(126, 64, 8);
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    let ny = (clientY - rect.top) / rect.height;
    ny = Math.max(0, Math.min(1, ny));
    
    const midiVal = Math.round((1 - ny) * 127);
    setVal(midiVal);
    engine.emitControlChange(126, midiVal, 8);
  };

  return (
    <div 
      ref={containerRef}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        handlePointer(e.clientX, e.clientY, 'down');
      }}
      onPointerMove={(e) => {
        if (e.buttons > 0) handlePointer(e.clientX, e.clientY, 'move');
      }}
      onPointerUp={(e) => {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        handlePointer(e.clientX, e.clientY, 'up');
      }}
      onPointerCancel={(e) => {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        handlePointer(e.clientX, e.clientY, 'up');
      }}
      className="w-12 shrink-0 h-full bg-[#12120f] border-[6px] border-[var(--surface)] rounded-md relative touch-none shadow-[inset_0_0_10px_#000]"
    >
      <div className="absolute top-2 left-0 right-0 label-meta text-white/50 text-[9px] text-center pointer-events-none">PB</div>
      
      <div className="absolute left-0 right-0 bg-[var(--accent)] transition-all duration-75 pointer-events-none" style={{
        bottom: '50%',
        height: val >= 64 ? `${((val - 64) / 63) * 50}%` : '0%'
      }} />
      <div className="absolute left-0 right-0 bg-[var(--accent)] top-[50%] transition-all duration-75 pointer-events-none" style={{
        height: val < 64 ? `${((64 - val) / 64) * 50}%` : '0%'
      }} />
      
      <div className="absolute top-[50%] left-0 right-0 h-[2px] bg-white -mt-[1px] shadow-[0_0_5px_rgba(255,255,255,0.5)] pointer-events-none" />
    </div>
  );
}
"""

if "function MagneticPitchBend" not in content:
    content = content.replace("</div>\n    </div>\n  );\n}", "</div>\n    </div>\n  );\n}" + pb_strip)
    
# also replace the closing tags in the original to match the new wrapper
old_closing = """        )}
      </div>
    </div>
  );
}"""

new_closing = """        )}
      </div>
      </div>
    </div>
  );
}"""

if old_closing in content:
    content = content.replace(old_closing, new_closing)
    open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
    print("Patched XY pad layout")
else:
    print("Failed to patch XY pad layout")

