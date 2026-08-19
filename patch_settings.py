import re
content = open('src/components/SettingsPanel.tsx').read()

old_strum_dir = """          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => updateParam('strumDirection', 0)}
              className={`analog-btn ${params.strumDirection === 0 ? 'active' : ''}`}
            >
              UP
            </button>
            <button
              onClick={() => updateParam('strumDirection', 1)}
              className={`analog-btn ${params.strumDirection === 1 ? 'active' : ''}`}
            >
              DOWN
            </button>
          </div>"""

new_strum_dir = """          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              onClick={() => updateParam('strumDirection', 0)}
              className={`analog-btn ${params.strumDirection === 0 ? 'active' : ''}`}
            >
              UP
            </button>
            <button
              onClick={() => updateParam('strumDirection', 1)}
              className={`analog-btn ${params.strumDirection === 1 ? 'active' : ''}`}
            >
              DOWN
            </button>
            <button
              onClick={() => updateParam('strumDirection', 2)}
              className={`analog-btn ${params.strumDirection === 2 ? 'active' : ''}`}
            >
              RND
            </button>
          </div>
          <div className="mt-4">
            <button
              onClick={() => updateParam('strumAlternate', !params.strumAlternate)}
              className={`analog-btn w-full ${params.strumAlternate ? 'active' : ''}`}
            >
              ALTERNATE DIRECTION
            </button>
          </div>
          <div className="mt-4 flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-white/70">Inversion Repeat: {params.inversionRepeat === 0 ? 'OFF' : params.inversionRepeat}</span>
          </div>
          <CustomSlider
            min={0}
            max={8}
            step={1}
            value={params.inversionRepeat}
            onChange={(val) => updateParam('inversionRepeat', val)}
          />"""

content = content.replace(old_strum_dir, new_strum_dir)
open('src/components/SettingsPanel.tsx', 'w').write(content)
