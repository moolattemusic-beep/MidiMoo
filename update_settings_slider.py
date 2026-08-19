import re

content = open('src/components/SettingsPanel.tsx').read()
content = "import { CustomSlider } from './CustomSlider';\n" + content

content = content.replace('''<input
              type="range"''', '''<CustomSlider''')
content = content.replace('''<input
                type="range"''', '''<CustomSlider''')
content = content.replace('''onChange={(e) => updateParam('chordRegisterStart', parseInt(e.target.value))}
            />''', '''onChange={(val) => updateParam('chordRegisterStart', val)}
            />''')
content = content.replace('''onChange={(e) => updateParam('chordInversion', parseInt(e.target.value))}
            />''', '''onChange={(val) => updateParam('chordInversion', val)}
            />''')
content = content.replace('''onChange={(e) => updateParam('chordDensity', parseInt(e.target.value))}
            />''', '''onChange={(val) => updateParam('chordDensity', val)}
            />''')
content = content.replace('''onChange={(e) => updateParam('voicingRange', parseInt(e.target.value))}
            />''', '''onChange={(val) => updateParam('voicingRange', val)}
            />''')
content = content.replace('''onChange={(e) => updateParam('mpeGlideTimeMs', parseInt(e.target.value))}
            />''', '''onChange={(val) => updateParam('mpeGlideTimeMs', val)}
            />''')
content = content.replace('''onChange={(e) => updateParam('strumSpeedMs', parseInt(e.target.value))}
            />''', '''onChange={(val) => updateParam('strumSpeedMs', val)}
            />''')
content = content.replace('''onChange={(e) => updateParam('strumDirection', parseInt(e.target.value))}
            />''', '''onChange={(val) => updateParam('strumDirection', val)}
            />''')

open('src/components/SettingsPanel.tsx', 'w').write(content)
