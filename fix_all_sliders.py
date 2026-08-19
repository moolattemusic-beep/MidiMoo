import re

mobile_content = open('src/components/MobileView.tsx').read()
mobile_content = "import { CustomSlider } from './CustomSlider';\n" + mobile_content
mobile_content = re.sub(
    r'<input\s+type="range"\s+min=\{0\}\s+max=\{16\}\s+step=\{1\}\s+value=\{params\.chordInversion\}\s+onChange=\{\(e\) => \{\s+const val = parseInt\(e\.target\.value\);\s+setParams\(\{\.\.\.params, chordInversion: val\}\);\s+if \(engine\) engine\.updateInversion\(val\);\s+\}\}\s+/>',
    r'<CustomSlider min={0} max={16} step={1} value={params.chordInversion} onChange={(val) => {\n                setParams({...params, chordInversion: val});\n                if (engine) engine.updateInversion(val);\n              }} />',
    mobile_content
)
mobile_content = re.sub(
    r'<input\s+type="range"\s+min=\{24\}\s+max=\{96\}\s+step=\{12\}\s+value=\{params\.chordRegisterStart\}\s+onChange=\{\(e\) => \{\s+const val = parseInt\(e\.target\.value\);\s+setParams\(\{\.\.\.params, chordRegisterStart: val\}\);\s+if \(engine\) engine\.updateRegister\(val\);\s+\}\}\s+/>',
    r'<CustomSlider min={24} max={96} step={12} value={params.chordRegisterStart} onChange={(val) => {\n                setParams({...params, chordRegisterStart: val});\n                if (engine) engine.updateRegister(val);\n              }} />',
    mobile_content
)
open('src/components/MobileView.tsx', 'w').write(mobile_content)

