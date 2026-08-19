import re
content = open('src/lib/OrchidEngine.ts').read()

content = content.replace(
    'public onStateChange?: () => void;',
    "public onStateChange?: () => void;\n  public lastUpdateReason: 'inversion' | 'chord' | 'none' = 'none';"
)
open('src/lib/OrchidEngine.ts', 'w').write(content)

