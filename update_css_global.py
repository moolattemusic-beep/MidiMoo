import re
content = open('src/index.css').read()
global_select = """* {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

input, textarea {
  -webkit-user-select: auto;
  user-select: auto;
}
"""
if '* {' not in content:
    content = content.replace('body {', global_select + '\nbody {')
open('src/index.css', 'w').write(content)
