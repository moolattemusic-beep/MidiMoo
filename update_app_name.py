import re

content = open('src/App.tsx').read()

content = content.replace('>Orchid Web<', '>MidiMOO<')
content = content.replace('>ORCHID WEB', '>MidiMOO')

open('src/App.tsx', 'w').write(content)
print("App.tsx updated")
