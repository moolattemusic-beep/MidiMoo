import re
content = open('src/lib/OrchidEngine.ts').read()
content = content.replace(
    'if (this.params.mpeEnabled && channel) {',
    'if (this.params.mpeEnabled && channel && !this.params.omnichordMode) {'
)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched bend")
