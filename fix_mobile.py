import re
content = open('src/components/MobileView.tsx').read()
old = """            lastPlayedChord={lastPlayedChord}
            isEditMode={false}
            onToggleEditMode={() => {}}
            activeEditSlotIndex={null}
            onSelectEditSlot={() => {}}
          />"""
new = """            lastPlayedChord={lastPlayedChord}
            isEditMode={false}
            onToggleEditMode={() => {}}
            activeEditSlotIndex={null}
            onSelectEditSlot={() => {}}
            memoryVelocity={params.memoryVelocity || 100}
            onMemoryVelocityChange={() => {}}
            isFreeEditMode={false}
            onToggleFreeEditMode={() => {}}
            armedSlotIndex={null}
            onArmSlot={() => {}}
          />"""
content = content.replace(old, new)
open('src/components/MobileView.tsx', 'w').write(content)
