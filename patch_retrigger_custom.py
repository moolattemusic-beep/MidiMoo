import re
content = open('src/lib/OrchidEngine.ts').read()

# Add a map for held custom voicings
content = content.replace("public heldKeys: Map<number, number> = new Map();", "public heldKeys: Map<number, number> = new Map();\n  public heldCustomVoicings: Map<number, number[]> = new Map();")

# In retriggerHeldKeys
old_ret = """  public retriggerHeldKeys(skipBass: boolean = false, forcePlay: boolean = false) {
    const keysToRetrigger = Array.from(this.heldKeys.entries());
    
    for (const [pitch, velocity] of keysToRetrigger) {
      if (pitch <= 127) {
         this.handleMidi(pitch, velocity, true, skipBass, true, forcePlay);
      }
    }
  }"""
new_ret = """  public retriggerHeldKeys(skipBass: boolean = false, forcePlay: boolean = false) {
    const keysToRetrigger = Array.from(this.heldKeys.entries());
    
    for (const [pitch, velocity] of keysToRetrigger) {
      if (pitch <= 127) {
         const cv = this.heldCustomVoicings.get(pitch);
         this.handleMidi(pitch, velocity, true, skipBass, true, forcePlay, false, cv);
      }
    }
  }"""
content = content.replace(old_ret, new_ret)

# In handleMidi, store it when isOn and delete when !isOn
handle_midi_on = """    // Note On (Performance Key)
    this.heldKeys.set(pitch, velocity);"""
handle_midi_on_new = """    // Note On (Performance Key)
    this.heldKeys.set(pitch, velocity);
    if (customVoicing) this.heldCustomVoicings.set(pitch, customVoicing);
    else this.heldCustomVoicings.delete(pitch);"""
content = content.replace(handle_midi_on, handle_midi_on_new)

handle_midi_off = """      // Note Off
      if (!isControlKey) {
        this.heldKeys.delete(pitch);"""
handle_midi_off_new = """      // Note Off
      if (!isControlKey) {
        this.heldKeys.delete(pitch);
        this.heldCustomVoicings.delete(pitch);"""
content = content.replace(handle_midi_off, handle_midi_off_new)

# In reset(), clear it
content = content.replace("this.heldKeys.clear();", "this.heldKeys.clear();\n    this.heldCustomVoicings.clear();")

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched retrigger for custom voicings")
