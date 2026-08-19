import re

content = open('src/components/SettingsPanel.tsx').read()

velocity_section = """
      <div className="module">
        <p className="label-meta mb-4">VELOCITY ENGINE</p>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta">HUMAN VELOCITY</span>
            <span className="label-meta !text-[var(--accent)]">{params.velHumanize}</span>
          </div>
          <CustomSlider min={0} max={50} step={1} value={params.velHumanize} onChange={(val) => updateParam('velHumanize', val)} />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta">HIGH REG. PAD</span>
            <span className="label-meta !text-[var(--accent)]">{params.velHighRegisterPad}</span>
          </div>
          <CustomSlider min={0} max={100} step={1} value={params.velHighRegisterPad} onChange={(val) => updateParam('velHighRegisterPad', val)} />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta">GLIDE INVERSION PAD</span>
            <span className="label-meta !text-[var(--accent)]">{params.velGlideInversion}</span>
          </div>
          <CustomSlider min={0} max={50} step={1} value={params.velGlideInversion} onChange={(val) => updateParam('velGlideInversion', val)} />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta">CHORD CHANGE PAD</span>
            <span className="label-meta !text-[var(--accent)]">{params.velGlideChord}</span>
          </div>
          <CustomSlider min={0} max={50} step={1} value={params.velGlideChord} onChange={(val) => updateParam('velGlideChord', val)} />
        </div>
      </div>
"""

content = content.replace('      <div className="module">\n        <div className="flex justify-between items-center mb-4">\n          <p className="label-meta">OMNICHORD MODE</p>', velocity_section + '      <div className="module">\n        <div className="flex justify-between items-center mb-4">\n          <p className="label-meta">OMNICHORD MODE</p>')

open('src/components/SettingsPanel.tsx', 'w').write(content)

