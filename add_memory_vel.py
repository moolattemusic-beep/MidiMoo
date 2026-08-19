import re
content = open('src/types.ts').read()
content = content.replace(
    'arpeggioRegisterStart: number;',
    'arpeggioRegisterStart: number;\n  memoryVelocity: number;'
)
content = content.replace(
    'arpeggioRegisterStart: 48',
    'arpeggioRegisterStart: 48,\n  memoryVelocity: 100'
)
open('src/types.ts', 'w').write(content)
