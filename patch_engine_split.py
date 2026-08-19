import re

content = open('src/lib/OrchidEngine.ts').read()

content = content.replace(
    'const suppressImmediatePlay = this.params.omnichordMode && !forcePlay;',
    'const suppressImmediatePlay = this.params.omnichordMode && this.params.omnichordSynthMonitor && !forcePlay;'
)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched split toggle")
