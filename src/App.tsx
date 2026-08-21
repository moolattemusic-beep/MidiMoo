import React, { useEffect, useState, useRef, useCallback } from 'react';
import { OrchidEngine } from './lib/OrchidEngine';
import { MidiDeviceManager } from './lib/MidiDeviceManager';
import { SimpleSynth } from './lib/SimpleSynth';
import { VelocityModulator } from './lib/VelocityModulator';
import { OrchidParams, defaultParams, NoteEvent } from './types';
import { ModifierPads } from './components/ModifierPads';
import { SettingsPanel } from './components/SettingsPanel';
import { VoicingPad } from './components/VoicingPad';
import { ArpeggioXYPad } from './components/ArpeggioXYPad';
import { MemorySlots, MemorySlot } from './components/MemorySlots';
import { PerformanceKeyboard } from './components/PerformanceKeyboard';
import { MobileView } from './components/MobileView';
import { CollapsiblePanel } from './components/CollapsiblePanel';

// Continuous controllers a player expects to reach every sounding voice: mod
// wheel, breath, foot, and the MPE timbre slider. CC 11 is deliberately absent
// — the glide engine sends its own expression on the member channels.
const PERFORMANCE_CCS = new Set([1, 2, 4, 74]);

const UI_SCALE_MIN = 0.5;
const UI_SCALE_MAX = 2;
const UI_SCALE_STEP = 0.1;

function App() {
  const [engine, setEngine] = useState<OrchidEngine | null>(null);
  const [midiManager] = useState(() => new MidiDeviceManager());
  const [velMod] = useState(() => new VelocityModulator(defaultParams));
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

  // Whole-interface zoom. Scales the rendered layout rather than re-flowing it,
  // so nothing moves relative to anything else — text included.
  const [uiScale, setUiScale] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem('orchid-ui-scale') || '');
    return Number.isFinite(saved) && saved >= UI_SCALE_MIN && saved <= UI_SCALE_MAX ? saved : 1;
  });
  useEffect(() => { localStorage.setItem('orchid-ui-scale', String(uiScale)); }, [uiScale]);

  // Parameter descriptions are useful while learning a control and clutter
  // afterwards, so they can be switched off wholesale.
  const [showHelp, setShowHelp] = useState<boolean>(
    () => localStorage.getItem('orchid-show-help') !== 'false'
  );
  useEffect(() => { localStorage.setItem('orchid-show-help', String(showHelp)); }, [showHelp]);

  // The on-screen keyboard is a monitor rather than a control for most playing,
  // so it stays out of the way until it is wanted.
  const [showKeyboard, setShowKeyboard] = useState<boolean>(
    () => localStorage.getItem('orchid-show-keyboard') === 'true'
  );
  useEffect(() => { localStorage.setItem('orchid-show-keyboard', String(showKeyboard)); }, [showKeyboard]);

  const nudgeScale = useCallback((delta: number) => {
    setUiScale(prev => {
      const next = Math.round((prev + delta) * 100) / 100;
      return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, next));
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); nudgeScale(UI_SCALE_STEP); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); nudgeScale(-UI_SCALE_STEP); }
      else if (e.key === '0') { e.preventDefault(); setUiScale(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nudgeScale]);
  
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

  // Which of the three main columns are folded away. The grid template is
  // derived from this, so hiding one widens whatever is left rather than
  // leaving a gap.
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('orchid-collapsed-panels') || '{}'); } catch { return {}; }
  });
  const anyPanelCollapsed = !!(collapsedPanels.chords || collapsedPanels.arp || collapsedPanels.voicing);
  const panelColumns = [
    collapsedPanels.chords ? 'auto' : '1fr',
    collapsedPanels.arp ? 'auto' : (anyPanelCollapsed ? 'minmax(280px, 1fr)' : '280px'),
    collapsedPanels.voicing ? 'auto' : (anyPanelCollapsed ? 'minmax(280px, 1fr)' : '280px'),
  ].join(' ');

  const togglePanel = useCallback((key: string) => {
    setCollapsedPanels(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('orchid-collapsed-panels', JSON.stringify(next));
      return next;
    });
  }, []);
  
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
              newEngine.handleMidi(slot.rootPitch, vel, true, false, false, false, true, slot.customVoicing, slot.chordIntervals);
            } else {
              if (playingSlotIndexRef.current === slotIndex) {
                setPlayingSlotIndex(null);
              }
              newEngine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, slot.customVoicing, slot.chordIntervals);
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
      // With the velocity envelope running, the mod wheel becomes the live CC1
      // anchor instead of being forwarded — otherwise the two would overwrite
      // each other. The envelope emits the combined value.
      if (cc === 1 && paramsRef.current.velModEnabled) {
        velMod.setWheelAnchor(value);
        return;
      }
      // The tremolo swings around whatever CC80 is already set to, so an
      // incoming CC80 becomes the new centre rather than fighting the LFO.
      if (cc === 80 && paramsRef.current.vibratoEnabled && paramsRef.current.vibratoCC80Depth !== 0) {
        velMod.setCC80Center(value);
        return;
      }
      if (paramsRef.current.mpeEnabled && PERFORMANCE_CCS.has(cc)) {
        // Mod wheel and friends: send zone-wide so per-channel MPE voices react.
        midiManager.sendControlChangeAllChannels(cc, value);
      } else {
        midiManager.sendControlChange(cc, value); // Forward CC to MIDI output
      }
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

  // The engine holds its own copy of the params, so anything that changes them
  // without going through the settings panel would otherwise never reach it.
  // Keeping this in one place means the engine can't drift from the UI.
  useEffect(() => {
    if (engine) engine.params = params;
  }, [engine, params]);

  // Velocity envelope -> pitch bend and CC1, at the tail of the MIDI chain.
  // Pitch is published as an offset the MIDI layer adds to the glide engine's
  // own bend, so the two never write to the same place.
  useEffect(() => {
    velMod.onPitchOffset = (semitones) => midiManager.setGlobalBendOffset(semitones);
    velMod.onCC1 = (value) => midiManager.sendControlChangeAllChannels(1, value);
    velMod.onCC80 = (value) => midiManager.sendControlChangeAllChannels(80, value);
    return () => {
      velMod.onPitchOffset = undefined;
      velMod.onCC1 = undefined;
      velMod.onCC80 = undefined;
    };
  }, [velMod, midiManager]);

  useEffect(() => { velMod.setParams(params); }, [velMod, params]);

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



  // Where the bend offset is allowed to go depends on MPE: only member
  // channels in MPE, only channel 1 outside it. Switching also has to drop the
  // channels the old mode registered, or the offset keeps going to notes that
  // are no longer there.
  useEffect(() => {
    midiManager.setGlobalBendOffset(0);
    midiManager.setMpeMode(params.mpeEnabled);
  }, [params.mpeEnabled, midiManager]);

  const bendUsers = params.mpeEnabled || params.velModEnabled || params.vibratoEnabled;
  useEffect(() => {
    if (!selectedOutput) return;
    if (params.mpeEnabled) {
      midiManager.setMpeBendRange(params.mpeBendRange);
    } else if (bendUsers) {
      // Velocity mod and vibrato bend too. Without telling the synth what a
      // bend unit is worth it keeps its +/-2 default while we compute against
      // the configured range, so the effect arrives a fraction of its size.
      // The MPE zone message stays out of it — that must remain MPE-only.
      midiManager.setBendRangeOnly(params.mpeBendRange);
    }
  }, [params.mpeEnabled, params.mpeBendRange, bendUsers, selectedOutput, midiManager]);

  // A plugin loaded after the configuration was sent never received it, so it
  // has to be re-sent by hand. This used to fire on window focus, but the bend
  // range RPN contains CC 6 — arming MIDI learn in a plugin and clicking back
  // into this window handed it a CC 6 to learn. Better to make it deliberate.
  const resendMpeConfig = useCallback(() => {
    if (!midiManager.selectedOutputId) return;
    if (paramsRef.current.mpeEnabled) midiManager.setMpeBendRange(paramsRef.current.mpeBendRange);
    else midiManager.setBendRangeOnly(paramsRef.current.mpeBendRange);
  }, [midiManager]);

  const panicAll = useCallback(() => {
    if (engine) engine.panic();
    synth.panic();
    midiManager.panic();
    velMod.allNotesOff();
    // Panic sends Reset All Controllers, which also clears the bend range the
    // synth was told to use — so restate it straight away.
    resendMpeConfig();
  }, [engine, synth, midiManager, velMod, resendMpeConfig]);

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
            if (event.isOn && event.velocity > 0) velMod.noteOn(event.velocity);
            else velMod.noteOff();
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
            panicAll();
          }}
        />
      )}
      <div className="ui-scale-viewport">
      <div
        className={`ui-scale-content ${showHelp ? '' : 'hide-help'}`}
        style={{ '--ui-scale': uiScale } as React.CSSProperties}
      >
      <header className="bg-[var(--surface)] border-b-[4px] border-[var(--wood)] px-4 lg:px-6 py-3 shadow-md">
        {/* One rail: brand, transport, devices and view controls all live in the
            same rectangle rather than three floating clusters. */}
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-x-4 gap-y-2 bg-[var(--surface-deep)] border border-white/5 rounded-sm px-3 py-2">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-[var(--accent)] border-2 border-[var(--ink)] flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
            </div>
            <h1 className="font-['Oswald'] font-bold text-xl uppercase tracking-tight leading-none hidden lg:block">MidiMOO</h1>
          </div>

          <button
            onClick={panicAll}
            className="analog-btn px-3 h-8 flex items-center justify-center bg-red-900/80 text-red-100 hover:bg-red-500 hover:text-white border-red-500 font-bold text-xs shrink-0"
            title="MIDI Panic (Stop All Notes)"
          >
            PANIC
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="label-meta shrink-0">IN</span>
            <select
              value={selectedInput}
              onChange={(e) => midiManager.selectInput(e.target.value)}
              className="bg-black text-[var(--accent)] border border-[#444] px-2 h-8 font-['Space_Mono'] text-[11px] rounded-sm outline-none min-w-0 w-[120px]"
            >
              <option value="">No Input</option>
              {inputs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="label-meta shrink-0">OUT</span>
            <select
              value={selectedOutput}
              onChange={(e) => midiManager.selectOutput(e.target.value)}
              className="bg-black text-[var(--accent)] border border-[#444] px-2 h-8 font-['Space_Mono'] text-[11px] rounded-sm outline-none min-w-0 w-[120px]"
            >
              <option value="">No Output</option>
              {outputs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          <button
            onClick={() => midiManager.refreshDevices().then(supported => setMidiSupported(supported))}
            className="analog-btn px-2 h-8 flex items-center justify-center shrink-0 !text-[10px]"
            title="Rescan MIDI devices"
          >
            REFRESH
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <span className="label-meta">MONITOR</span>
            <div
              className={`toggle-switch sm ${showMidiMonitor ? 'on' : ''}`}
              onClick={() => setShowMidiMonitor(!showMidiMonitor)}
            ></div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="label-meta">SYNTH</span>
            <div
              className={`toggle-switch sm ${isSynthEnabled ? 'on' : ''}`}
              onClick={handleEnableAudio}
            ></div>
            <input
              type="range"
              min="0" max="1" step="0.01"
              defaultValue="0.3"
              onChange={(e) => synth.setVolume(parseFloat(e.target.value))}
              className="range-sm w-16 accent-[var(--accent)]"
              title="Synth volume"
            />
          </div>

          {/* Pushes the view controls to the far end when there is room. */}
          <div className="hidden xl:block flex-1" />

          <div className="flex items-center gap-2 shrink-0 border-l border-white/10 pl-3">
            <button
              onClick={() => setShowHelp(v => !v)}
              className={`analog-btn w-8 h-8 flex items-center justify-center font-bold ${showHelp ? 'active' : ''}`}
              title={showHelp ? 'Hide parameter descriptions' : 'Show parameter descriptions'}
            >
              i
            </button>
            <button
              onClick={() => setShowKeyboard(v => !v)}
              className={`analog-btn w-8 h-8 flex items-center justify-center ${showKeyboard ? 'active' : ''}`}
              title={showKeyboard ? 'Hide performance keyboard' : 'Show performance keyboard'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="1"></rect><line x1="7" y1="6" x2="7" y2="13"></line><line x1="12" y1="6" x2="12" y2="13"></line><line x1="17" y1="6" x2="17" y2="13"></line></svg>
            </button>
            <button
              onClick={() => setShowMobileView(true)}
              className="analog-btn w-8 h-8 flex items-center justify-center bg-[var(--accent)] text-black"
              title="Mobile View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0 border-l border-white/10 pl-3">
            <button
              onClick={() => nudgeScale(-UI_SCALE_STEP)}
              className="analog-btn w-7 h-8 flex items-center justify-center font-bold"
              title="Smaller interface (Cmd -)"
            >
              −
            </button>
            <button
              onClick={() => setUiScale(1)}
              className="analog-btn px-2 h-8 flex items-center justify-center tabular-nums !text-[10px]"
              title="Reset interface size (Cmd 0)"
            >
              {Math.round(uiScale * 100)}%
            </button>
            <button
              onClick={() => nudgeScale(UI_SCALE_STEP)}
              className="analog-btn w-7 h-8 flex items-center justify-center font-bold"
              title="Larger interface (Cmd +)"
            >
              +
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

      <main className="grid grid-cols-1 xl:grid-cols-[320px_1fr] px-6 lg:px-8 py-5 gap-8 lg:gap-6 flex-1 min-h-0 overflow-hidden">
        <section className="settings-scroll flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
          <SettingsPanel engine={engine} params={params} setParams={setParams} onResendMpeConfig={resendMpeConfig} />
        </section>

        <section className="flex flex-col gap-8 lg:gap-6 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-1 xl:[grid-template-columns:var(--panel-cols)] gap-10 lg:gap-8"
               style={{ ['--panel-cols' as any]: panelColumns }}>
            <CollapsiblePanel title="CHORDS" collapsed={!!collapsedPanels.chords} onToggle={() => togglePanel('chords')}>
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
            </CollapsiblePanel>

            <CollapsiblePanel title="ARPEGGIO" collapsed={!!collapsedPanels.arp} onToggle={() => togglePanel('arp')}>
              {engine && <ArpeggioXYPad engine={engine} params={params} setParams={setParams} incomingCC={incomingCC} />}
            </CollapsiblePanel>

            <CollapsiblePanel title="VOICING" collapsed={!!collapsedPanels.voicing} onToggle={() => togglePanel('voicing')}>
              {engine && <VoicingPad engine={engine} params={params} setParams={setParams} />}
            </CollapsiblePanel>
          </div>

          {showKeyboard && (
            <div className="module bg-[var(--surface)] border-[4px] border-[var(--wood)] p-4 sm:p-8">
              <p className="label-meta mb-4">PERFORMANCE KEYBOARD — DIRECT BUS</p>
              <PerformanceKeyboard 
                engine={engine} 
                params={params} 
                activeNotes={activeNotes} 
              />
            </div>
          )}
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
      </div>
      </div>
    </>
  );
}

export default App;
