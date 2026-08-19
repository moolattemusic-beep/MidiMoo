import json

with open('metadata.json') as f:
    data = json.load(f)
    
data['name'] = 'MidiMOO'

with open('metadata.json', 'w') as f:
    json.dump(data, f, indent=2)

print("metadata.json updated")
