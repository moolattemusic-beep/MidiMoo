import re
content = open('src/components/ModifierPads.tsx').read()

old_destruct = """  ext_m7,
  ext_M7,
  ext_6,
  ext_9,
  hideOctaveSlider,
  hideHeader
}) => {"""

new_destruct = """  ext_m7,
  ext_M7,
  ext_6,
  ext_9,
  ext_alt,
  hideOctaveSlider,
  hideHeader
}) => {"""

if old_destruct in content:
    content = content.replace(old_destruct, new_destruct)
    open('src/components/ModifierPads.tsx', 'w').write(content)
    print("Fixed destruct")
else:
    print("Failed to fix destruct")

