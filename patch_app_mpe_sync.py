import re
content = open('src/App.tsx').read()

mpe_sync = """  useEffect(() => {
    if (params.mpeEnabled && selectedOutput) {
      midiManager.setMpeBendRange(params.mpeBendRange);
    }
  }, [params.mpeEnabled, params.mpeBendRange, selectedOutput, midiManager]);

  useEffect(() => {"""

content = content.replace("  useEffect(() => {\n    if (engine) {", mpe_sync + "\n    if (engine) {")
open('src/App.tsx', 'w').write(content)
print("Patched App.tsx")
