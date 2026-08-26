import React, { useEffect, useRef, useState } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { MemorySlot } from './MemorySlots';
import {
  BUILDER_EXTENSIONS, BUILDER_QUALITIES, BUILDER_ROOTS, BUILDER_SHAPES,
  BuilderQuality, BuilderShape, buildChordSymbol, rootFromLetter, rootFromPitch,
} from '../lib/ChordBuilder';
import { parseChordSymbol } from '../lib/ChordSymbol';

interface Props {
  engine: OrchidEngine | null;
  slots: MemorySlot[];
  memoryVelocity: number;
  /** What is sounding on the keyboard, so a played note can name the root. */
  heldNotes?: number[];
  onCommit: (index: number, symbol: string) => void;
  onClose: () => void;
}

type Stage = 'pad' | 'root' | 'quality' | 'shape' | 'extensions';

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const notesOf = (symbol: string): string => {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return '';
  const names = parsed.intervals.map(i => NOTE_NAMES[(i + parsed.root) % 12]);
  return names.filter((n, i) => names.indexOf(n) === i).join(' ');
};

/**
 * A chord built by choosing rather than typing, straight onto a pad.
 *
 * Pick the pad, then the root, the quality, what it does with its seventh, and
 * any tensions — each a ring, so the spelling is assembled from tables that are
 * known to parse rather than written by hand.
 *
 * Left click takes an option and moves on. Right click plays it instead: what
 * is built so far with that option added, so a chord can be heard before it is
 * chosen rather than after.
 */
export const ChordBuilder: React.FC<Props> = ({
  engine, slots, memoryVelocity, heldNotes, onCommit, onClose,
}) => {
  const [padIndex, setPadIndex] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>('pad');
  const [root, setRoot] = useState('');
  const [quality, setQuality] = useState<BuilderQuality | null>(null);
  const [shape, setShape] = useState<BuilderShape | null>(null);
  const [extensions, setExtensions] = useState<string[]>([]);

  const symbol = buildChordSymbol(root, shape, extensions);
  const parsed = symbol ? parseChordSymbol(symbol) : null;

  // ---- auditioning -------------------------------------------------------
  const sounding = useRef<{ root: number; intervals: number[] } | null>(null);
  const stopTimer = useRef<any>(null);

  const silence = () => {
    clearTimeout(stopTimer.current);
    const held = sounding.current;
    sounding.current = null;
    if (held && engine) {
      engine.handleMidi(60 + held.root, 0, false, false, false, false, true, undefined, held.intervals);
    }
  };

  /** Play a symbol for as long as it takes to hear it, then let it go. */
  const audition = (candidate: string) => {
    const heard = parseChordSymbol(candidate);
    if (!heard || !engine) return;
    silence();
    engine.handleMidi(60 + heard.root, memoryVelocity, true, false, false, false, true, undefined, heard.intervals);
    sounding.current = { root: heard.root, intervals: heard.intervals };
    stopTimer.current = setTimeout(silence, 900);
  };

  useEffect(() => silence, []);

  // A note played while the root is being chosen names it. Watched for arrivals
  // rather than read outright, so a chord already down does not choose for you.
  const previousHeld = useRef<number[]>(heldNotes ?? []);
  useEffect(() => {
    const now = heldNotes ?? [];
    const arrived = now.find(note => !previousHeld.current.includes(note));
    previousHeld.current = now;
    if (arrived !== undefined && stage === 'root') {
      setRoot(rootFromPitch(arrived));
      setStage('quality');
    }
  }, [heldNotes, stage]);

  const startOn = (index: number) => {
    silence();
    setPadIndex(index);
    setRoot(''); setQuality(null); setShape(null); setExtensions([]);
    setStage('root');
  };

  const back = () => {
    silence();
    if (stage === 'extensions') { setExtensions([]); setStage('shape'); return; }
    if (stage === 'shape') { setShape(null); setQuality(null); setStage('quality'); return; }
    if (stage === 'quality') { setRoot(''); setStage('root'); return; }
    if (stage === 'root') { setPadIndex(null); setStage('pad'); return; }
    onClose();
  };

  const commit = () => {
    silence();
    if (parsed && padIndex !== null) onCommit(padIndex, symbol);
    onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); silence(); onClose(); return; }
      if (event.key === 'Enter') { event.preventDefault(); commit(); return; }
      if (event.key === 'Backspace') { event.preventDefault(); back(); return; }
      if (stage === 'root') {
        const named = rootFromLetter(event.key);
        if (named) { event.preventDefault(); setRoot(named); setStage('quality'); }
        return;
      }
      // An accidental applies to the root already chosen, so it can be typed
      // after the letter the way it is written.
      if ((event.key === '#' || event.key === 'b') && root) {
        event.preventDefault();
        setRoot(root[0] + (event.key === '#' ? '#' : 'b'));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  /** Each ring option: what it says, what taking it does, and what it sounds like. */
  const options: Array<{ id: string; label: string; on?: boolean; take: () => void; hear: string }> =
    stage === 'root' ? BUILDER_ROOTS.map(name => ({
      id: name, label: name,
      take: () => { setRoot(name); setStage('quality'); },
      hear: `${name}maj`,
    }))
    : stage === 'quality' ? BUILDER_QUALITIES.map(q => ({
      id: q.id, label: q.label,
      take: () => {
        setQuality(q.id);
        const shapes = BUILDER_SHAPES[q.id];
        // A dominant has only one thing it can do with its seventh, so there is
        // nothing to ask about.
        if (shapes.length === 1) { setShape(shapes[0]); setStage('extensions'); }
        else setStage('shape');
      },
      // The plainest chord of that kind, which is what the ring is offering.
      hear: buildChordSymbol(root, BUILDER_SHAPES[q.id][0]),
    }))
    : stage === 'shape' ? BUILDER_SHAPES[quality!].map(s => ({
      id: s.id, label: s.label,
      take: () => { setShape(s); setStage('extensions'); },
      hear: buildChordSymbol(root, s),
    }))
    : BUILDER_EXTENSIONS.map(name => ({
      id: name, label: name,
      on: extensions.includes(name),
      take: () => setExtensions(previous =>
        previous.includes(name) ? previous.filter(x => x !== name) : [...previous, name]),
      // What it would sound like with this one added, whether or not it is on.
      hear: buildChordSymbol(root, shape, extensions.includes(name) ? extensions : [...extensions, name]),
    }));

  const prompt = stage === 'pad' ? 'CHOOSE A PAD TO BUILD ONTO'
    : stage === 'root' ? 'PLAY A NOTE, TYPE A LETTER, OR PICK ONE'
    : stage === 'quality' ? 'WHAT KIND OF CHORD'
    : stage === 'shape' ? 'WHAT IT DOES WITH ITS SEVENTH'
    : 'TENSIONS — PICK ANY, THEN ENTER';

  return (
    <div className="fixed inset-0 z-[10001] bg-black/80 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="module !bg-[var(--surface)] w-[600px] max-w-full flex flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="label-meta !text-[var(--accent)]">BUILD A CHORD</p>
          <div className="flex items-center gap-1">
            <button onClick={back} className="analog-btn !text-[9px] !px-2 !py-[3px]">BACK</button>
            <button onClick={() => { silence(); onClose(); }} className="analog-btn !text-[9px] !px-2 !py-[3px]">CLOSE</button>
          </div>
        </div>

        {/* The pads stay in view, so it is always clear which one is being
            built and what the rest already hold. */}
        <div className="grid grid-cols-4 gap-1">
          {slots.map((slot, i) => (
            <button
              key={i}
              onClick={() => startOn(i)}
              className={`h-9 rounded-[2px] border font-['Space_Mono'] text-[10px] px-1 truncate ${
                padIndex === i
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
                  : slot
                    ? 'bg-[var(--surface-deep)] border-white/25 text-white/70'
                    : 'bg-[var(--surface-deep)] border-white/10 text-white/30'}`}
            >
              {padIndex === i && symbol ? symbol : slot?.symbol ?? (slot ? '••••' : 'EMPTY')}
            </button>
          ))}
        </div>

        {stage === 'pad' ? (
          <div className="h-[220px] flex items-center justify-center">
            <span className="label-meta !text-[9px] opacity-50">{prompt}</span>
          </div>
        ) : (
          <div className="relative w-full aspect-square max-h-[46vh] mx-auto" style={{ maxWidth: '46vh' }}>
            {options.map((option, i) => {
              const angle = (i / options.length) * Math.PI * 2 - Math.PI / 2;
              return (
                <button
                  key={option.id}
                  onClick={option.take}
                  onContextMenu={(event) => { event.preventDefault(); audition(option.hear); }}
                  title={`${option.hear} — right click to hear it`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 font-['Space_Mono'] text-[11px] w-[68px] h-[68px] flex items-center justify-center px-1 leading-tight transition-colors ${
                    option.on
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
                      : 'bg-[var(--surface-deep)] border-white/20 text-white/80 hover:border-[var(--accent)]'}`}
                  style={{
                    left: `${50 + Math.cos(angle) * 37}%`,
                    top: `${50 + Math.sin(angle) * 37}%`,
                  }}
                >
                  {option.label}
                </button>
              );
            })}

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none px-16 text-center">
              <span className="font-['Oswald'] text-[clamp(1.3rem,4.5vw,2.2rem)] text-[var(--accent)] leading-none">
                {symbol || '—'}
              </span>
              {parsed && (
                <span className="font-['Space_Mono'] text-[11px] text-white/45">{notesOf(symbol)}</span>
              )}
              <span className="label-meta !text-[8px] opacity-45 mt-1 leading-relaxed">{prompt}</span>
            </div>

            {stage === 'extensions' && (
              <button
                onClick={commit}
                className="absolute left-1/2 bottom-0 -translate-x-1/2 analog-btn active !text-[10px] !px-5 !py-2 tracking-[0.18em]"
              >
                ENTER
              </button>
            )}
          </div>
        )}

        <p className="help-text label-meta !text-[0.6rem] opacity-70 leading-relaxed">
          RIGHT CLICK AN OPTION TO HEAR WHAT IS BUILT SO FAR WITH IT ADDED; LEFT CLICK
          TAKES IT. ENTER SAVES TO THE PAD, WHEREVER YOU ARE. BACKSPACE STEPS BACK,
          ESCAPE LEAVES. A NOTE PLAYED NAMES THE ROOT; # OR b AFTER IT MOVES IT.
        </p>
      </div>
    </div>
  );
};
