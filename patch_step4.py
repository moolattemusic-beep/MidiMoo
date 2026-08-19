import re

content = open('src/lib/OrchidEngine.ts').read()

old = "  public lastUpdateReason: 'chord' | 'inversion' | 'none' = 'none';\\n"
content = content.replace(old, "", 1)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Removed duplicate lastUpdateReason")
