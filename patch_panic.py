import re
content = open('src/lib/OrchidEngine.ts').read()

old_panic = """    this.sustainPedalActive = false;
    this.strumplatePitches = [];
    this.notifyState();"""

new_panic = """    this.sustainPedalActive = false;
    this.strumplatePitches = [];
    this.activeArpeggioNotes.clear();
    this.notifyState();"""

if old_panic in content:
    content = content.replace(old_panic, new_panic)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched panic")
else:
    print("Failed to patch panic")
