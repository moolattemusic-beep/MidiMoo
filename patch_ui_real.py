import re

# Patch ModifierPads.tsx
mod_content = open('src/components/ModifierPads.tsx').read()

old_props = """  manualBaseType: number;
  ext_m7: boolean;
  ext_M7: boolean;
  ext_6: boolean;
  ext_9: boolean;
  ext_alt: boolean;"""
new_props = """  manualBaseType: number;
  effectiveBaseType?: number;
  ext_m7: boolean;
  ext_M7: boolean;
  ext_6: boolean;
  ext_9: boolean;
  ext_alt: boolean;"""
mod_content = mod_content.replace(old_props, new_props)

old_args = """  manualBaseType,
  ext_m7,"""
new_args = """  manualBaseType,
  effectiveBaseType,
  ext_m7,"""
mod_content = mod_content.replace(old_args, new_args)

old_active = """  const isMomentaryBase = params.momentaryBase ?? true;
  const isMomentaryExt = params.momentaryExt ?? true;"""
new_active = """  const isMomentaryBase = params.momentaryBase ?? true;
  const isMomentaryExt = params.momentaryExt ?? true;
  const activeBaseType = effectiveBaseType ?? manualBaseType;"""
mod_content = mod_content.replace(old_active, new_active)

open('src/components/ModifierPads.tsx', 'w').write(mod_content)
print("Patched ModifierPads.tsx correctly")

# Patch App.tsx to pass effectiveBaseType to ModifierPads (twice: one normal, one mobile)
app_content = open('src/App.tsx').read()
app_content = app_content.replace(
    "manualBaseType={engineState.manualBaseType}",
    "manualBaseType={engineState.manualBaseType}\\n                effectiveBaseType={engineState.effectiveBaseType}"
)
open('src/App.tsx', 'w').write(app_content)

# Patch MobileView.tsx to pass effectiveBaseType to ModifierPads
mob_content = open('src/components/MobileView.tsx').read()
mob_content = mob_content.replace(
    "manualBaseType={engineState.manualBaseType}",
    "manualBaseType={engineState.manualBaseType}\\n            effectiveBaseType={engineState.effectiveBaseType}"
)
open('src/components/MobileView.tsx', 'w').write(mob_content)

