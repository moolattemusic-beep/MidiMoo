import re
content = open('src/components/ModifierPads.tsx').read()
old_arr = """        ] : [
          { id: 'm7', label: 'm7', hotkey: '[A]', active: ext_m7 },
          { id: 'M7', label: 'M7', hotkey: '[S]', active: ext_M7 },
          { id: '6', label: '6', hotkey: '[D]', active: ext_6 },
          { id: '9', label: '9', hotkey: '[F]', active: ext_9 }
        ])"""
new_arr = """        ] : [
          { id: 'M7', label: 'M7', hotkey: '[A]', active: ext_M7 },
          { id: 'm7', label: 'm7', hotkey: '[S]', active: ext_m7 },
          { id: '6', label: '6', hotkey: '[D]', active: ext_6 },
          { id: '9', label: '9', hotkey: '[F]', active: ext_9 }
        ])"""
content = content.replace(old_arr, new_arr)
open('src/components/ModifierPads.tsx', 'w').write(content)
print("Swapped M7 and m7")
