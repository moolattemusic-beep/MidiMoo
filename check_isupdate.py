import re
content = open('src/lib/OrchidEngine.ts').read()

print("Occurrences of isUpdate:")
for i, line in enumerate(content.split('\n')):
    if 'isUpdate' in line:
        print(f"{i+1}: {line}")
