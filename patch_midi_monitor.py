import re
content = open('src/App.tsx').read()

old_monitor_state = """  const [outputs, setOutputs] = useState<MIDIOutput[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');"""

new_monitor_state = """  const [outputs, setOutputs] = useState<MIDIOutput[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  
  const [midiLog, setMidiLog] = useState<{time: string, type: string, ch: number, d1: number, d2?: number}[]>([]);
  const [incomingCC, setIncomingCC] = useState<{cc: number, val: number, ch: number, t: number} | null>(null);
  
  const addLog = (type: string, ch: number, d1: number, d2?: number) => {
    setMidiLog(prev => {
      const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 });
      const newLog = [{time: now, type, ch, d1, d2}, ...prev];
      return newLog.slice(0, 50);
    });
  };"""

if old_monitor_state in content:
    content = content.replace(old_monitor_state, new_monitor_state)

old_callbacks = """    midiManager.onInputMessage = (pitch, velocity, isOn, channel) => {
      // Memory slots are exactly one octave below the Major chords base type"""

new_callbacks = """    midiManager.onInputMessage = (pitch, velocity, isOn, channel) => {
      addLog(isOn ? 'NOTE ON' : 'NOTE OFF', channel, pitch, velocity);
      // Memory slots are exactly one octave below the Major chords base type"""

if old_callbacks in content:
    content = content.replace(old_callbacks, new_callbacks)

old_cc = """    midiManager.onControlChange = (cc, value, channel) => {
      newEngine.handleControlChange(cc, value, channel);
      midiManager.sendControlChange(cc, value); // Forward CC to MIDI output
    };"""

new_cc = """    midiManager.onControlChange = (cc, value, channel) => {
      addLog('CC', channel, cc, value);
      setIncomingCC({ cc, val: value, ch: channel, t: Date.now() });
      newEngine.handleControlChange(cc, value, channel);
      midiManager.sendControlChange(cc, value); // Forward CC to MIDI output
    };"""

if old_cc in content:
    content = content.replace(old_cc, new_cc)

old_jsx = """            {engine && <ArpeggioXYPad engine={engine} params={params} setParams={setParams} />}"""

new_jsx = """            {engine && <ArpeggioXYPad engine={engine} params={params} setParams={setParams} incomingCC={incomingCC} />}"""

if old_jsx in content:
    content = content.replace(old_jsx, new_jsx)

old_mobile = """        <MobileView 
          engine={engine}
          params={params}
          setParams={setParams}
          engineState={engineState}
          memorySlots={memorySlots}
          setMemorySlots={setMemorySlots}
          onExit={() => setShowMobileView(false)}
        />"""

new_mobile = """        <MobileView 
          engine={engine}
          params={params}
          setParams={setParams}
          engineState={engineState}
          memorySlots={memorySlots}
          setMemorySlots={setMemorySlots}
          onExit={() => setShowMobileView(false)}
          incomingCC={incomingCC}
        />"""

if old_mobile in content:
    content = content.replace(old_mobile, new_mobile)

# Add monitor overlay right before </main>
old_main_close = "      </main>\n    </>"
new_main_close = """      </main>

      {/* MIDI Monitor Overlay */}
      <div className="fixed bottom-4 right-4 w-72 h-48 bg-[#12120f]/90 backdrop-blur-md border border-white/10 rounded-md overflow-hidden flex flex-col pointer-events-none shadow-2xl z-50">
         <div className="bg-[#1e1e19] px-3 py-1 label-meta border-b border-white/5">MIDI IN MONITOR</div>
         <div className="flex-1 overflow-y-auto p-2 font-mono text-[9px] flex flex-col gap-1">
           {midiLog.length === 0 && <span className="text-white/30 italic">Waiting for MIDI...</span>}
           {midiLog.map((log, i) => (
             <div key={i} className="flex gap-2">
               <span className="text-white/40">{log.time}</span>
               <span className="text-[var(--accent)] w-12">{log.type}</span>
               <span className="w-8 text-white/50">CH {log.ch}</span>
               <span className="w-6">{log.d1}</span>
               {log.d2 !== undefined && <span>{log.d2}</span>}
             </div>
           ))}
         </div>
      </div>
    </>"""

if old_main_close in content:
    content = content.replace(old_main_close, new_main_close)

open('src/App.tsx', 'w').write(content)
print("Patched App.tsx completely")
