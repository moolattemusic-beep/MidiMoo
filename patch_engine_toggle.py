import re
content = open('src/lib/OrchidEngine.ts').read()

old_toggle = """  public toggleExtension(ext: 'm7' | 'M7' | '6' | '9') {
    if (ext === 'm7') {
      this.ext_m7 = !this.ext_m7;
      if (this.ext_m7) this.ext_M7 = false;
    }
    if (ext === 'M7') {
      this.ext_M7 = !this.ext_M7;
      if (this.ext_M7) this.ext_m7 = false;
    }
    if (ext === '6') this.ext_6 = !this.ext_6;
    if (ext === '9') this.ext_9 = !this.ext_9;
    this.notifyState();
    this.retriggerHeldKeys();
  }"""

new_toggle = """  public toggleExtension(ext: 'm7' | 'M7' | '6' | '9' | 'alt') {
    if (ext === 'm7') {
      this.ext_m7 = !this.ext_m7;
      if (this.ext_m7) this.ext_M7 = false;
    }
    if (ext === 'M7') {
      this.ext_M7 = !this.ext_M7;
      if (this.ext_M7) this.ext_m7 = false;
    }
    if (ext === '6') this.ext_6 = !this.ext_6;
    if (ext === '9') this.ext_9 = !this.ext_9;
    if (ext === 'alt') this.ext_alt = !this.ext_alt;
    this.notifyState();
    this.retriggerHeldKeys();
  }"""

if old_toggle in content:
    content = content.replace(old_toggle, new_toggle)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched toggleExtension")
else:
    print("Failed to patch toggleExtension")
