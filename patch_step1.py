import re

content = open('src/lib/OrchidEngine.ts').read()

prop_hook = "  public ext_alt: boolean = false;"
if prop_hook in content and "public baseTypeLatched" not in content:
    content = content.replace(prop_hook, prop_hook + """
  public baseTypeLatched: boolean = false;
  public latchedExtensions: Set<string> = new Set();
  public lastPitchClasses: number[] = [];
  public lastUpdateReason: 'chord' | 'inversion' | 'none' = 'none';
""")
    
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Step 1 done")
