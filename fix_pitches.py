import re
content = open('src/App.tsx').read()
content = content.replace("pitches[0] % 12", "(pitches[0] || 0) % 12")
open('src/App.tsx', 'w').write(content)
