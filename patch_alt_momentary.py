import re
content = open('src/components/ModifierPads.tsx').read()

old_alt_btn = """          <button
            onPointerDown={(e) => { e.preventDefault(); engine.toggleExtension('alt' as any); }}
            className={`analog-btn !py-[2px] !px-2 ${ext_alt ? '!bg-[var(--accent)] !text-black' : ''}`}
          >
            ALT
          </button>"""

new_alt_btn = """          <button
            onPointerDown={(e) => { 
              e.preventDefault(); 
              if (isMomentaryExt) {
                if (!ext_alt) engine.toggleExtension('alt' as any);
              } else {
                engine.toggleExtension('alt' as any);
              }
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              if (isMomentaryExt && ext_alt) engine.toggleExtension('alt' as any);
            }}
            onPointerLeave={(e) => {
              e.preventDefault();
              if (isMomentaryExt && ext_alt) engine.toggleExtension('alt' as any);
            }}
            className={`analog-btn !py-[2px] !px-2 ${ext_alt ? '!bg-[var(--accent)] !text-black' : ''}`}
          >
            ALT
          </button>"""

if old_alt_btn in content:
    content = content.replace(old_alt_btn, new_alt_btn)
    open('src/components/ModifierPads.tsx', 'w').write(content)
    print("Patched alt button to respect momentary")
else:
    print("Failed to patch alt momentary")
