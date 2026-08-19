import re
content = open('src/App.tsx').read()

old_state = """    ext_6: false,
    ext_9: false,
  });"""
  
new_state = """    ext_6: false,
    ext_9: false,
    ext_alt: false,
  });"""

if old_state in content:
    content = content.replace(old_state, new_state)
    open('src/App.tsx', 'w').write(content)
    print("Patched init state")
else:
    print("Failed to patch init state")
