import re

content = open('src/components/CustomSlider.tsx').read()

old_return = """  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-[4px] bg-[var(--surface-2)] rounded-[2px] cursor-pointer touch-none mt-[10px] ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div 
        className="absolute top-1/2 -translate-y-1/2 w-[24px] h-[24px] bg-[var(--text-main)] rounded-full border-2 border-[var(--surface-1)] shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
        style={{ left: `calc(${percentage}% - 12px)` }}
      />
    </div>
  );"""

new_return = """  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-[40px] flex items-center cursor-pointer touch-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Track */}
      <div className="w-full h-[8px] bg-[#111] border border-[#444] rounded-[4px]" />
      {/* Thumb */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 w-[24px] h-[36px] bg-[var(--accent)] border-2 border-white rounded-[2px] shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ left: `calc(${percentage}% - 12px)` }}
      />
    </div>
  );"""

content = content.replace(old_return, new_return)
open('src/components/CustomSlider.tsx', 'w').write(content)

