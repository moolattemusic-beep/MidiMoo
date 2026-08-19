import re
content = open('src/types.ts').read()
content = content.replace("strumDirection: number; // 0=Up, 1=Down", "strumDirection: number; // 0=Up, 1=Down, 2=Random\n  strumAlternate: boolean;\n  inversionRepeat: number; // 0 to 8")
content = content.replace("strumDirection: 0,", "strumDirection: 0,\n  strumAlternate: false,\n  inversionRepeat: 0,")
open('src/types.ts', 'w').write(content)
