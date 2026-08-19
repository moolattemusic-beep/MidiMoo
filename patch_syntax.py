import re
content = open('src/components/ModifierPads.tsx').read()

old_bug = "case 'f': if (engine.ext_9,\n  hideOctaveSlider) engine.toggleExtension('9'); break;"
new_bug = "case 'f': if (engine.ext_9) engine.toggleExtension('9'); break;"

if old_bug in content:
    content = content.replace(old_bug, new_bug)
    open('src/components/ModifierPads.tsx', 'w').write(content)
    print("Fixed syntax bug")
else:
    print("Failed to fix syntax bug")
