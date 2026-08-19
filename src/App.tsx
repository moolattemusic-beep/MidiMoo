import React, { useEffect, useState, useRef } from 'react';
import { OrchidEngine } from './lib/OrchidEngine';
import { MidiDeviceManager } from './lib/MidiDeviceManager';
import { SimpleSynth } from './lib/SimpleSynth';
import { OrchidParams, defaultParams, NoteEvent } from './types';
import { ModifierPads } from './components/ModifierPads';
import { SettingsPanel } from './components/SettingsPanel';
import { VoicingPad } from './components/VoicingPad';
import { ArpeggioXYPad } from './components/ArpeggioXYPad';
import { MemorySlots, MemorySlot } from './components/MemorySlots';
import { PerformanceKeyboard } from './components/PerformanceKeyboard';
import { MobileView } from './components/MobileView';

function App() {
  const [engine, setEngine] = useState<OrchidEngine | null>(null);
  const [midiManager] = useState(() => new MidiDeviceManager());
  const [synth] = useState(() => new SimpleSynth());
  
  const [params, setParams] = useState<OrchidParams>(() => {
    const saved = localStorage.getItem('orchid-params');
    if (saved) {
      try {
        return { ...defaultParams, ...JSON.parse(saved) };
      } catch (e) {
        return defaultParams;
      }
    }
    return defaultParams;
  });

  useEffect(() => {
    localStorage.setItem('orchid-params', JSON.stringify(params));
  }, [params]);
  
  const [memorySlots, setMemorySlots] = useState<MemorySlot[]>(Array(8).fill(null));
  const [playingSlotIndex, setPlayingSlotIndex] = useState<number | null>(null);
  const [lastPlayedChord, setLastPlayedChord] = useState<MemorySlot | null>(null);
  const [isChordEditMode, setIsChordEditMode] = useState(false);
  const [activeEditSlotIndex, setActiveEditSlotIndex] = useState<number | null>(null);
  const activeEditSlotIndexRef = useRef(activeEditSlotIndex);
  activeEditSlotIndexRef.current = activeEditSlotIndex;

  const [isFreeEditMode, setIsFreeEditMode] = useState(false);
  const [armedSlotIndex, setArmedSlotIndex] = useState<number | null>(null);
  const armedSlotIndexRef = useRef(armedSlotIndex);
  armedSlotIndexRef.current = armedSlotIndex;
  
  // To track keys played during an armed recording gesture
  const armedRecordedPitches = useRef<Set<number>>(new Set());


  
  const [showMobileView, setShowMobileView] = useState(false);
  
  const memorySlotsRef = useRef(memorySlots);
    const playingSlotIndexRef = useRef(playingSlotIndex);
  const paramsRef = useRef(params);


  useEffect(() => { memorySlotsRef.current = memorySlots; }, [memorySlots]);
    useEffect(() => { playingSlotIndexRef.current = playingSlotIndex; }, [playingSlotIndex]);
  useEffect(() => { paramsRef.current = params; }, [params]);

  // State to force re-renders from engine
  const [engineState, setEngineState] = useState({
    manualBaseType: -1,
    ext_m7: false,
    ext_M7: false,
    ext_6: false,
    ext_9: false,
    ext_alt: false,
  });

  const [inputs, setInputs] = useState<MIDIInput[]>([]);
  const [outputs, setOutputs] = useState<MIDIOutput[]>([]);
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
  };
  const [isSynthEnabled, setIsSynthEnabled] = useState(false);
  const [midiSupported, setMidiSupported] = useState<boolean | null>(null);
  const [showMidiMonitor, setShowMidiMonitor] = useState(false);

  // For visual feedback
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [physicallyHeldNotes, setPhysicallyHeldNotes] = useState<number[]>([]);
  const physicallyHeldNotesRef = useRef(physicallyHeldNotes);
  physicallyHeldNotesRef.current = physicallyHeldNotes;

  useEffect(() => {
    const newEngine = new OrchidEngine(params);
    
    newEngine.onStateChange = () => {
      setEngineState({
        manualBaseType: newEngine.manualBaseType,
        ext_m7: newEngine.ext_m7,
        ext_M7: newEngine.ext_M7,
        ext_6: newEngine.ext_6,
        ext_9: newEngine.ext_9,
        ext_alt: newEngine.ext_alt,
      });
    };

    newEngine.onParamsUpdate = (newParams) => {
      setParams(newParams);
    };
    setEngine(newEngine);

    midiManager.onInputMessage = (pitch, velocity, isOn, channel) => {
      addLog(isOn ? 'NOTE ON' : 'NOTE OFF', channel, pitch, velocity);
      // Memory slots are exactly one octave below the Major chords base type
      // Major base type = 24 + (controlOctave * 12)
      const memoryStartNote = 12 + (paramsRef.current.controlOctave * 12);
      
      if (channel === 1 && pitch >= memoryStartNote && pitch < memoryStartNote + 8) {
        if (true) {
          const slotIndex = pitch - memoryStartNote;
          const slot = memorySlotsRef.current[slotIndex];
          if (slot) {
            const vel = paramsRef.current.memoryVelocity || 100;
            if (isOn && velocity > 0) {
              setPlayingSlotIndex(slotIndex);
              newEngine.manualBaseType = slot.baseType;
              newEngine.ext_m7 = slot.ext_m7;
              newEngine.ext_M7 = slot.ext_M7;
              newEngine.ext_6 = slot.ext_6;
              newEngine.ext_9 = slot.ext_9;
              newEngine.notifyState();
              newEngine.handleMidi(slot.rootPitch, vel, true, false, false, false, true, slot.customVoicing);
            } else {
              if (playingSlotIndexRef.current === slotIndex) {
                setPlayingSlotIndex(null);
              }
              newEngine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, slot.customVoicing);
            }
          } else if (isOn && velocity > 0) {
            // Save to slot
            if (newEngine.lastPerformanceKey !== undefined) {
               const newSlot = {
                  rootPitch: newEngine.lastPerformanceKey,
                  baseType: newEngine.currentEffectiveBaseType,
                  ext_m7: newEngine.ext_m7,
                  ext_M7: newEngine.ext_M7,
                  ext_6: newEngine.ext_6,
                  ext_9: newEngine.ext_9
               };
               setMemorySlots(prev => {
                  const next = [...prev];
                  next[slotIndex] = newSlot;
                  return next;
               });
            }
          }
        }
        return;
      }
      
      newEngine.handleMidi(pitch, velocity, isOn);
    };

    midiManager.onControlChange = (cc, value, channel) => {
      addLog('CC', channel, cc, value);
      setIncomingCC({ cc, val: value, ch: channel, t: Date.now() });
      newEngine.handleControlChange(cc, value, channel);
      midiManager.sendControlChange(cc, value); // Forward CC to MIDI output
    };
    
    midiManager.onPitchBend = (value, channel) => {
      addLog('PB', channel, value);
      if (channel === 8) {
         const scaledVal = Math.round((value / 16383) * 127);
         setIncomingCC({ cc: 126, val: scaledVal, ch: channel, t: Date.now() });
      } else {
         // Forward physical pitch bend to engine
         const semitones = ((value - 8192) / 8192) * paramsRef.current.mpeBendRange;
         if (newEngine) {
            newEngine.onOutputNote?.({ pitch: 0, velocity: 0, isOn: false, isPitchBend: true, pitchBendValue: semitones, mpeChannel: channel });
         }
      }
    };

    midiManager.onDevicesChanged = () => {
      setInputs([...midiManager.inputs]);
      setOutputs([...midiManager.outputs]);
      setSelectedInput(midiManager.selectedInputId || '');
      setSelectedOutput(midiManager.selectedOutputId || '');
    };

    midiManager.init().then(supported => {
      setMidiSupported(supported);
      if (!supported) {
        console.log("MIDI not supported or denied.");
      }
    });

    return () => {
      newEngine.onOutputNote = undefined;
      newEngine.onStateChange = undefined;
      midiManager.onInputMessage = undefined;
    };
  }, [midiManager, synth]);

  useEffect(() => {
    if (params.mpeEnabled && selectedOutput) {
      midiManager.setMpeBendRange(params.mpeBendRange);
    }
  }, [params.mpeEnabled, params.mpeBendRange, selectedOutput, midiManager]);

  useEffect(() => {
    if (engine) {
      engine.onPerformanceKey = (pitch: number, isDown: boolean, allReleased: boolean) => {
        setPhysicallyHeldNotes(Array.from(engine.heldKeys.keys()));
        
        if (armedSlotIndexRef.current !== null) {
            if (isDown) {
                armedRecordedPitches.current.add(pitch);
            }
            if (allReleased && armedRecordedPitches.current.size > 0) {
                const idx = armedSlotIndexRef.current;
                const pitches = Array.from(armedRecordedPitches.current) as number[];
                setMemorySlots(prev => {
                    const next = [...prev];
                    next[idx] = { rootPitch: pitches.length > 0 ? pitches[0] % 12 : 0, baseType: 0, ext_m7: false, ext_M7: false, ext_6: false, ext_9: false, customVoicing: pitches };
                    return next;
                });
                setArmedSlotIndex(null); // Disarm after saving
                armedRecordedPitches.current.clear();
            }
        }
        
        if (isDown) {
          if (activeEditSlotIndexRef.current !== null && armedSlotIndexRef.current === null) {
            const idx = activeEditSlotIndexRef.current;
            setMemorySlots(prev => {
               const next = [...prev];
               const existing = next[idx];
               if (existing) {
                  // Keep customVoicing if it exists? Or clear it? 
                  // If user plays a note in standard edit mode, it overwrites custom voicing with a standard chord root
                  next[idx] = { ...existing, rootPitch: pitch % 12, customVoicing: undefined };
               } else {
                  next[idx] = { rootPitch: pitch % 12, baseType: 0, ext_m7: false, ext_M7: false, ext_6: false, ext_9: false };
               }
               return next;
            });
          }
          
          setLastPlayedChord({
            rootPitch: pitch,
            baseType: engine.manualBaseType,
            ext_m7: engine.ext_m7,
            ext_M7: engine.ext_M7,
            ext_6: engine.ext_6,
            ext_9: engine.ext_9
          });
        }
      };
    }
  }, [engine]);



  useEffect(() => {
    if (params.mpeEnabled && selectedOutput) {
      midiManager.setMpeBendRange(params.mpeBendRange);
    }
  }, [params.mpeEnabled, params.mpeBendRange, selectedOutput, midiManager]);

  useEffect(() => {
    if (engine) {
      engine.onOutputNote = (event: NoteEvent) => {
        if (isSynthEnabled && !event.isMidiOnly) synth.handleNoteEvent(event);
        
        if (event.isPitchBend) {
          midiManager.sendMpePitchBend(event.mpeChannel || 1, event.pitchBendValue || 0, params.mpeBendRange, event.delayMs);
        } else if (event.isExpression) {
          midiManager.sendMpeExpression(event.mpeChannel || 1, event.expressionValue || 127, event.delayMs);
        } else if (event.isCC) {
          midiManager.sendControlChange(event.ccNumber!, event.ccValue!, event.delayMs || 0, event.mpeChannel || 1);
        } else {
          if (!event.isInternalSynthOnly) {
            midiManager.sendNote(event.pitch, event.velocity, event.isOn, event.delayMs, event.mpeChannel || 1);
          }
          
          // Delay UI update so it respects strumming visually
          if (event.delayMs && event.delayMs > 0) {
            setTimeout(() => {
              setActiveNotes(prev => event.isOn 
                ? (prev.includes(event.pitch) ? prev : [...prev, event.pitch]) 
                : prev.filter(p => p !== event.pitch));
            }, event.delayMs);
          } else {
            setActiveNotes(prev => event.isOn 
              ? (prev.includes(event.pitch) ? prev : [...prev, event.pitch]) 
              : prev.filter(p => p !== event.pitch));
          }
        }
      };
    }
  }, [isSynthEnabled, engine, midiManager, synth]);

  const handleEnableAudio = () => {
    if (!isSynthEnabled) {
      synth.init();
      setIsSynthEnabled(true);
    } else {
      setIsSynthEnabled(false);
    }
  };

  return (
    <>
      {showMobileView && (
        <MobileView 
          engine={engine}
          params={params}
          setParams={setParams}
          engineState={engineState}
          memorySlots={memorySlots}
                    playingSlotIndex={playingSlotIndex}
                    activeNotes={physicallyHeldNotes}
          onClose={() => setShowMobileView(false)}
          onPlaySlot={(index) => {
            setPlayingSlotIndex(index);
            setLastPlayedChord(memorySlots[index]);
          }}
          onStopSlot={(index) => {
            setPlayingSlotIndex(prev => prev === index ? null : prev);
          }}
          onSaveSlot={(index, chord) => {
            setMemorySlots(prev => {
              const next = [...prev];
              next[index] = chord;
              return next;
            });
          }}
          onUpdateSlots={setMemorySlots}
          lastPlayedChord={lastPlayedChord}
          onPanic={() => {
            if (engine) engine.panic();
            synth.panic();
            midiManager.panic();
          }}
        />
      )}
      <header className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 lg:gap-8 bg-[var(--surface)] border-b-[4px] border-[var(--wood)] px-4 lg:px-8 py-4 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[var(--accent)] border-2 border-[var(--ink)] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>
          <h1 className="font-['Oswald'] font-bold text-2xl uppercase tracking-tight leading-none hidden sm:block">MidiMOO</h1>
        </div>
        
        <div className="flex flex-wrap lg:flex-nowrap gap-2 sm:gap-6 bg-[var(--surface-deep)] p-2 sm:px-4 sm:py-2 rounded-sm border border-white/5 items-center justify-center">
          <button 
            onClick={() => {
              if (engine) engine.panic();
              synth.panic();
              midiManager.panic();
            }}
            className="analog-btn px-3 h-8 flex items-center justify-center bg-red-900/80 text-red-100 hover:bg-red-500 hover:text-white border-red-500 font-bold text-xs"
            title="MIDI Panic (Stop All Notes)"
          >
            PANIC
          </button>
          
          <div className="flex items-center gap-3">
            <span className="label-meta shrink-0">MIDI IN</span>
            <select 
              value={selectedInput}
              onChange={(e) => midiManager.selectInput(e.target.value)}
              className="bg-black text-[var(--accent)] border border-[#444] px-2 py-1 font-['Space_Mono'] text-xs rounded-sm outline-none max-w-[140px]"
            >
              <option value="">No Input</option>
              {inputs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="label-meta shrink-0">MIDI OUT</span>
            <select 
              value={selectedOutput}
              onChange={(e) => midiManager.selectOutput(e.target.value)}
              className="bg-black text-[var(--accent)] border border-[#444] px-2 py-1 font-['Space_Mono'] text-xs rounded-sm outline-none max-w-[140px]"
            >
              <option value="">No Output</option>
              {outputs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <button 
            onClick={() => midiManager.refreshDevices().then(supported => setMidiSupported(supported))}
            className="analog-btn px-4 h-full shrink-0"
          >
            REFRESH
          </button>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <span className="label-meta">MONITOR</span>
          <div 
            className={`toggle-switch ${showMidiMonitor ? 'on' : ''}`}
            onClick={() => setShowMidiMonitor(!showMidiMonitor)}
          ></div>
          <div className="flex items-center gap-2 ml-4">
            <span className="label-meta">SYNTH VOL</span>
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              defaultValue="0.3" 
              onChange={(e) => synth.setVolume(parseFloat(e.target.value))}
              className="w-16 accent-[var(--accent)]"
            />
          </div>
          <span className="label-meta ml-4">SYNTH ON/OFF</span>
          <div 
            className={`toggle-switch ${isSynthEnabled ? 'on' : ''}`}
            onClick={handleEnableAudio}
          ></div>
          <div className="flex items-center gap-3 shrink-0 ml-4 border-l border-white/10 pl-4">
            <button
              onClick={() => setShowMobileView(true)}
              className="analog-btn px-3 h-8 flex items-center justify-center bg-[var(--accent)] text-black"
              title="Mobile View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
            </button>
          </div>
        </div>
      </header>

      {midiSupported === false && (
        <div className="m-4 p-4 rounded-sm bg-red-900/30 border border-red-500/50">
          <p className="text-red-400 font-bold mb-1 font-['Oswald']">MIDI NOT SUPPORTED</p>
          <p className="text-red-200/70 text-xs font-['Space_Mono']">Please use a compatible browser to enable Web MIDI.</p>
        </div>
      )}

      <main className="grid grid-cols-1 xl:grid-cols-[320px_1fr] p-8 lg:p-12 gap-10 lg:gap-8 min-h-0">
        <section className="flex flex-col gap-10 lg:gap-6">
          <SettingsPanel engine={engine} params={params} setParams={setParams} />
        </section>

        <section className="flex flex-col gap-12 lg:gap-8">
          <MemorySlots 
            engine={engine}
            slots={memorySlots}
            playingSlotIndex={playingSlotIndex}
            onPlaySlot={(index) => {
              setPlayingSlotIndex(index);
              setLastPlayedChord(memorySlots[index]);
            }}
            onStopSlot={(index) => {
              setPlayingSlotIndex(prev => prev === index ? null : prev);
            }}
            memoryVelocity={params.memoryVelocity}
            onMemoryVelocityChange={(vel) => setParams(prev => ({ ...prev, memoryVelocity: vel }))}
            isFreeEditMode={isFreeEditMode}
            onToggleFreeEditMode={() => {
               const newFree = !isFreeEditMode;
               setIsFreeEditMode(newFree);
               if (newFree) {
                  setParams(prev => ({ ...prev, mappingMode: 1 })); // switch to Free Mode globally
               } else {
                  setArmedSlotIndex(null);
               }
            }}
            armedSlotIndex={armedSlotIndex}
            onArmSlot={(idx) => {
               setArmedSlotIndex(prev => prev === idx ? null : idx);
               armedRecordedPitches.current.clear();
            }}
            onSaveSlot={(index, chord) => {
              setMemorySlots(prev => {
                const next = [...prev];
                next[index] = chord;
                return next;
              });
            }}
            onUpdateSlots={setMemorySlots}
            lastPlayedChord={lastPlayedChord}
            isEditMode={isChordEditMode}
            onToggleEditMode={() => {
               setIsChordEditMode(!isChordEditMode);
               if (isChordEditMode) setActiveEditSlotIndex(null);
            }}
            activeEditSlotIndex={activeEditSlotIndex}
            onSelectEditSlot={(index) => {
               setActiveEditSlotIndex(prev => prev === index ? null : index);
               // If empty slot is selected, initialize it
               if (memorySlots[index] === null) {
                  setMemorySlots(prev => {
                     const next = [...prev];
                     next[index] = { rootPitch: 0, baseType: 0, ext_m7: false, ext_M7: false, ext_6: false, ext_9: false };
                     return next;
                  });
               }
            }}
          />
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px_280px] gap-10 lg:gap-8">
            <div className="flex flex-col gap-6">
              <ModifierPads 
                engine={engine}
                params={params}
                setParams={setParams}
                manualBaseType={activeEditSlotIndex !== null && memorySlots[activeEditSlotIndex] ? memorySlots[activeEditSlotIndex]!.baseType : engineState.manualBaseType}
                effectiveBaseType={activeEditSlotIndex !== null ? undefined : engineState.effectiveBaseType}
                ext_m7={activeEditSlotIndex !== null && memorySlots[activeEditSlotIndex] ? memorySlots[activeEditSlotIndex]!.ext_m7 : engineState.ext_m7}
                ext_M7={activeEditSlotIndex !== null && memorySlots[activeEditSlotIndex] ? memorySlots[activeEditSlotIndex]!.ext_M7 : engineState.ext_M7}
                ext_6={activeEditSlotIndex !== null && memorySlots[activeEditSlotIndex] ? memorySlots[activeEditSlotIndex]!.ext_6 : engineState.ext_6}
                ext_9={activeEditSlotIndex !== null && memorySlots[activeEditSlotIndex] ? memorySlots[activeEditSlotIndex]!.ext_9 : engineState.ext_9}
                ext_alt={engineState.ext_alt}
                onBaseTypeChange={activeEditSlotIndex !== null ? (val) => {
                   setMemorySlots(prev => {
                      const next = [...prev];
                      if (next[activeEditSlotIndex]) {
                         next[activeEditSlotIndex] = { ...next[activeEditSlotIndex]!, baseType: val };
                      }
                      return next;
                   });
                } : undefined}
                onExtensionToggle={activeEditSlotIndex !== null ? (extId) => {
                   setMemorySlots(prev => {
                      const next = [...prev];
                      const slot = next[activeEditSlotIndex];
                      if (slot) {
                         const updated = { ...slot };
                         if (extId === 'm7') { updated.ext_m7 = !updated.ext_m7; updated.ext_M7 = false; }
                         if (extId === 'M7') { updated.ext_M7 = !updated.ext_M7; updated.ext_m7 = false; }
                         if (extId === '6') updated.ext_6 = !updated.ext_6;
                         if (extId === '9') updated.ext_9 = !updated.ext_9;
                         next[activeEditSlotIndex] = updated;
                      }
                      return next;
                   });
                } : undefined}
              />
            </div>
            
            {engine && <ArpeggioXYPad engine={engine} params={params} setParams={setParams} incomingCC={incomingCC} />}
            {engine && <VoicingPad engine={engine} params={params} setParams={setParams} />}
          </div>

          <div className="module bg-[var(--surface)] border-[4px] border-[var(--wood)] p-4 sm:p-8">
            <p className="label-meta mb-4">PERFORMANCE KEYBOARD — DIRECT BUS</p>
            <PerformanceKeyboard 
              engine={engine} 
              params={params} 
              activeNotes={activeNotes} 
            />
          </div>
        </section>
      </main>

      {/* MIDI Monitor Overlay */}
      {showMidiMonitor && (
        <div className="fixed bottom-16 right-4 w-80 h-56 bg-[#12120f]/90 backdrop-blur-md border border-[var(--accent)] rounded-md overflow-hidden flex flex-col pointer-events-none shadow-2xl z-[9999]">
           <div className="bg-[#1e1e19] px-3 py-1 label-meta border-b border-white/5">MIDI IN MONITOR</div>
           <div className="flex-1 overflow-y-auto p-2 font-mono text-[9px] flex flex-col gap-1">
             {midiLog.length === 0 && <span className="text-white/30 italic">Waiting for MIDI...</span>}
             {midiLog.map((log, i) => (
               <div key={i} className="flex gap-2">
                 <span className="text-white/40">{log.time}</span>
                 <span className="text-[var(--accent)] w-12">{log.type}</span>
                 <span className="w-12 text-white/50">CH {log.ch}</span>
                 <span className="w-8">{log.d1}</span>
                 {log.d2 !== undefined && <span>{log.d2}</span>}
               </div>
             ))}
           </div>
        </div>
      )}

      <footer className="bg-[var(--wood)] px-8 py-1 flex justify-between mt-auto">
        <span className="label-meta !text-black font-bold tracking-[0.2em]">MidiMOO v1.0.4</span>
        <span className="label-meta !text-black font-bold tracking-[0.2em]">STATUS: SIGNAL LOCK</span>
      </footer>
    </>
  );
}

export default App;
