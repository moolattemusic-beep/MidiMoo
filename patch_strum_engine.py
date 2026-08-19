content = open('src/components/SettingsPanel.tsx').read()

old_block = """      <div className="module">
        <div className="flex justify-between items-center mb-4">
          <p className="label-meta">STRUM ENGINE</p>
          <div 
            className={`toggle-switch ${params.strumEngine === 1 ? 'on' : ''}`}
            onClick={() => updateParam('strumEngine', params.strumEngine === 1 ? 0 : 1)}
          ></div>
        </div>
        
        <div className={`transition-opacity duration-300 ${params.strumEngine === 1 ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">SPEED</span>
              <span className="label-meta !text-[var(--accent)]">{params.strumSpeedMs}MS</span>
            </div>
            <CustomSlider
              min={0}
              max={360}
              step={5}
              value={params.strumSpeedMs}
              onChange={(val) => updateParam('strumSpeedMs', val)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
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
          </div>
        </div>
      </div>"""

new_block = """      <CollapsibleSection title="STRUM ENGINE" extraHeader={<div 
            className={`toggle-switch ${params.strumEngine === 1 ? 'on' : ''}`}
            onClick={() => updateParam('strumEngine', params.strumEngine === 1 ? 0 : 1)}
          ></div>}>
        <div className={`transition-opacity duration-300 ${params.strumEngine === 1 ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="label-meta">SPEED</span>
              <span className="label-meta !text-[var(--accent)]">{params.strumSpeedMs}MS</span>
            </div>
            <CustomSlider
              min={0}
              max={360}
              step={5}
              value={params.strumSpeedMs}
              onChange={(val) => updateParam('strumSpeedMs', val)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
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
          </div>
        </div>
      </CollapsibleSection>"""

if old_block in content:
    content = content.replace(old_block, new_block)
    open('src/components/SettingsPanel.tsx', 'w').write(content)
    print("Patched STRUM ENGINE")
else:
    print("Block not found. Printing some lines...")
    import sys
    sys.exit(1)
