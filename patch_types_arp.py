import re
content = open('src/types.ts').read()

old_params = """  arpeggioOctaves: number;
  arpeggioMaxVelocity: number;
}"""

new_params = """  arpeggioOctaves: number;
  arpeggioMaxVelocity: number;
  arpeggioRegisterStart: number;
}"""

if old_params in content:
    content = content.replace(old_params, new_params)

old_default = """  arpeggioOctaves: 4,
  arpeggioMaxVelocity: 127,
};"""

new_default = """  arpeggioOctaves: 4,
  arpeggioMaxVelocity: 127,
  arpeggioRegisterStart: 48,
};"""

if old_default in content:
    content = content.replace(old_default, new_default)

open('src/types.ts', 'w').write(content)
print("Patched types")
