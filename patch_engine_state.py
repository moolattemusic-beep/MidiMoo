import re
content = open('src/lib/OrchidEngine.ts').read()

state_old = "  public lastPerformanceKey: number = 60;"
state_new = "  public lastPerformanceKey: number = 60;\n  private lastTriggeredChordKey: number = -1;\n  private consecutiveChordCount: number = 0;\n  private alternateStrumState: number = 0;"
content = content.replace(state_old, state_new)

calc_old = "private calculateFoldedPitches(rootPitch: number, intervals: number[]): number[] {"
calc_new = "private calculateFoldedPitches(rootPitch: number, intervals: number[], extraInversions: number = 0): number[] {"
content = content.replace(calc_old, calc_new)

inv_old = "const inv = this.params.chordInversion;"
inv_new = "const inv = this.params.chordInversion + extraInversions;"
content = content.replace(inv_old, inv_new)

open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Patched state and calc signature")
