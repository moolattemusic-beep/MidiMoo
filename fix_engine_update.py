import re
content = open('src/lib/OrchidEngine.ts').read()

replacement = """  private retriggerHeldKeys(isUpdate: boolean = false) {
    const keysToRetrigger = Array.from(this.heldKeys.entries());
    for (const [pitch, velocity] of keysToRetrigger) {
      this.handleMidi(pitch, velocity, true, false, isUpdate);
    }
  }"""

content = re.sub(r'private retriggerHeldKeys\(isUpdate: boolean = false\) \{.*?  \}', replacement, content, flags=re.DOTALL)

open('src/lib/OrchidEngine.ts', 'w').write(content)
