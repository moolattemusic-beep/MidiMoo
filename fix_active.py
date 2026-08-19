content = open('src/components/ModifierPads.tsx').read()
content = content.replace(
    "  const isDominant = ext_alt && manualBaseType === 3;",
    "  const activeBaseType = effectiveBaseType ?? manualBaseType;\n  const isDominant = ext_alt && activeBaseType === 3;"
)
open('src/components/ModifierPads.tsx', 'w').write(content)
print("Fixed activeBaseType")
