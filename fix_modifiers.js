const fs = require('fs');
let code = fs.readFileSync('src/components/ModifierPads.tsx', 'utf8');

// Fix the syntax error
code = code.replace(/\{ id: '9', label: '9', hotkey: '\[F\]', active: ext_9,\s*hideOctaveSlider \}/, "{ id: '9', label: '9', hotkey: '[F]', active: ext_9 }");

// Introduce the local momentary overrides
code = code.replace(/const updateParam = \(key: keyof OrchidParams, value: any\) => \{/, 
`const isMomentaryBase = hideHeader ? false : params.momentaryBase;
  const isMomentaryExt = hideHeader ? false : params.momentaryExt;

  const updateParam = (key: keyof OrchidParams, value: any) => {`);

// Replace all usages of params.momentaryBase and params.momentaryExt inside the component with the local overrides (except in updateParam and the toggle switches themselves)
code = code.replace(/params\.momentaryBase/g, "isMomentaryBase");
code = code.replace(/params\.momentaryExt/g, "isMomentaryExt");

// Fix the toggle switch to use the real params for the class (so they reflect actual state if they were shown) and the toggles
code = code.replace(/isMomentaryBase \? 'on' : ''/g, "params.momentaryBase ? 'on' : ''");
code = code.replace(/!isMomentaryBase\)/g, "!params.momentaryBase)");
code = code.replace(/isMomentaryExt \? 'on' : ''/g, "params.momentaryExt ? 'on' : ''");
code = code.replace(/!isMomentaryExt\)/g, "!params.momentaryExt)");

// Hide the momentary toggles if hideHeader is true
code = code.replace(
  /<div className="flex items-center gap-2">\s*<span className="label-meta text-\[10px\]">MOMENTARY<\/span>\s*<div\s*className=\{`toggle-switch \$\{params\.momentaryBase \? 'on' : ''\}`\}\s*onClick=\{\(\) => updateParam\('momentaryBase', !params\.momentaryBase\)\}\s*><\/div>\s*<\/div>/g,
  `{!hideHeader && (
          <div className="flex items-center gap-2">
            <span className="label-meta text-[10px]">MOMENTARY</span>
            <div 
              className={\`toggle-switch \${params.momentaryBase ? 'on' : ''}\`}
              onClick={() => updateParam('momentaryBase', !params.momentaryBase)}
            ></div>
          </div>
        )}`
);

code = code.replace(
  /<div className="flex items-center gap-2">\s*<span className="label-meta text-\[10px\]">MOMENTARY<\/span>\s*<div\s*className=\{`toggle-switch \$\{params\.momentaryExt \? 'on' : ''\}`\}\s*onClick=\{\(\) => updateParam\('momentaryExt', !params\.momentaryExt\)\}\s*><\/div>\s*<\/div>/g,
  `{!hideHeader && (
          <div className="flex items-center gap-2">
            <span className="label-meta text-[10px]">MOMENTARY</span>
            <div 
              className={\`toggle-switch \${params.momentaryExt ? 'on' : ''}\`}
              onClick={() => updateParam('momentaryExt', !params.momentaryExt)}
            ></div>
          </div>
        )}`
);

fs.writeFileSync('src/components/ModifierPads.tsx', code);
