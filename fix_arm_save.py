import re
content = open('src/App.tsx').read()

old_arm_desktop = """            onArmSlot={(index) => {
              setArmedSlotIndex(prev => prev === index ? null : index);
              if (lastPlayedChord && armedSlotIndex !== index) {
                setMemorySlots(prev => {
                  const next = [...prev];
                  next[index] = lastPlayedChord;
                  return next;
                });
              }
            }}"""

new_arm_desktop = """            onArmSlot={(index) => {
              if (lastPlayedChord) {
                // Instantly save, DO NOT arm, to prevent accidental overwrites
                setMemorySlots(prev => {
                  const next = [...prev];
                  next[index] = lastPlayedChord;
                  return next;
                });
                setArmedSlotIndex(null);
              } else {
                setArmedSlotIndex(prev => prev === index ? null : index);
              }
            }}"""

content = content.replace(old_arm_desktop, new_arm_desktop)

old_arm_mobile = """          onArmSlot={(index) => {
            setArmedSlotIndex(prev => prev === index ? null : index);
            if (lastPlayedChord && armedSlotIndex !== index) {
              setMemorySlots(prev => {
                const next = [...prev];
                next[index] = lastPlayedChord;
                return next;
              });
            }
          }}"""

new_arm_mobile = """          onArmSlot={(index) => {
            if (lastPlayedChord) {
              setMemorySlots(prev => {
                const next = [...prev];
                next[index] = lastPlayedChord;
                return next;
              });
              setArmedSlotIndex(null);
            } else {
              setArmedSlotIndex(prev => prev === index ? null : index);
            }
          }}"""

content = content.replace(old_arm_mobile, new_arm_mobile)

open('src/App.tsx', 'w').write(content)
