import React, { useState } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { randomPreset } from '../lib/ChordPresets';

const TRANSPOSE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

/** Move a chord symbol's root, leaving the quality after it alone. */
function transposeSymbol(symbol: string, semitones: number): string {
  const m = symbol.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return symbol;
  const base = NOTE_INDEX[m[1]];
  if (base === undefined) return symbol;
  return TRANSPOSE_NAMES[((base + semitones) % 12 + 12) % 12] + m[2];
}
import { parseProgression } from '../lib/ChordSymbol';

export type MemorySlot = {
  rootPitch: number;
  baseType: number;
  ext_m7: boolean;
  ext_M7: boolean;
  ext_6: boolean;
  ext_9: boolean;
  customVoicing?: number[];
  // Set when the slot came from a pasted chord symbol. The intervals are what
  // the chord is built from, so it still follows register, inversion and the
  // voicing disk rather than being frozen the way customVoicing is.
  symbol?: string;
  chordIntervals?: number[];
} | null;

interface MemorySlotsProps {
  engine: OrchidEngine | null;
  slots: MemorySlot[];
  playingSlotIndices: number[];
  onPlaySlot: (index: number) => void;
  onStopSlot: (index: number) => void;
  onSaveSlot: (index: number, chord: MemorySlot | null) => void;
  onUpdateSlots: (slots: MemorySlot[]) => void;
  lastPlayedChord?: MemorySlot | null;
  hideHeader?: boolean;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  activeEditSlotIndex: number | null;
  onSelectEditSlot: (index: number) => void;
  memoryVelocity: number;
  onMemoryVelocityChange: (vel: number) => void;
  isFreeEditMode: boolean;
  onToggleFreeEditMode: () => void;
  armedSlotIndex: number | null;
  onArmSlot: (index: number) => void;
  followRegister: boolean;
  onToggleFollowRegister: () => void;
  momentary: boolean;
  onToggleMomentary: () => void;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BASE_NAMES = ["MAJ", "MIN", "SUS/Q", "DIM"];

function formatSlot(slot: MemorySlot, isEditMode: boolean, lastPlayedChord?: MemorySlot | null) {
  if (!slot) {
    return (lastPlayedChord && !isEditMode) ? "SAVE" : "EMPTY";
  }

  // A pasted chord shows the symbol it was written as.
  if (slot.symbol) return slot.symbol;
  
  if (slot.customVoicing && slot.customVoicing.length > 0) {
     const sorted = [...slot.customVoicing].sort((a,b) => a-b);
     const root = NOTE_NAMES[sorted[0] % 12];
     return `${root} CUST`;
  }
  
  const note = NOTE_NAMES[slot.rootPitch % 12];
  const base = slot.baseType >= 0 ? BASE_NAMES[slot.baseType] : "MAJ";
  
  let exts = "";
  if (slot.ext_m7) exts += " m7";
  if (slot.ext_M7) exts += " M7";
  if (slot.ext_6) exts += " 6";
  if (slot.ext_9) exts += " 9";
  
  return `${note} ${base}${exts}`;
}

export function MemorySlots({ engine, slots, playingSlotIndices, onPlaySlot, onStopSlot, onSaveSlot, onUpdateSlots, lastPlayedChord, hideHeader, isEditMode, onToggleEditMode, activeEditSlotIndex, onSelectEditSlot, memoryVelocity, onMemoryVelocityChange, isFreeEditMode, onToggleFreeEditMode, armedSlotIndex, onArmSlot, followRegister, onToggleFollowRegister, momentary, onToggleMomentary }: MemorySlotsProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [pasteStatus, setPasteStatus] = useState<string | null>(null);
  const [presetTitle, setPresetTitle] = useState<string | null>(null);
  const [editorText, setEditorText] = useState<string | null>(null);

  /**
   * Open the pads as text. What is shown is what is on them — a chord saved by
   * hand has no symbol to show, so it is written as the notes it holds, and
   * those come back unchanged if that line is left alone.
   */
  const openEditor = () => {
    setEditorText(slots.map(slot => {
      if (!slot) return '-';
      if (slot.symbol) return slot.symbol;
      if (slot.customVoicing?.length) return `[${slot.customVoicing.join('.')}]`;
      return '-';
    }).join(' '));
  };

  const applyEditor = (text: string) => {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    const next: MemorySlot[] = Array(8).fill(null);
    const unreadable: string[] = [];

    tokens.slice(0, 8).forEach((token, i) => {
      if (token === '-') return;
      // A voicing written as its notes goes back exactly as it was.
      const notes = token.match(/^\[([\d.]+)\]$/);
      if (notes) {
        const list = notes[1].split('.').map(Number).filter(n => n >= 0 && n <= 127);
        if (list.length) {
          next[i] = {
            rootPitch: list[0] % 12, baseType: 0,
            ext_m7: false, ext_M7: false, ext_6: false, ext_9: false,
            customVoicing: list.sort((a, b) => a - b),
          };
          return;
        }
      }
      const { chords, rejected } = parseProgression(token);
      if (chords.length === 0) { unreadable.push(...(rejected.length ? rejected : [token])); return; }
      const c = chords[0];
      next[i] = {
        rootPitch: 60 + c.root, baseType: -1,
        ext_m7: false, ext_M7: false, ext_6: false, ext_9: false,
        symbol: c.symbol, chordIntervals: c.intervals,
      };
    });

    onUpdateSlots(next);
    setPasteStatus(unreadable.length ? `UNREADABLE: ${unreadable.slice(0, 3).join(' ')}` : null);
    setEditorText(null);
  };

  /**
   * Move every saved chord by the same interval. The notes are rewritten rather
   * than offset at playback, so the pads show where they now are and a second
   * press moves them again from there.
   */
  const transposeAll = (semitones: number) => {
    const shift = (n: number) => Math.max(0, Math.min(127, n + semitones));
    onUpdateSlots(slots.map(slot => {
      if (!slot) return slot;
      const next = { ...slot, rootPitch: ((slot.rootPitch + semitones) % 12 + 12) % 12 };
      if (slot.customVoicing) next.customVoicing = slot.customVoicing.map(shift);
      // The symbol names the chord that was saved, and it is no longer that
      // chord, so it goes rather than sitting there wrong.
      if (slot.symbol) next.symbol = transposeSymbol(slot.symbol, semitones);
      return next;
    }));
  };

  /**
   * Fill the pads from one of the bundled progressions. The chords are kept as
   * the notes they were written with rather than as a name, so what lands on the
   * pad is the voicing itself — which is the whole reason for taking them from
   * played progressions in the first place. With FOLLOW REG on they still move
   * with the register slider.
   */
  const loadPreset = () => {
    const preset = randomPreset(presetTitle ?? undefined);
    setPresetTitle(preset.title);
    const next: MemorySlot[] = slots.map((_, i) => {
      const chord = preset.chords[i];
      if (!chord) return null;
      return {
        rootPitch: chord.notes[0] % 12,
        baseType: 0,
        ext_m7: false, ext_M7: false, ext_6: false, ext_9: false,
        customVoicing: [...chord.notes],
        symbol: chord.symbol,
      };
    });
    onUpdateSlots(next);
  };
  // Reading the clipboard needs the document focused and the permission
  // granted; when that fails there has to be somewhere to paste by hand
  // rather than a dead end.
  const [pasteFallback, setPasteFallback] = useState(false);

  const applyProgression = (text: string) => {
    const { chords, rejected } = parseProgression(text);
    if (chords.length === 0) {
      setPasteStatus(rejected.length ? `UNREADABLE: ${rejected.slice(0, 3).join(' ')}` : 'NOTHING TO PASTE');
      return;
    }
    // Fill what came in and leave the rest of the pads alone-empty.
    const next: MemorySlot[] = Array(8).fill(null);
    chords.slice(0, 8).forEach((c, i) => {
      next[i] = {
        rootPitch: 60 + c.root,
        baseType: -1,
        ext_m7: false, ext_M7: false, ext_6: false, ext_9: false,
        symbol: c.symbol,
        chordIntervals: c.intervals,
      };
    });
    onUpdateSlots(next);
    setPasteStatus(
      rejected.length
        ? `${Math.min(chords.length, 8)} PASTED, SKIPPED: ${rejected.slice(0, 3).join(' ')}`
        : `${Math.min(chords.length, 8)} CHORDS PASTED`
    );
    setPasteFallback(false);
  };

  const pasteProgression = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setPasteStatus('CLIPBOARD IS EMPTY'); return; }
      applyProgression(text);
    } catch {
      setPasteStatus('PASTE HERE WITH CMD-V');
      setPasteFallback(true);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    
    const newSlots = [...slots];
    const item = newSlots[draggedIndex];
    newSlots.splice(draggedIndex, 1);
    newSlots.splice(targetIndex, 0, item);
    onUpdateSlots(newSlots);
    setDraggedIndex(null);
  };

  return (
    <div className="module bg-[var(--surface-deep)] border border-white/10 p-4 rounded-sm flex flex-col gap-3">
      {editorText !== null && (
        <div
          className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-6"
          onClick={() => setEditorText(null)}
        >
          <div
            className="module w-[620px] max-w-full flex flex-col gap-3 !bg-[var(--surface)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="label-meta">MEMORY PADS AS TEXT</p>
            <textarea
              autoFocus
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) applyEditor(editorText);
                if (e.key === 'Escape') setEditorText(null);
              }}
              spellCheck={false}
              rows={3}
              className="w-full bg-black text-[var(--accent)] border border-[#444] px-2 py-2 font-['Space_Mono'] text-[12px] rounded-sm outline-none resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
                ONE CHORD TO A PAD, SEPARATED BY SPACES — Cmaj7 Dm7 G7(b9). A DASH LEAVES
                A PAD EMPTY. A VOICING SAVED BY HAND HAS NO NAME TO SHOW, SO IT APPEARS AS
                ITS NOTES IN BRACKETS AND COMES BACK UNCHANGED IF LEFT ALONE.
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditorText(null)} className="analog-btn !text-[9px] !px-2 !py-[3px]">CANCEL</button>
                <button onClick={() => applyEditor(editorText)} className="analog-btn active !text-[9px] !px-3 !py-[3px]">APPLY</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        {!hideHeader && (
          <div className="flex items-center gap-4 flex-wrap">
             {/* A hand-played voicing normally sits at the exact notes it was
                 played at. Following the register lets the same voicing be
                 tried an inversion or a register away without re-recording it. */}
             <div className="flex items-center gap-2" title="Saved voicings follow the CHORD START slider, inverting as it rises">
                <span className="label-meta !text-[9px] whitespace-nowrap">FOLLOW REG</span>
                <div
                  className={`toggle-switch sm ${followRegister ? 'on' : ''}`}
                  onClick={onToggleFollowRegister}
                ></div>
             </div>
             <div className="flex items-center gap-2" title="On, a pad sounds for as long as it is held. Off, a pad latches: press to start it, press again to stop it">
                <span className="label-meta !text-[9px] whitespace-nowrap">MOMENTARY</span>
                <div
                  className={`toggle-switch sm ${momentary ? 'on' : ''}`}
                  onClick={onToggleMomentary}
                ></div>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#888]">VEL</span>
                <input 
                  type="range" min="1" max="127" 
                  value={memoryVelocity}
                  onChange={(e) => onMemoryVelocityChange(parseInt(e.target.value))}
                  className="range-sm w-16 accent-[var(--accent)]"
                />
             </div>
             <button
                onClick={openEditor}
                className="analog-btn !py-1 !px-2 !text-[9px]"
                title="Type the pads out as text"
             >
                EDIT TEXT
             </button>

             <div className="flex items-center gap-1" title="Move every saved chord">
                <span className="label-meta !text-[9px] whitespace-nowrap">TRANSPOSE</span>
                {([['-12', -12], ['-1', -1], ['+1', 1], ['+12', 12]] as const).map(([label, by]) => (
                   <button
                      key={label}
                      onClick={() => transposeAll(by)}
                      className="analog-btn !text-[9px] !px-[6px] !py-[3px]"
                   >
                      {label}
                   </button>
                ))}
             </div>

             <button
                onClick={loadPreset}
                className="analog-btn !py-1 !px-2 !text-[9px]"
                title="Fill the pads with the chords of a randomly chosen progression"
             >
                PRESET
             </button>
             {presetTitle && (
                <span className="label-meta !text-[9px] !text-[var(--accent)] whitespace-nowrap" title={presetTitle}>
                   {presetTitle.length > 28 ? presetTitle.slice(0, 28) + '…' : presetTitle}
                </span>
             )}
             {isEditMode && (
                <button
                   onClick={pasteProgression}
                   className="analog-btn ml-4 !py-1 !px-2 !text-[9px]"
                   title="Read chord symbols from the clipboard into the pads"
                >
                   PASTE CHORDS
                </button>
             )}
             {isEditMode && pasteFallback && (
                <input
                   autoFocus
                   type="text"
                   placeholder="Cmaj7 Dm7 G7…"
                   className="ml-2 bg-black text-[var(--accent)] border border-[#444] px-2 py-1 font-['Space_Mono'] text-[10px] rounded-sm outline-none w-56"
                   onPaste={(e) => {
                      const text = e.clipboardData.getData('text');
                      if (text) { e.preventDefault(); applyProgression(text); }
                   }}
                   onKeyDown={(e) => {
                      if (e.key === 'Enter') applyProgression((e.target as HTMLInputElement).value);
                      if (e.key === 'Escape') { setPasteFallback(false); setPasteStatus(null); }
                   }}
                />
             )}
             {isEditMode && pasteStatus && (
                <span className="label-meta !text-[9px] !text-[var(--accent)] ml-2 whitespace-nowrap" title={pasteStatus}>
                   {pasteStatus}
                </span>
             )}
             {isEditMode && (
                <div className="flex items-center gap-2 ml-4">
                   <span className="label-meta text-[10px]">FREE EDIT</span>
                   <div 
                      className={`toggle-switch ${isFreeEditMode ? 'on' : ''}`}
                      onClick={onToggleFreeEditMode}
                   ></div>
                </div>
             )}
          </div>
        )}
        {hideHeader && <span />}
        <button 
          onClick={onToggleEditMode}
          className={`flex items-center justify-center w-6 h-6 rounded-sm border transition-colors ${isEditMode ? 'bg-[var(--accent)] border-[var(--accent)] text-black' : 'bg-transparent border-[#444] text-[#888] hover:text-white hover:border-white'}`}
          title="Edit Memory Slots (Drag to reorder, click X to clear)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {slots.map((slot, i) => {
          const isPlaying = playingSlotIndices.includes(i);
          return (
            <div 
              key={i} 
              className={`relative flex flex-col gap-1 ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
            >
              <button
                className={`analog-btn h-12 text-xs flex items-center justify-center font-['Space_Mono'] leading-tight px-1
                  ${isPlaying ? '!bg-white !text-black !border-[var(--ink)] shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''}
                  ${slot && !isPlaying && !isEditMode ? '!bg-[var(--accent)] !text-black !border-[var(--ink)]' : ''}
                  ${isEditMode && !isPlaying && activeEditSlotIndex !== i ? '!bg-[#222] !border-[#444] !text-[#888]' : ''}
                  ${isEditMode && activeEditSlotIndex === i ? '!bg-white !text-black shadow-[0_0_15px_rgba(255,255,255,0.8)]' : ''}
                  ${isEditMode && draggedIndex === i ? 'opacity-50' : ''}
                `}
                onPointerDown={(e) => {
                  if (isEditMode) {
                     onSelectEditSlot(i);
                     return;
                  }
                  e.preventDefault();
                  // Capture the pointer so the release is delivered here even if
                  // it happens off the pad or outside the window. Without it a
                  // press that ends elsewhere never sends its note-off, and the
                  // key stays held for good — which among other things stops a
                  // free edit ever finishing, since it waits for every key to be
                  // let go.
                  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not fatal */ }
                  if (engine && slot) {
                    if (!momentary && isPlaying) {
                      engine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, slot.customVoicing, slot.chordIntervals);
                      onStopSlot(i);
                      return;
                    }
                    engine.setModifiers(slot.baseType, slot.ext_m7, slot.ext_M7, slot.ext_6, slot.ext_9);
                    engine.handleMidi(slot.rootPitch, memoryVelocity, true, false, false, false, true, slot.customVoicing, slot.chordIntervals);
                    onPlaySlot(i);
                  } else if (!slot && lastPlayedChord) {
                    onSaveSlot(i, lastPlayedChord);
                  }
                }}
                onPointerUp={(e) => {
                  if (isEditMode || !momentary) return;
                  e.preventDefault();
                  if (engine && slot) {
                    engine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, slot.customVoicing, slot.chordIntervals);
                    onStopSlot(i);
                  }
                }}
                onPointerLeave={(e) => {
                  if (isEditMode || !momentary) return;
                  e.preventDefault();
                  if (engine && slot) {
                    engine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, slot.customVoicing, slot.chordIntervals);
                    onStopSlot(i);
                  }
                }}
                onPointerCancel={(e) => {
                  // A cancelled gesture would otherwise leave the chord sounding
                  // and the key held. A latched pad is meant to stay sounding. A latched pad is meant to stay sounding.
                  if (isEditMode || !momentary) return;
                  e.preventDefault();
                  if (engine && slot) {
                    engine.handleMidi(slot.rootPitch, 0, false, false, false, false, true, slot.customVoicing, slot.chordIntervals);
                    onStopSlot(i);
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {formatSlot(slot, isEditMode, lastPlayedChord)}
              </button>
              
              {isEditMode && slot && (
                <button 
                  // Inside the pad rather than hanging off it: at a negative
                  // offset the badge of one row reached into the pad above it,
                  // and the two collided in the gap between rows.
                  className="absolute top-[3px] right-[3px] w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-black shadow-md border border-black z-10"
                  onClick={(e) => { e.stopPropagation(); onSaveSlot(i, null); }}
                  title="Clear slot"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
              {isEditMode && isFreeEditMode && (
                 <button
                    className={`mt-1 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center transition-colors border ${armedSlotIndex === i ? 'bg-red-500 border-red-400 text-black shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-[#222] border-[#444] text-[#888] hover:text-white'}`}
                    onClick={(e) => { e.stopPropagation(); onArmSlot(i); }}
                 >
                    {armedSlotIndex === i ? 'ARMED' : 'ARM'}
                 </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
