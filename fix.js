const fs = require('fs');
let code = fs.readFileSync('src/components/ModifierPads.tsx', 'utf8');
code = code.replace(/ext_6: boolean;\s*ext_9,[\s\S]*?hideOctaveSlider\?: boolean;\s*}/, 
`ext_6: boolean;
  ext_9: boolean;
  hideOctaveSlider?: boolean;
}`);
code = code.replace(/ext_6,\s*ext_9,[\s\S]*?hideOctaveSlider\s*}\) => {/,
`ext_6,
  ext_9,
  hideOctaveSlider
}) => {`);
fs.writeFileSync('src/components/ModifierPads.tsx', code);
