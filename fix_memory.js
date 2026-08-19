const fs = require('fs');
let code = fs.readFileSync('src/components/MemorySlots.tsx', 'utf8');

// Update Interface
code = code.replace(
  /onArmSlot: \(index: number\) => void;/g,
  "onArmSlot: (index: number) => void;\n  hideHeader?: boolean;"
);

// Update Props
code = code.replace(
  /export function MemorySlots\(\{ engine, slots, armedSlotIndex, playingSlotIndex, onArmSlot \}: MemorySlotsProps\) \{/g,
  "export function MemorySlots({ engine, slots, armedSlotIndex, playingSlotIndex, onArmSlot, hideHeader }: MemorySlotsProps) {"
);

// Update Render
code = code.replace(
  /<div className="flex items-center justify-between">\s*<span className="label-meta">CHORD MEMORY \(1-8\)<\/span>\s*\{armedSlotIndex !== null && \(\s*<span className="text-red-400 font-\['Space_Mono'\] text-\[10px\] animate-pulse uppercase">Waiting for chord\.\.\.<\/span>\s*\)\}\s*<\/div>/g,
  `{!hideHeader && (
        <div className="flex items-center justify-between">
          <span className="label-meta">CHORD MEMORY (1-8)</span>
          {armedSlotIndex !== null && (
            <span className="text-red-400 font-['Space_Mono'] text-[10px] animate-pulse uppercase">Waiting for chord...</span>
          )}
        </div>
      )}
      {hideHeader && armedSlotIndex !== null && (
        <div className="flex items-center justify-end -mb-2">
          <span className="text-red-400 font-['Space_Mono'] text-[10px] animate-pulse uppercase">Waiting for chord...</span>
        </div>
      )}`
);

fs.writeFileSync('src/components/MemorySlots.tsx', code);
