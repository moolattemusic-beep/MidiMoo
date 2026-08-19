import re
content = open('src/components/SettingsPanel.tsx').read()

mpe_html = """
        <div className="mb-6 h-[50px]">
          <div className="fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">MPE GLIDE (SYNTH/MIDI)</span>
              <span className="label-meta !text-[var(--accent)]">{params.mpeEnabled ? 'ON' : 'OFF'}</span>
            </div>
            <div 
              className="toggle-switch cursor-pointer"
              onClick={() => updateParam('mpeEnabled', !params.mpeEnabled)}
            >
              <div className={`toggle-knob ${params.mpeEnabled ? 'on' : 'off'}`} />
            </div>
          </div>
        </div>

        {params.mpeEnabled && (
          <div className="mb-6 h-[50px]">
            <div className="fade-in">
              <div className="flex justify-between items-center mb-2">
                <span className="label-meta">GLIDE TIME</span>
                <span className="label-meta !text-[var(--accent)]">{params.mpeGlideTimeMs} ms</span>
              </div>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={params.mpeGlideTimeMs}
                onChange={(e) => updateParam('mpeGlideTimeMs', parseInt(e.target.value))}
              />
            </div>
          </div>
        )}
"""

content = content.replace('<div className="module">\n        <p className="label-meta mb-3">Strum Engine</p>', '<div className="module">\n        <p className="label-meta mb-3">Strum Engine</p>' + mpe_html)
open('src/components/SettingsPanel.tsx', 'w').write(content)
