import re
content = open('src/components/ModifierPads.tsx').read()

old_base_types = """  const baseTypes = [
    { label: 'MAJOR', hotkey: '[Q]', val: 0 },
    { label: 'MINOR', hotkey: '[W]', val: 1 },
    { label: 'DIM', hotkey: '[E]', val: 2 },
    { label: 'AUG', hotkey: '[R]', val: 3 }
  ];"""

new_base_types = """  const baseTypes = [
    { label: 'MAJOR', hotkey: '[Q]', val: 0 },
    { label: 'MINOR', hotkey: '[W]', val: 1 },
    { label: 'SUS', hotkey: '[E]', val: 2 },
    { label: ext_alt ? 'DOM' : 'DIM', hotkey: '[R]', val: 3 }
  ];
  
  const isDominant = ext_alt && manualBaseType === 3;"""

if old_base_types in content:
    content = content.replace(old_base_types, new_base_types)
    print("Patched base types")

old_alt_btn = """          <button
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

new_alt_btn = """          <button
            onPointerDown={(e) => { 
              e.preventDefault(); 
              engine.toggleExtension('alt' as any);
            }}
            className={`analog-btn !py-[2px] !px-2 ${ext_alt ? '!bg-[var(--accent)] !text-black' : ''}`}
          >
            ALT
          </button>"""

if old_alt_btn in content:
    content = content.replace(old_alt_btn, new_alt_btn)
    print("Patched alt button")

old_exts = """        {[
          { id: 'm7', label: ext_alt ? 'b9' : 'm7', hotkey: '[A]', active: ext_m7 },
          { id: 'M7', label: ext_alt ? '#9' : 'M7', hotkey: '[S]', active: ext_M7 },
          { id: '6', label: ext_alt ? 'b13' : '6', hotkey: '[D]', active: ext_6 },
          { id: '9', label: ext_alt ? '#13' : '9', hotkey: '[F]', active: ext_9 }
        ].map((ext) => ("""

new_exts = """        {(isDominant ? [
          { id: 'm7', label: 'b9', hotkey: '[A]', active: ext_m7 },
          { id: 'M7', label: '#9', hotkey: '[S]', active: ext_M7 },
          { id: '6', label: 'b13', hotkey: '[D]', active: ext_6 },
          { id: '9', label: '#13', hotkey: '[F]', active: ext_9 }
        ] : [
          { id: 'm7', label: 'm7', hotkey: '[A]', active: ext_m7 },
          { id: 'M7', label: 'M7', hotkey: '[S]', active: ext_M7 },
          { id: '6', label: '6', hotkey: '[D]', active: ext_6 },
          { id: '9', label: '9', hotkey: '[F]', active: ext_9 }
        ]).map((ext) => ("""

if old_exts in content:
    content = content.replace(old_exts, new_exts)
    print("Patched extensions logic")

old_ext_events = """            onPointerDown={(e) => {
              e.preventDefault();
              if (isMomentaryExt) {
                if (!ext.active) engine.toggleExtension(ext.id as any);
              } else {
                engine.toggleExtension(ext.id as any);
              }
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              if (isMomentaryExt && ext.active) engine.toggleExtension(ext.id as any);
            }}
            onPointerLeave={(e) => {
              e.preventDefault();
              if (isMomentaryExt && ext.active) engine.toggleExtension(ext.id as any);
            }}"""

new_ext_events = """            onPointerDown={(e) => {
              e.preventDefault();
              const momentary = isDominant ? false : isMomentaryExt;
              if (momentary) {
                if (!ext.active) engine.toggleExtension(ext.id as any);
              } else {
                engine.toggleExtension(ext.id as any);
              }
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              const momentary = isDominant ? false : isMomentaryExt;
              if (momentary && ext.active) engine.toggleExtension(ext.id as any);
            }}
            onPointerLeave={(e) => {
              e.preventDefault();
              const momentary = isDominant ? false : isMomentaryExt;
              if (momentary && ext.active) engine.toggleExtension(ext.id as any);
            }}"""

if old_ext_events in content:
    content = content.replace(old_ext_events, new_ext_events)
    print("Patched extensions momentary override")

open('src/components/ModifierPads.tsx', 'w').write(content)
