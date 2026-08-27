import React, { useMemo, useRef, useState } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { MemorySlot } from './MemorySlots';
import { ImportedChord, groupIntoChords, parseMidiFile, ParsedMidi } from '../lib/MidiImport';
import { nameChordFromPitches, parseChordSymbol } from '../lib/ChordSymbol';

interface Props {
  engine: OrchidEngine | null;
  memoryVelocity: number;
  onImport: (slots: MemorySlot[]) => void;
  onClose: () => void;
}

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const spell = (pitch: number) => `${NOTE_NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;

/**
 * Filling the pads from a MIDI file.
 *
 * The file is read into chords and every one of them is shown, because deciding
 * where a chord ends is the one part of this that involves judgement and the
 * ear is a better judge of it than the rule. Pick the eight you want, hear any
 * of them first, and they go to the pads in the order they were picked.
 *
 * What lands is the voicing as it was played, with a name attached where the
 * chord has one — so it reads on the pad, and the pads say what they share.
 */
export const MidiImportPanel: React.FC<Props> = ({ engine, memoryVelocity, onImport, onClose }) => {
  const [parsed, setParsed] = useState<ParsedMidi | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [spread, setSpread] = useState(180);
  const [chosen, setChosen] = useState<number[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const chords: ImportedChord[] = useMemo(
    () => (parsed ? groupIntoChords(parsed, spread) : []),
    [parsed, spread],
  );

  const read = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const found = parseMidiFile(bytes);
      if (found.notes.length === 0) { setProblem('NO NOTES IN THAT FILE'); return; }
      setParsed(found);
      setFileName(file.name);
      setChosen([]);
      setProblem(null);
    } catch (error) {
      setProblem(String((error as Error).message || error).toUpperCase());
    }
  };

  const audition = (chord: ImportedChord) => engine?.startAudition(chord.pitches, memoryVelocity);
  const silence = () => engine?.stopAudition();

  const toggle = (index: number) => {
    setChosen(previous => previous.includes(index)
      ? previous.filter(x => x !== index)
      // Eight pads, so the ninth pick is not taken silently.
      : previous.length >= 8 ? previous : [...previous, index]);
  };

  const send = () => {
    silence();
    const slots: MemorySlot[] = Array(8).fill(null);
    chosen.forEach((index, pad) => {
      const chord = chords[index];
      if (!chord) return;
      const name = nameChordFromPitches(chord.pitches);
      const named = name ? parseChordSymbol(name) : null;
      slots[pad] = {
        // The notes exactly as they were played; the name is for reading, and
        // for the chords the pads have in common.
        rootPitch: named ? 60 + named.root : chord.pitches[0] % 12,
        baseType: -1,
        ext_m7: false, ext_M7: false, ext_6: false, ext_9: false,
        customVoicing: [...chord.pitches],
        symbol: name ?? undefined,
      };
    });
    onImport(slots);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10001] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="module !bg-[var(--surface)] w-[720px] max-w-full max-h-[90vh] overflow-y-auto settings-scroll flex flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="label-meta !text-[var(--accent)]">IMPORT A MIDI FILE</p>
          <div className="flex items-center gap-1">
            <button onClick={() => fileInput.current?.click()} className="analog-btn !text-[9px] !px-3 !py-[4px]">
              CHOOSE FILE
            </button>
            <button onClick={() => { silence(); onClose(); }} className="analog-btn !text-[9px] !px-3 !py-[4px]">CLOSE</button>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".mid,.midi,audio/midi"
          className="hidden"
          onChange={(event) => { const file = event.target.files?.[0]; if (file) read(file); }}
        />

        {!parsed ? (
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) read(file);
            }}
            onClick={() => fileInput.current?.click()}
            className="h-40 border border-dashed border-white/20 rounded-[2px] flex flex-col items-center justify-center gap-2 cursor-pointer"
          >
            <span className="label-meta !text-[10px] opacity-60">DROP A .MID HERE, OR CLICK TO CHOOSE ONE</span>
            {problem && <span className="label-meta !text-[9px] !text-[#D9534F]">{problem}</span>}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap border-y border-white/10 py-2">
              <span className="label-meta !text-[9px] opacity-50 truncate max-w-[16rem]">{fileName}</span>
              <span className="label-meta !text-[9px] !text-[var(--accent)]">{chords.length} CHORDS</span>
              <div className="flex items-center gap-2 ml-auto" title="How far apart two notes can be and still be one chord. Widen it if a strummed chord has been split; narrow it if two chords have been run together.">
                <span className="label-meta !text-[9px]">SPREAD</span>
                <input
                  type="range" min={20} max={600} step={10}
                  value={spread}
                  onChange={(event) => { setSpread(parseInt(event.target.value, 10)); setChosen([]); }}
                  className="range-sm !w-28 shrink-0 accent-[var(--accent)]"
                />
                <span className="label-meta !text-[9px] !text-[var(--accent)] w-10 tabular-nums">{spread}MS</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 max-h-[46vh] overflow-y-auto settings-scroll pr-1">
              {chords.map((chord, index) => {
                const order = chosen.indexOf(index);
                const name = nameChordFromPitches(chord.pitches);
                return (
                  <button
                    key={index}
                    onClick={() => toggle(index)}
                    onPointerDown={() => audition(chord)}
                    onPointerUp={silence}
                    onPointerLeave={silence}
                    title="Hold to hear it, click to choose it"
                    className={`h-16 rounded-[2px] border-2 px-1 flex flex-col items-center justify-center gap-[2px] ${
                      order >= 0
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
                        : 'bg-[var(--surface-deep)] border-white/15 text-white/75'}`}
                  >
                    <span className="font-['Space_Mono'] text-[12px] leading-none">
                      {name ?? chord.pitches.map(spell).join(' ')}
                    </span>
                    <span className={`font-['Space_Mono'] text-[9px] leading-none ${order >= 0 ? 'text-black/60' : 'text-white/35'}`}>
                      {name ? chord.pitches.map(spell).join(' ') : 'UNNAMED'}
                    </span>
                    {order >= 0 && <span className="label-meta !text-[8px] !text-black">PAD {order + 1}</span>}
                  </button>
                );
              })}
            </div>

            <p className="help-text label-meta !text-[0.6rem] opacity-70 leading-relaxed">
              HOLD A CHORD TO HEAR IT, CLICK TO SEND IT TO THE NEXT PAD. THE NOTES ARRIVE
              AS THEY WERE PLAYED, WITH THE NAME ATTACHED WHERE THE CHORD HAS ONE. A
              STRUMMED CHORD IS SPREAD OVER A MOMENT RATHER THAN STRUCK AT ONE, SO IF ONE
              HAS BEEN SPLIT INTO SEVERAL, WIDEN THE SPREAD.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={send}
                disabled={chosen.length === 0}
                className={`analog-btn flex-1 !py-3 !text-[11px] tracking-[0.2em] ${chosen.length ? 'active' : 'opacity-40'}`}
              >
                SEND {chosen.length || ''} TO MEMORY PADS
              </button>
              <button onClick={() => setChosen([])} className="analog-btn !px-4 !py-3 !text-[11px] tracking-[0.2em]">
                CLEAR
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
