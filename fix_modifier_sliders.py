import re

content = open('src/components/ModifierPads.tsx').read()
content = "import { CustomSlider } from './CustomSlider';\n" + content
content = re.sub(
    r'<input\n\s+type="range"\n\s+min=\{0\}\n\s+max=\{8\}\n\s+step=\{1\}\n\s+value=\{params\.controlOctave\}\n\s+onChange=\{\(e\) => updateParam\(\'controlOctave\', parseInt\(e\.target\.value\)\)\}\n\s+/>',
    r'<CustomSlider min={0} max={8} step={1} value={params.controlOctave} onChange={(val) => updateParam(\'controlOctave\', val)} />',
    content
)
open('src/components/ModifierPads.tsx', 'w').write(content)
