import re
content = open('src/components/MobileView.tsx').read()

old_mod = """          <ModifierPads 
            engine={engine}
            params={params}
            setParams={setParams}
            manualBaseType={engineState.manualBaseType}
            ext_m7={engineState.ext_m7}
            ext_M7={engineState.ext_M7}
            ext_6={engineState.ext_6}
            ext_9={engineState.ext_9}
            hideOctaveSlider={true}
            hideHeader={true}
          />"""

new_mod = """          <ModifierPads 
            engine={engine}
            params={params}
            setParams={setParams}
            manualBaseType={engineState.manualBaseType}
            ext_m7={engineState.ext_m7}
            ext_M7={engineState.ext_M7}
            ext_6={engineState.ext_6}
            ext_9={engineState.ext_9}
            ext_alt={engineState.ext_alt}
            hideOctaveSlider={true}
            hideHeader={true}
          />"""
          
content = content.replace(old_mod, new_mod)

open('src/components/MobileView.tsx', 'w').write(content)
print("Patched MobileView.tsx")
