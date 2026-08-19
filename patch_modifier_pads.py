import re

content = open('src/components/ModifierPads.tsx').read()

# Add callbacks to props interface
interface_old = """  hideOctaveSlider?: boolean;
  hideHeader?: boolean;
}"""
interface_new = """  hideOctaveSlider?: boolean;
  hideHeader?: boolean;
  onBaseTypeChange?: (val: number) => void;
  onExtensionToggle?: (extId: string) => void;
}"""
content = content.replace(interface_old, interface_new)

# Add callbacks to component destructuring
destruct_old = """  hideOctaveSlider,
  hideHeader
}) => {"""
destruct_new = """  hideOctaveSlider,
  hideHeader,
  onBaseTypeChange,
  onExtensionToggle
}) => {"""
content = content.replace(destruct_old, destruct_new)

# Modify base type click
base_click_old = """              onPointerDown={(e) => {
                e.preventDefault();
                if (isMomentaryBase) {
                  engine.setBaseType(type.val);
                } else {
                  engine.setBaseType(isActive ? -1 : type.val);
                }
              }}"""
base_click_new = """              onPointerDown={(e) => {
                e.preventDefault();
                if (onBaseTypeChange) {
                   onBaseTypeChange(type.val);
                   return;
                }
                if (isMomentaryBase) {
                  engine.setBaseType(type.val);
                } else {
                  engine.setBaseType(isActive ? -1 : type.val);
                }
              }}"""
content = content.replace(base_click_old, base_click_new)

# Modify extension click
ext_click_old = """            onPointerDown={(e) => {
              e.preventDefault();
              const momentary = isDominant ? false : isMomentaryExt;
              if (momentary) {
                if (!ext.active) engine.toggleExtension(ext.id as any);
              } else {
                engine.toggleExtension(ext.id as any);
              }
            }}"""
ext_click_new = """            onPointerDown={(e) => {
              e.preventDefault();
              if (onExtensionToggle) {
                 onExtensionToggle(ext.id);
                 return;
              }
              const momentary = isDominant ? false : isMomentaryExt;
              if (momentary) {
                if (!ext.active) engine.toggleExtension(ext.id as any);
              } else {
                engine.toggleExtension(ext.id as any);
              }
            }}"""
content = content.replace(ext_click_old, ext_click_new)

open('src/components/ModifierPads.tsx', 'w').write(content)
print("Patched ModifierPads")
