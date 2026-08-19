import re

content = open('src/lib/OrchidEngine.ts').read()

old_ext = """  public toggleExtension(ext: 'm7' | 'M7' | '6' | '9' | 'alt') {
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

new_ext = """  public toggleExtension(ext: 'm7' | 'M7' | '6' | '9' | 'alt') {
    if (ext === 'm7') {
      this.setExtension('m7', !this.ext_m7);
    } else if (ext === 'M7') {
      this.setExtension('M7', !this.ext_M7);
    } else if (ext === '6') {
      this.setExtension('6', !this.ext_6);
    } else if (ext === '9') {
      this.setExtension('9', !this.ext_9);
    } else if (ext === 'alt') {
      this.setExtension('alt', !this.ext_alt);
    }
  }

  public setExtension(ext: 'm7' | 'M7' | '6' | '9' | 'alt', active: boolean) {
    if (ext === 'm7') {
      this.ext_m7 = active;
      if (active) this.ext_M7 = false;
    } else if (ext === 'M7') {
      this.ext_M7 = active;
      if (active) this.ext_m7 = false;
    } else if (ext === '6') this.ext_6 = active;
    else if (ext === '9') this.ext_9 = active;
    else if (ext === 'alt') this.ext_alt = active;

    this.latchedExtensions.delete(ext);
    this.lastUpdateReason = 'chord';
    this.notifyState();
    this.retriggerHeldKeys();
  }

  public releaseExtension(ext: 'm7' | 'M7' | '6' | '9' | 'alt') {
    const isExtActive = this[`ext_${ext}` as keyof this] as boolean;
    if (!isExtActive) return;
    
    if (this.heldKeys.size > 0) {
      this.latchedExtensions.add(ext);
    } else {
      if (ext === 'm7') this.ext_m7 = false;
      else if (ext === 'M7') this.ext_M7 = false;
      else if (ext === '6') this.ext_6 = false;
      else if (ext === '9') this.ext_9 = false;
      else if (ext === 'alt') this.ext_alt = false;
      
      this.latchedExtensions.delete(ext);
      this.lastUpdateReason = 'chord';
      this.notifyState();
      this.retriggerHeldKeys();
    }
  }"""

if old_ext in content:
    content = content.replace(old_ext, new_ext)
    print("Replaced extensions")
else:
    print("Extensions not found")
    
open('src/lib/OrchidEngine.ts', 'w').write(content)
