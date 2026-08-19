import re
content = open('src/lib/OrchidEngine.ts').read()

old_midi = """    if (isOn) {
      if (!isControlKey) {
        if (!this.heldKeys.has(pitch)) {
          this.heldKeys.set(pitch, true);"""

new_midi = """    if (isOn) {
      if (!isControlKey) {
        if (!this.heldKeys.has(pitch)) {
          this.lastUpdateReason = 'chord';
          this.heldKeys.set(pitch, true);"""

content = content.replace(old_midi, new_midi)
open('src/lib/OrchidEngine.ts', 'w').write(content)

