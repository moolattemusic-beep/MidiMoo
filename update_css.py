import re
content = open('src/index.css').read()
content = content.replace('user-select: none;', 'user-select: none;\n  -webkit-touch-callout: none;')
open('src/index.css', 'w').write(content)
