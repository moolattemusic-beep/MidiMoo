import re

content = open('src/components/VerticalSlider.tsx').read()

old_return = """  return (
    <div 
      ref={containerRef}
      className={`relative w-[8px] h-[150px] bg-[var(--surface-2)] rounded-[4px] cursor-pointer touch-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-[24px] h-[24px] bg-[var(--text-main)] rounded-full border-2 border-[var(--surface-1)] shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
        style={{ bottom: `calc(${percentage}% - 12px)` }}
      />
    </div>
  );"""

new_return = """  return (
    <div 
      ref={containerRef}
      className={`relative w-[40px] h-[150px] flex justify-center cursor-pointer touch-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Track */}
      <div className="w-[8px] h-full bg-[#111] border border-[#444] rounded-[4px]" />
      {/* Thumb */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-[36px] h-[24px] bg-[var(--accent)] border-2 border-white rounded-[2px] shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ bottom: `calc(${percentage}% - 12px)` }}
      />
    </div>
  );"""

content = content.replace(old_return, new_return)
open('src/components/VerticalSlider.tsx', 'w').write(content)

