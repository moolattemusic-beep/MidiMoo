import re

content = open('src/lib/OrchidEngine.ts').read()

old_cc = """        // Flush all physically released keys
        for (const pitch of this.physicallyReleasedKeys) {
          if (this.activePitchesMemory[pitch]) {"""

new_cc = """        // Flush all physically released keys
        for (const pitch of this.physicallyReleasedKeys) {
          this.heldKeys.delete(pitch);
          if (this.activePitchesMemory[pitch]) {"""

content = content.replace(old_cc, new_cc)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched CC 64 Sustain Release Cleanup")
