import re
content = open('src/components/ModifierPads.tsx').read()

# Introduce local overrides at the top of the render body
content = content.replace(
    'const updateParam = (key: keyof OrchidParams, value: any) => {',
    '''const isMomentaryBase = hideHeader ? False : params.momentaryBase;
  const isMomentaryExt = hideHeader ? False : params.momentaryExt;

  const updateParam = (key: keyof OrchidParams, value: any) => {'''.replace('False', 'false')
)

# Replace usage of params.momentaryBase (except in toggles and updates)
# We can do this carefully using regex
content = re.sub(r'if \(params\.momentaryBase\)', 'if (isMomentaryBase)', content)
content = re.sub(r'if \(!params\.momentaryBase\)', 'if (!isMomentaryBase)', content)
content = re.sub(r'params\.momentaryBase &&', 'isMomentaryBase &&', content)
content = re.sub(r'\[engine, params\.momentaryBase, params\.momentaryExt\]', '[engine, isMomentaryBase, isMomentaryExt]', content)

content = re.sub(r'if \(params\.momentaryExt\)', 'if (isMomentaryExt)', content)
content = re.sub(r'if \(!params\.momentaryExt\)', 'if (!isMomentaryExt)', content)
content = re.sub(r'params\.momentaryExt &&', 'isMomentaryExt &&', content)

open('src/components/ModifierPads.tsx', 'w').write(content)
