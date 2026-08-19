import re
content = open('src/components/SettingsPanel.tsx').read()

density_labels = "['3', '4', '5', '3-5', '4-6']"

density_html = """
        <div className="mb-6 h-[50px]">
          <div className="fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">MAX NOTES</span>
              <span className="label-meta !text-[var(--accent)]">{['3', '4', '5', '3-5', '4-6'][params.chordDensity]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={params.chordDensity}
              onChange={(e) => updateParam('chordDensity', parseInt(e.target.value))}
            />
          </div>
        </div>
"""

# Insert after inversion
content = content.replace('updateParam(\'chordInversion\', parseInt(e.target.value))}\n            />\n          </div>\n        </div>', 'updateParam(\'chordInversion\', parseInt(e.target.value))}\n            />\n          </div>\n        </div>\n' + density_html)

open('src/components/SettingsPanel.tsx', 'w').write(content)
