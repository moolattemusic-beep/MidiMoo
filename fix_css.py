import re
content = open('src/index.css').read()

body_replacement = """body {
  background-color: var(--bg);
  color: var(--ink);
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-user-select: none;
  user-select: none;
}"""
content = re.sub(r'body\s*\{[^\}]+\}', body_replacement, content)

module_replacement = """.module {
  background: var(--surface);
  border: var(--panel-border);
  padding: 1.25rem;
  position: relative;
  box-shadow: 4px 4px 0 rgba(0,0,0,0.3);
  touch-action: none;
}"""
content = re.sub(r'\.module\s*\{[^\}]+\}', module_replacement, content)

open('src/index.css', 'w').write(content)
