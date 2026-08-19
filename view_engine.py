import re
content = open('src/lib/OrchidEngine.ts').read()
# find emitNoteOn
match = re.search(r'emitNoteOn.*?\{.*?\}', content, re.DOTALL)
if match:
    print(match.group(0))

print("\n\n--- updateInversion ---\n")
match = re.search(r'updateInversion.*?\}', content, re.DOTALL)
if match:
    print(match.group(0))
    
