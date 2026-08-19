import re

content = open('src/types.ts').read()

new_props = """  velHumanize: number;
  velHighRegisterPad: number;
  velGlideInversion: number;
  velGlideChord: number;
"""

new_defaults = """  velHumanize: 10,
  velHighRegisterPad: 20,
  velGlideInversion: 10,
  velGlideChord: 10,
"""

content = content.replace("  omnichordMode: boolean;\n}", "  omnichordMode: boolean;\n" + new_props + "}")
content = content.replace("  omnichordMode: false,\n};", "  omnichordMode: false,\n" + new_defaults + "};")

open('src/types.ts', 'w').write(content)

