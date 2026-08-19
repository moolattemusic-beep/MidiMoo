import re
content = open('src/App.tsx').read()

app_old1 = """              if (slot.customVoicing && slot.customVoicing.length > 0) {
                 newEngine.handleCustomVoicing(slot.customVoicing, vel, true, slotIndex);
              } else {
                 newEngine.manualBaseType = slot.baseType;
                 newEngine.ext_m7 = slot.ext_m7;
                 newEngine.ext_M7 = slot.ext_M7;
                 newEngine.ext_6 = slot.ext_6;
                 newEngine.ext_9 = slot.ext_9;
                 newEngine.notifyState();
                 newEngine.handleMidi(slot.rootPitch, vel, true, false, false, false, true);
              }"""

app_new1 = """              newEngine.manualBaseType = slot.baseType;
              newEngine.ext_m7 = slot.ext_m7;
              newEngine.ext_M7 = slot.ext_M7;
              newEngine.ext_6 = slot.ext_6;
              newEngine.ext_9 = slot.ext_9;
              newEngine.notifyState();
              newEngine.handleMidi(slot.rootPitch, vel, true, false, false, false, true, slot.customVoicing);"""

content = content.replace(app_old1, app_new1)

app_old2 = """              if (slot.customVoicing && slot.customVoicing.length > 0) {
                 newEngine.handleCustomVoicing(slot.customVoicing, 0, false, slotIndex);
              } else {
                 newEngine.handleMidi(slot.rootPitch, 0, false, false, false, false, true);
              }"""

app_new2 = """              newEngine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, slot.customVoicing);"""
content = content.replace(app_old2, app_new2)
open('src/App.tsx', 'w').write(content)

content2 = open('src/components/MemorySlots.tsx').read()
mem_old1 = """                    if (slot.customVoicing && slot.customVoicing.length > 0) {
                       engine.handleCustomVoicing(slot.customVoicing, memoryVelocity, true, i);
                    } else {
                       engine.setModifiers(slot.baseType, slot.ext_m7, slot.ext_M7, slot.ext_6, slot.ext_9);
                       engine.handleMidi(slot.rootPitch, memoryVelocity, true, false, false, false, true);
                    }"""
mem_new1 = """                    engine.setModifiers(slot.baseType, slot.ext_m7, slot.ext_M7, slot.ext_6, slot.ext_9);
                    engine.handleMidi(slot.rootPitch, memoryVelocity, true, false, false, false, true, slot.customVoicing);"""
content2 = content2.replace(mem_old1, mem_new1)

mem_old2 = """                    if (slot.customVoicing && slot.customVoicing.length > 0) {
                       engine.handleCustomVoicing(slot.customVoicing, 0, false, i);
                    } else {
                       engine.handleMidi(slot.rootPitch, 0, false, false, false, false, true);
                    }"""
mem_new2 = """                    engine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, slot.customVoicing);"""
content2 = content2.replace(mem_old2, mem_new2)
open('src/components/MemorySlots.tsx', 'w').write(content2)

print("Patched App and MemorySlots")
