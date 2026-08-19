import re
content = open('src/lib/OrchidEngine.ts').read()

# Let's inspect the Note On section
match = re.search(r'    // Regular Performance Key\n    const mappedRoot = this\.getMappedRootPitch\(pitch\);', content)
if match:
    print("Found Note On section")
