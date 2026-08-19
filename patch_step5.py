content = open('src/lib/OrchidEngine.ts').read()
content = content.replace("  public lastUpdateReason: 'chord' | 'inversion' | 'none' = 'none';", "", 1)
open('src/lib/OrchidEngine.ts', 'w').write(content)
print("Removed")
