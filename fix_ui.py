import re

# 1. Update CSS
css = open('src/index.css').read()
old_css = """input[type="range"] {
  -webkit-appearance: none;
  width: 100%;
  background: #111;
  height: 8px;
  border-radius: 4px;
  outline: none;
  border: 1px solid #444;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 24px;
  background: var(--accent);
  border: 2px solid #fff;
  border-radius: 2px;
  cursor: pointer;
}"""

new_css = """/* Fat touch targets for sliders */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  background: transparent;
  height: 40px; /* Fat touch target */
  outline: none;
  margin: 0;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-runnable-track {
  width: 100%;
  height: 8px;
  background: #111;
  border: 1px solid #444;
  border-radius: 4px;
}

input[type="range"]::-moz-range-track {
  width: 100%;
  height: 8px;
  background: #111;
  border: 1px solid #444;
  border-radius: 4px;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px; /* Wider thumb for grabbing */
  height: 36px;
  background: var(--accent);
  border: 2px solid #fff;
  border-radius: 2px;
  cursor: pointer;
  margin-top: -14px; /* Center thumb on track (8 - 36)/2 = -14 */
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
}

input[type="range"]::-moz-range-thumb {
  width: 24px;
  height: 36px;
  background: var(--accent);
  border: 2px solid #fff;
  border-radius: 2px;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
}"""

css = css.replace(old_css, new_css)
open('src/index.css', 'w').write(css)

# 2. Update MobileView
mobile = open('src/components/MobileView.tsx').read()
mobile = mobile.replace('className="flex-1 h-2 bg-black rounded-full appearance-none cursor-pointer border border-[#333]"', 'className="flex-1 touch-none"')

old_block = """          <div className="flex justify-between items-center mb-1">
            <span className="label-meta">PERFORMANCE (1 OCT)</span>
          </div>
          <PerformanceKeyboard 
            engine={engine} 
            params={params} 
            activeNotes={activeNotes} 
            numKeysOverride={13} 
          />
          
          <div className="flex items-center gap-3 mt-4 px-2">
            <span className="label-meta shrink-0">INVERSION</span>
            <input
              type="range"
              min={0}
              max={16}
              step={1}
              value={params.chordInversion}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setParams({...params, chordInversion: val});
                if (engine) engine.updateInversion(val);
              }}
              className="flex-1 touch-none"
            />
            <span className="label-meta !text-[var(--accent)] w-6 text-right">{params.chordInversion}</span>
          </div>"""

new_block = """          <div className="flex justify-between items-center px-2">
            <span className="label-meta shrink-0">INVERSION</span>
            <span className="label-meta !text-[var(--accent)]">{params.chordInversion}</span>
          </div>
          
          <div className="flex items-center gap-3 px-2 mb-4">
            <input
              type="range"
              min={0}
              max={16}
              step={1}
              value={params.chordInversion}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setParams({...params, chordInversion: val});
                if (engine) engine.updateInversion(val);
              }}
              className="flex-1 touch-none"
            />
          </div>

          <div className="flex justify-between items-center mb-1 mt-2">
            <span className="label-meta">PERFORMANCE (1 OCT)</span>
          </div>
          <PerformanceKeyboard 
            engine={engine} 
            params={params} 
            activeNotes={activeNotes} 
            numKeysOverride={13} 
          />"""

mobile = mobile.replace(old_block, new_block)
open('src/components/MobileView.tsx', 'w').write(mobile)

