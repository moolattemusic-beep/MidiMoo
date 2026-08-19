import re
content = open('src/App.tsx').read()

old_state = """    ext_m7: false,
    ext_M7: false,
    ext_6: false,
    ext_9: false
  });"""
  
new_state = """    ext_m7: false,
    ext_M7: false,
    ext_6: false,
    ext_9: false,
    ext_alt: false
  });"""

content = content.replace(old_state, new_state)

old_mod = """              <ModifierPads 
                engine={engine}
                params={params}
                setParams={setParams}
                manualBaseType={engineState.manualBaseType}
                ext_m7={engineState.ext_m7}
                ext_M7={engineState.ext_M7}
                ext_6={engineState.ext_6}
                ext_9={engineState.ext_9}
              />"""

new_mod = """              <ModifierPads 
                engine={engine}
                params={params}
                setParams={setParams}
                manualBaseType={engineState.manualBaseType}
                ext_m7={engineState.ext_m7}
                ext_M7={engineState.ext_M7}
                ext_6={engineState.ext_6}
                ext_9={engineState.ext_9}
                ext_alt={engineState.ext_alt}
              />"""
              
content = content.replace(old_mod, new_mod)

open('src/App.tsx', 'w').write(content)
print("Patched App.tsx")
