import re
content = open('src/App.tsx').read()
content = content.replace("const pitches = Array.from(armedRecordedPitches.current);", "const pitches = Array.from(armedRecordedPitches.current) as number[];")
open('src/App.tsx', 'w').write(content)
