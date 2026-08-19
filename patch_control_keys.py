import re
content = open('src/lib/OrchidEngine.ts').read()

old_ctrl = """    const controlLowBound = 24 + (this.params.controlOctave * 12);
    const controlHighBound = controlLowBound + 11;
    const isControlKey = pitch >= controlLowBound && pitch <= controlHighBound;"""

new_ctrl = """    const controlLowBound = 24 + (this.params.controlOctave * 12);
    const controlHighBound = controlLowBound + 11;
    let isControlKey = pitch >= controlLowBound && pitch <= controlHighBound;
    
    // In Free Mode, the whole keyboard is performance keys
    if (this.params.keyboardMapping === 0) {
      isControlKey = false;
    }"""

content = content.replace(old_ctrl, new_ctrl)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched Control Keys for Free Mode")
