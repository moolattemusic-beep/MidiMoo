import re
content = open('src/lib/OrchidEngine.ts').read()

old_strum = """    let currentDir = this.params.strumDirection;
    if (this.params.strumAlternate) {
       currentDir = this.alternateStrumState;
    } else if (currentDir === 2) {
       currentDir = Math.random() < 0.5 ? 0 : 1;
    }

    if (currentDir === 1) { // Down
      finalPitches.sort((a, b) => b - a);
    } else { // Up
      finalPitches.sort((a, b) => a - b);
    }
    
    if (this.params.strumDirection === 2 && !this.params.strumAlternate) {
       // Random shuffle
       for (let i = finalPitches.length - 1; i > 0; i--) {
           const j = Math.floor(Math.random() * (i + 1));
           [finalPitches[i], finalPitches[j]] = [finalPitches[j], finalPitches[i]];
       }
    }"""

new_strum = """    let currentDir = this.params.strumDirection;
    if (this.params.strumAlternate) {
       // Randomly pick UP (0), DOWN (1), or RANDOM (2)
       currentDir = Math.floor(Math.random() * 3);
    }

    if (currentDir === 1) { // Down
      finalPitches.sort((a, b) => b - a);
    } else if (currentDir === 0) { // Up
      finalPitches.sort((a, b) => a - b);
    } else if (currentDir === 2) { // Random
      // First sort up to ensure determinism before shuffle
      finalPitches.sort((a, b) => a - b);
      // Random shuffle
      for (let i = finalPitches.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalPitches[i], finalPitches[j]] = [finalPitches[j], finalPitches[i]];
      }
    }"""
content = content.replace(old_strum, new_strum)
open('src/lib/OrchidEngine.ts', 'w').write(content)
