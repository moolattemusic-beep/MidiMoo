import re

content = open('src/types.ts').read()

old = """  isPitchBend?: boolean;
  pitchBendValue?: number; // -48 to 48 semitones, engine will convert
}"""

new = """  isPitchBend?: boolean;
  pitchBendValue?: number; // -48 to 48 semitones, engine will convert
  isExpression?: boolean;
  expressionValue?: number; // 0 to 127
}"""

content = content.replace(old, new)
open('src/types.ts', 'w').write(content)

