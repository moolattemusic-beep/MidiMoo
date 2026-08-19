import re
content = open('src/components/SettingsPanel.tsx').read()

old_mapping = """        <p className="label-meta mb-3">Global Mapping</p>
        <div className="grid grid-cols-3 gap-2">
          {["CLASSIC", "CIRCLE 5TH", "KEY MODE"].map((mode, idx) => (
            <button
              key={mode}
              onClick={() => updateParam('keyboardMapping', idx)}
              className={`analog-btn ${params.keyboardMapping === idx ? 'active' : ''}`}
            >
              {mode}
            </button>
          ))}
        </div>"""

new_mapping = """        <p className="label-meta mb-3">Global Mapping</p>
        <div className="grid grid-cols-4 gap-2">
          {["CLASSIC", "CIRCLE 5TH", "KEY MODE", "FREE MODE"].map((mode, idx) => (
            <button
              key={mode}
              onClick={() => updateParam('keyboardMapping', idx)}
              className={`analog-btn ${params.keyboardMapping === idx ? 'active' : ''}`}
            >
              {mode}
            </button>
          ))}
        </div>"""

if old_mapping in content:
    content = content.replace(old_mapping, new_mapping)
    open('src/components/SettingsPanel.tsx', 'w').write(content)
    print("Patched successfully")
else:
    print("Could not find exact text to patch")
