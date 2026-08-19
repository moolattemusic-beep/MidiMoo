import re
content = open('src/lib/OrchidEngine.ts').read()

# Fix 1: remove || this.params.alwaysAdd7th in currentEffectiveBaseType
old_eff = "} else if (this.ext_M7 || this.ext_6 || this.ext_9 || this.params.alwaysAdd7th) {"
new_eff = "} else if (this.ext_M7 || this.ext_6 || this.ext_9) {"
content = content.replace(old_eff, new_eff)

# Fix 2: remove && !this.params.alwaysAdd7th in getIntervalsForState
old_int = "if (!this.ext_m7 && !this.ext_M7 && !this.ext_6 && !this.ext_9 && !this.params.alwaysAdd7th) {"
new_int = "if (!this.ext_m7 && !this.ext_M7 && !this.ext_6 && !this.ext_9) {"
content = content.replace(old_int, new_int)

# Fix 3: restrict always7 boolean to mapping 2 (Key Mode)
old_always = "const always7 = this.params.alwaysAdd7th;"
new_always = "const always7 = this.params.alwaysAdd7th && this.params.keyboardMapping === 2;"
content = content.replace(old_always, new_always)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched alwaysAdd7th logic")
