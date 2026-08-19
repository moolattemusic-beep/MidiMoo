import re

mobile_content = open('src/components/MobileView.tsx').read()
mobile_content = re.sub(
    r'<input\n\s+type="range"\n\s+min=\{0\}\n\s+max=\{16\}\n\s+step=\{1\}\n\s+value=\{params\.chordInversion\}\n\s+onChange=\{\(e\) => \{\n\s+const val = parseInt\(e\.target\.value\);\n\s+setParams\(\{\.\.\.params, chordInversion: val\}\);\n\s+if \(engine\) engine\.updateInversion\(val\);\n\s+\}\}\n\s+className="flex-1 touch-none"\n\s+/>',
    r'<CustomSlider className="flex-1" min={0} max={16} step={1} value={params.chordInversion} onChange={(val) => {\n                setParams({...params, chordInversion: val});\n                if (engine) engine.updateInversion(val);\n              }} />',
    mobile_content
)
open('src/components/MobileView.tsx', 'w').write(mobile_content)
