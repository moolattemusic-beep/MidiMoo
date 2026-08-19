import re
content = open('src/components/ModifierPads.tsx').read()
content = re.sub(r'const isMomentaryBase = hideHeader \? false : isMomentaryBase;\n  const isMomentaryExt = hideHeader \? false : isMomentaryExt;\n\n  ', '', content)
open('src/components/ModifierPads.tsx', 'w').write(content)
