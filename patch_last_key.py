import re
content = open('src/lib/OrchidEngine.ts').read()

old_last_strum = "  private lastStrumIndex: number = -1;"
new_last_strum = """  private lastStrumIndex: number = -1;
  public lastPerformanceKey: number = 60;
  
  // Track active arpeggio notes for sustain pedal handling
  public activeArpeggioNotes: Map<number, { pitch: number, mpeChannel?: number }> = new Map();
"""

if old_last_strum in content:
    content = content.replace(old_last_strum, new_last_strum)
    print("Patched last_strum")
else:
    print("Failed to patch last_strum")

old_handle = """  public handleMidi(pitch: number, velocity: number, isOn: boolean, skipBass: boolean = false, isUpdate: boolean = false, forcePlay: boolean = false) {
    const controlLowBound = 24 + (this.params.controlOctave * 12);
    const controlHighBound = controlLowBound + 11;
    const isControlKey = pitch >= controlLowBound && pitch <= controlHighBound;"""

new_handle = """  public handleMidi(pitch: number, velocity: number, isOn: boolean, skipBass: boolean = false, isUpdate: boolean = false, forcePlay: boolean = false) {
    const controlLowBound = 24 + (this.params.controlOctave * 12);
    const controlHighBound = controlLowBound + 11;
    const isControlKey = pitch >= controlLowBound && pitch <= controlHighBound;
    
    if (isOn && velocity > 0 && !isUpdate && !isControlKey) {
       this.lastPerformanceKey = pitch;
    }"""

if old_handle in content:
    content = content.replace(old_handle, new_handle)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched handle")
else:
    print("Failed to patch handle")

