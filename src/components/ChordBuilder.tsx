import React, { useEffect, useRef, useState } from 'react';
import {
  BUILDER_EXTENSIONS, BUILDER_QUALITIES, BUILDER_ROOTS, BUILDER_SHAPES,
  BuilderQuality, BuilderShape, BuilderStage, buildChordSymbol, rootFromLetter, rootFromPitch,
} from '../lib/ChordBuilder';
import { notesFromC, parseChordSymbol } from '../lib/ChordSymbol';

interface Props {
  /** What is sounding on the keyboard, so a played note can name the root. */
  heldNotes?: number[];
  onCommit: (symbol: string) => void;
  onClose: () => void;
}

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * A chord built by choosing rather than typing.
 *
 * Root, then quality, then what it does with its seventh, then any tensions —
 * each a ring you pick from, so the spelling is assembled from tables that are
 * known to parse rather than written by hand. The root can also be played: a
 * note on the keyboard names it, which is quicker than reaching for a letter.
 */
export const ChordBuilder: React.FC<Props> = ({ heldNotes, onCommit, onClose }) => {
  const [stage, setStage] = useState<BuilderStage>('root');
  const [root, setRoot] = useState('');
  const [quality, setQuality] = useState<BuilderQuality | null>(null);
  const [shape, setShape] = useState<BuilderShape | null>(null);
  const [extensions, setExtensions] = useState<string[]>([]);

  const symbol = buildChordSymbol(root, shape, extensions);
  const parsed = symbol ? parseChordSymbol(symbol) : null;

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

  const back = () => {
    if (stage === 'extensions') { setExtensions([]); setStage('shape'); return; }
    if (stage === 'shape') { setShape(null); setQuality(null); setStage('quality'); return; }
    if (stage === 'quality') { setRoot(''); setStage('root'); return; }
    onClose();
  };

  const commit = () => {
    if (parsed) onCommit(symbol);
    onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
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

  const options: Array<{ id: string; label: string; on?: boolean; pick: () => void }> =
    stage === 'root' ? BUILDER_ROOTS.map(name => ({
      id: name, label: name,
      pick: () => { setRoot(name); setStage('quality'); },
    }))
    : stage === 'quality' ? BUILDER_QUALITIES.map(q => ({
      id: q.id, label: q.label,
      pick: () => {
        setQuality(q.id);
        const shapes = BUILDER_SHAPES[q.id];
        // A dominant has only one thing it can do with its seventh, so there is
        // nothing to ask about.
        if (shapes.length === 1) { setShape(shapes[0]); setStage('extensions'); }
        else setStage('shape');
      },
    }))
    : stage === 'shape' ? BUILDER_SHAPES[quality!].map(s => ({
      id: s.id, label: s.label,
      pick: () => { setShape(s); setStage('extensions'); },
    }))
    : BUILDER_EXTENSIONS.map(name => ({
      id: name, label: name,
      on: extensions.includes(name),
      pick: () => setExtensions(previous =>
        previous.includes(name) ? previous.filter(x => x !== name) : [...previous, name]),
    }));

  const prompt = stage === 'root' ? 'PLAY A NOTE, TYPE A LETTER, OR PICK ONE'
    : stage === 'quality' ? 'WHAT KIND OF CHORD'
    : stage === 'shape' ? 'WHAT IT DOES WITH ITS SEVENTH'
    : 'TENSIONS — PICK ANY, THEN ENTER';

  return (
    <div className="fixed inset-0 z-[10001] bg-black/80 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="module !bg-[var(--surface)] w-[560px] max-w-full flex flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="label-meta !text-[var(--accent)]">BUILD A CHORD</p>
          <div className="flex items-center gap-1">
            <button onClick={back} className="analog-btn !text-[9px] !px-2 !py-[3px]">BACK</button>
            <button onClick={onClose} className="analog-btn !text-[9px] !px-2 !py-[3px]">CLOSE</button>
          </div>
        </div>

        {/* The ring, with what has been built so far standing in the middle. */}
        <div className="relative w-full aspect-square max-h-[52vh] mx-auto" style={{ maxWidth: '52vh' }}>
          {options.map((option, i) => {
            const angle = (i / options.length) * Math.PI * 2 - Math.PI / 2;
            return (
              <button
                key={option.id}
                onClick={option.pick}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 font-['Space_Mono'] text-[11px] w-[74px] h-[74px] flex items-center justify-center px-1 leading-tight transition-colors ${
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
            <span className="font-['Oswald'] text-[clamp(1.4rem,5vw,2.4rem)] text-[var(--accent)] leading-none">
              {symbol || '—'}
            </span>
            {parsed && (
              <span className="font-['Space_Mono'] text-[11px] text-white/45">
                {notesFromC(parsed.intervals.map(i => (i + parsed.root) % 12))
                  .split(' ').filter((n, i, a) => a.indexOf(n) === i).join(' ')}
              </span>
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

        <p className="help-text label-meta !text-[0.6rem] opacity-70 leading-relaxed">
          ENTER TAKES WHAT IS BUILT, WHEREVER YOU ARE. BACKSPACE STEPS BACK, ESCAPE
          LEAVES. A NOTE PLAYED ON THE KEYBOARD NAMES THE ROOT; # OR b AFTER IT MOVES IT.
        </p>
      </div>
    </div>
  );
};

/** The pitch classes a symbol sounds, for the readout above. */
export const symbolNotes = (symbol: string): string => {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return '';
  const names = parsed.intervals.map(i => NOTE_NAMES[(i + parsed.root) % 12]);
  return names.filter((n, i) => names.indexOf(n) === i).join(' ');
};
