import re
content = open('src/lib/OrchidEngine.ts').read()

old_code = """    // Base pitches are usually within a 1 or 2 octave range.
    // We want 4 octaves.
    const lowestPitch = Math.min(...basePitches);
    
    // Normalize basePitches to the lowest octave (starting at 0 for relative)
    const relativePitches = basePitches.map(p => p - lowestPitch).sort((a,b) => a-b);
    
    // Generate 4 octaves
    const result: number[] = [];
    const baseOctave = Math.floor(lowestPitch / 12) * 12; // Start from the nearest C below or equal
    const actualStart = lowestPitch;
    
    for (let oct = 0; oct < 4; oct++) {"""

new_code = """    // Base pitches are usually within a 1 or 2 octave range.
    const lowestPitch = Math.min(...basePitches);
    
    // Normalize basePitches to the lowest octave (starting at 0 for relative)
    const relativePitches = basePitches.map(p => p - lowestPitch).sort((a,b) => a-b);
    
    // Generate configured octaves
    const result: number[] = [];
    const baseOctave = Math.floor(lowestPitch / 12) * 12; // Start from the nearest C below or equal
    const actualStart = lowestPitch;
    const numOctaves = this.params.arpeggioOctaves || 4;
    
    for (let oct = 0; oct < numOctaves; oct++) {"""

if old_code in content:
    content = content.replace(old_code, new_code)
    open('src/lib/OrchidEngine.ts', 'w').write(content)
    print("Patched engine octaves")
else:
    print("Failed to patch engine octaves")
