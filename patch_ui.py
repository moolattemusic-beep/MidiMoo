import re

# Patch App.tsx
app_content = open('src/App.tsx').read()
old_set_state = """    const updateEngineState = () => {
      setEngineState({
        manualBaseType: engine.manualBaseType,"""
new_set_state = """    const updateEngineState = () => {
      setEngineState({
        manualBaseType: engine.manualBaseType,
        effectiveBaseType: engine.currentEffectiveBaseType,"""
app_content = app_content.replace(old_set_state, new_set_state)
open('src/App.tsx', 'w').write(app_content)
print("Patched App.tsx")


# Patch ModifierPads.tsx
mod_content = open('src/components/ModifierPads.tsx').read()

old_manual = "  const manualBaseType = engineState.manualBaseType;"
new_manual = """  const manualBaseType = engineState.manualBaseType;
  const activeBaseType = engineState.effectiveBaseType ?? engineState.manualBaseType;"""
mod_content = mod_content.replace(old_manual, new_manual)

old_border = "border-[var(--accent)] shadow-[0_0_15px_rgba(240,160,32,0.2)]"
new_border = "border-[var(--accent)] shadow-[0_0_15px_rgba(240,160,32,0.2)]"

old_isactive = "const isActive = manualBaseType === type.val;"
new_isactive = "const isActive = activeBaseType === type.val;"
mod_content = mod_content.replace(old_isactive, new_isactive)

old_keyup_base = """          case 'q': if (engine.manualBaseType === 0) engine.setBaseType(-1); break;
          case 'w': if (engine.manualBaseType === 1) engine.setBaseType(-1); break;
          case 'e': if (engine.manualBaseType === 2) engine.setBaseType(-1); break;
          case 'r': if (engine.manualBaseType === 3) engine.setBaseType(-1); break;"""
new_keyup_base = """          case 'q': engine.releaseBaseType(0); break;
          case 'w': engine.releaseBaseType(1); break;
          case 'e': engine.releaseBaseType(2); break;
          case 'r': engine.releaseBaseType(3); break;"""
mod_content = mod_content.replace(old_keyup_base, new_keyup_base)

old_keyup_ext = """          case 'a': if (engine.ext_m7) engine.toggleExtension('m7'); break;
          case 's': if (engine.ext_M7) engine.toggleExtension('M7'); break;
          case 'd': if (engine.ext_6) engine.toggleExtension('6'); break;
          case 'f': if (engine.ext_9) engine.toggleExtension('9'); break;"""
new_keyup_ext = """          case 'a': engine.releaseExtension('m7'); break;
          case 's': engine.releaseExtension('M7'); break;
          case 'd': engine.releaseExtension('6'); break;
          case 'f': engine.releaseExtension('9'); break;"""
mod_content = mod_content.replace(old_keyup_ext, new_keyup_ext)

old_onpointerup_base = """              onPointerUp={(e) => {
                e.preventDefault();
                if (isMomentaryBase && engine.manualBaseType === type.val) engine.setBaseType(-1);
              }}
              onPointerLeave={(e) => {
                e.preventDefault();
                if (isMomentaryBase && engine.manualBaseType === type.val) engine.setBaseType(-1);
              }}"""
new_onpointerup_base = """              onPointerUp={(e) => {
                e.preventDefault();
                if (isMomentaryBase) engine.releaseBaseType(type.val);
              }}
              onPointerLeave={(e) => {
                e.preventDefault();
                if (isMomentaryBase) engine.releaseBaseType(type.val);
              }}"""
mod_content = mod_content.replace(old_onpointerup_base, new_onpointerup_base)

old_onpointerup_ext = """              onPointerUp={(e) => {
                e.preventDefault();
                const momentary = isDominant ? false : isMomentaryExt;
                if (momentary && ext.active) engine.toggleExtension(ext.id as any);
              }}
              onPointerLeave={(e) => {
                e.preventDefault();
                const momentary = isDominant ? false : isMomentaryExt;
                if (momentary && ext.active) engine.toggleExtension(ext.id as any);
              }}"""
new_onpointerup_ext = """              onPointerUp={(e) => {
                e.preventDefault();
                const momentary = isDominant ? false : isMomentaryExt;
                if (momentary && ext.active) engine.releaseExtension(ext.id as any);
              }}
              onPointerLeave={(e) => {
                e.preventDefault();
                const momentary = isDominant ? false : isMomentaryExt;
                if (momentary && ext.active) engine.releaseExtension(ext.id as any);
              }}"""
mod_content = mod_content.replace(old_onpointerup_ext, new_onpointerup_ext)


open('src/components/ModifierPads.tsx', 'w').write(mod_content)
print("Patched ModifierPads.tsx")
