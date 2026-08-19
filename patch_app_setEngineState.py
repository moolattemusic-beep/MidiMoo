import re
content = open('src/App.tsx').read()

old_set = """      setEngineState({
        manualBaseType: newEngine.manualBaseType,
        ext_m7: newEngine.ext_m7,
        ext_M7: newEngine.ext_M7,
        ext_6: newEngine.ext_6,
        ext_9: newEngine.ext_9,
      });"""
      
new_set = """      setEngineState({
        manualBaseType: newEngine.manualBaseType,
        ext_m7: newEngine.ext_m7,
        ext_M7: newEngine.ext_M7,
        ext_6: newEngine.ext_6,
        ext_9: newEngine.ext_9,
        ext_alt: newEngine.ext_alt,
      });"""

if old_set in content:
    content = content.replace(old_set, new_set)
    open('src/App.tsx', 'w').write(content)
    print("Patched setEngineState")
else:
    print("Failed to patch setEngineState")
