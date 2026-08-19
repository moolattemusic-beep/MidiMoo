import re

content = open('src/components/SettingsPanel.tsx').read()

# 1. Add CollapsibleSection and import useState
if 'useState' not in content:
    content = content.replace("import React from 'react';", "import React, { useState } from 'react';")

collapsible_component = """
const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; extraHeader?: React.ReactNode }> = ({ title, children, extraHeader }) => {
  const storageKey = `orchid-collapse-${title.replace(/\\s+/g, '-').toLowerCase()}`;
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? saved === 'true' : false; // Default collapsed
  });

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem(storageKey, String(next));
  };

  return (
    <div className="module overflow-hidden">
      <div className="flex justify-between items-center cursor-pointer select-none" onClick={toggle}>
        <p className="label-meta">{title}</p>
        <div className="flex items-center gap-3">
          {extraHeader && <div onClick={(e) => e.stopPropagation()}>{extraHeader}</div>}
          <span className="text-[var(--accent)] opacity-50 text-[10px]">
            {isOpen ? '▲' : '▼'}
          </span>
        </div>
      </div>
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-white/5">
          {children}
        </div>
      )}
    </div>
  );
};

export const SettingsPanel"""
content = content.replace('export const SettingsPanel', collapsible_component)

# 2. Refactor Global Mapping
# from: <div className="module"> ... <p className="label-meta mb-3">Global Mapping</p> ... </div>
global_mapping_re = r'<div className="module">\s*<p className="label-meta mb-3">Global Mapping</p>(.*?)</div>\s*<div className="module">'
global_mapping_match = re.search(global_mapping_re, content, re.DOTALL)
if global_mapping_match:
    inner = global_mapping_match.group(1).strip()
    new_block = f'<CollapsibleSection title="Global Mapping">\n        {inner}\n      </CollapsibleSection>\n      <div className="module">'
    content = content.replace(global_mapping_match.group(0), new_block)

# 3. Refactor Register Control
# from: <div className="module">\s*<div className="flex justify-between items-center mb-4">\s*<p className="label-meta">Register Control</p>\s*</div>(.*?)</div>\s*<div className="module">
register_control_re = r'<div className="module">\s*<div className="flex justify-between items-center mb-4">\s*<p className="label-meta">Register Control</p>\s*</div>(.*?)</div>\s*<div className="module">'
register_control_match = re.search(register_control_re, content, re.DOTALL)
if register_control_match:
    inner = register_control_match.group(1).strip()
    new_block = f'<CollapsibleSection title="Register Control">\n        {inner}\n      </CollapsibleSection>\n      <div className="module">'
    content = content.replace(register_control_match.group(0), new_block)

# 4. Refactor MPE GLIDE
mpe_glide_re = r'<div className="module">\s*<div className="flex justify-between items-center mb-4">\s*<p className="label-meta">MPE GLIDE</p>\s*(<div\s*className={`toggle-switch[^>]+></div>)\s*</div>(.*?)\s*</div>\s*<div className="module">'
mpe_glide_match = re.search(mpe_glide_re, content, re.DOTALL)
if mpe_glide_match:
    extra = mpe_glide_match.group(1)
    inner = mpe_glide_match.group(2).strip()
    new_block = f'<CollapsibleSection title="MPE GLIDE" extraHeader={{{extra}}}>\n        {inner}\n      </CollapsibleSection>\n      <div className="module">'
    content = content.replace(mpe_glide_match.group(0), new_block)

# 5. Refactor STRUM ENGINE
strum_engine_re = r'<div className="module">\s*<div className="flex justify-between items-center mb-4">\s*<p className="label-meta">STRUM ENGINE</p>\s*(<div\s*className={`toggle-switch[^>]+></div>)\s*</div>(.*?)\s*</div>\s*<div className="module">'
strum_engine_match = re.search(strum_engine_re, content, re.DOTALL)
if strum_engine_match:
    extra = strum_engine_match.group(1)
    inner = strum_engine_match.group(2).strip()
    new_block = f'<CollapsibleSection title="STRUM ENGINE" extraHeader={{{extra}}}>\n        {inner}\n      </CollapsibleSection>\n      <div className="module">'
    content = content.replace(strum_engine_match.group(0), new_block)

# 6. Refactor VELOCITY ENGINE
velocity_engine_re = r'<div className="module">\s*<p className="label-meta mb-4">VELOCITY ENGINE</p>(.*?)\s*</div>\s*<div className="module">'
velocity_engine_match = re.search(velocity_engine_re, content, re.DOTALL)
if velocity_engine_match:
    inner = velocity_engine_match.group(1).strip()
    new_block = f'<CollapsibleSection title="VELOCITY ENGINE">\n        {inner}\n      </CollapsibleSection>\n      <div className="module">'
    content = content.replace(velocity_engine_match.group(0), new_block)

# 7. Refactor OMNICHORD MODE (and remove desc)
# Note: Omnichord mode is the last module, so we don't look for the next module.
omnichord_re = r'<div className="module">\s*<div className="flex justify-between items-center mb-4">\s*<p className="label-meta">OMNICHORD MODE</p>\s*(<div\s*className={`toggle-switch.*?onClick=\{.*?\s*\}\s*>\s*</div>)\s*</div>\s*<p className="text-xs text-\[var\(--ink\)\] leading-snug">.*?</p>\s*</div>'
omnichord_match = re.search(omnichord_re, content, re.DOTALL)
if omnichord_match:
    extra = omnichord_match.group(1)
    new_block = f'<CollapsibleSection title="OMNICHORD MODE" extraHeader={{{extra}}}>\n        <div className="text-xs text-[var(--ink)]">Omnichord mode enabled.</div>\n      </CollapsibleSection>'
    content = content.replace(omnichord_match.group(0), new_block)

open('src/components/SettingsPanel.tsx', 'w').write(content)
print("Patched SettingsPanel")
