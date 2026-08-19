import re
content = open('src/App.tsx').read()
content = content.replace("updateParam('memoryVelocity', vel)", "setParams(prev => ({ ...prev, memoryVelocity: vel }))")
content = content.replace("updateParam('mappingMode', 1)", "setParams(prev => ({ ...prev, mappingMode: 1 }))")
open('src/App.tsx', 'w').write(content)
