import re
content = open('src/App.tsx').read()
content = content.replace('const newEngine = new OrchidEngine(defaultParams);', 'const newEngine = new OrchidEngine(params);')
open('src/App.tsx', 'w').write(content)
