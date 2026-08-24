import React from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { OrchidParams } from '../types';

interface KeyboardProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  activeNotes: number[];
  numKeysOverride?: number;
}

export function PerformanceKeyboard({ engine, params, activeNotes, numKeysOverride }: KeyboardProps) {
  // An octave, always. The keyboard is for placing a chord, not for playing a
  // range, and it used to follow a slider that no longer exists.
  const numKeys = numKeysOverride ?? 12;
  const startPitch = params.chordRegisterStart;
  
  let totalWhiteKeys = 0;
  for (let i = 0; i < numKeys; i++) {
    if (![1, 3, 6, 8, 10].includes((startPitch + i) % 12)) totalWhiteKeys++;
  }
  const whiteKeyWidth = 100 / totalWhiteKeys;

  return (
    <div className="flex h-32 sm:h-40 bg-[#111] border border-black relative select-none touch-none w-full">
      {Array.from({ length: numKeys }).map((_, i) => {
        const pitch = startPitch + i;
        const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
        const active = activeNotes.includes(pitch);
        
        if (isBlack) return null;

        return (
          <div
            key={`white-${pitch}`}
            onPointerDown={(e) => { e.preventDefault(); engine?.handleMidi(pitch, 100, true); }}
            onPointerUp={(e) => { e.preventDefault(); engine?.handleMidi(pitch, 0, false); }}
            onPointerLeave={(e) => { e.preventDefault(); engine?.handleMidi(pitch, 0, false); }}
            onPointerCancel={(e) => { e.preventDefault(); engine?.handleMidi(pitch, 0, false); }}
            className={`flex-1 border border-[#999] rounded-b-md cursor-pointer transition-colors
              ${active ? 'bg-[var(--accent)]' : 'bg-gradient-to-b from-[#eee] to-[#ccc]'}
            `}
          />
        );
      })}
      {Array.from({ length: numKeys }).map((_, i) => {
        const pitch = startPitch + i;
        const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
        const active = activeNotes.includes(pitch);
        
        if (!isBlack) return null;

        let whiteIndex = 0;
        for (let j = 0; j < i; j++) {
          if (![1, 3, 6, 8, 10].includes((startPitch + j) % 12)) whiteIndex++;
        }

        return (
          <div
            key={`black-${pitch}`}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); engine?.handleMidi(pitch, 100, true); }}
            onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); engine?.handleMidi(pitch, 0, false); }}
            onPointerLeave={(e) => { e.preventDefault(); e.stopPropagation(); engine?.handleMidi(pitch, 0, false); }}
            onPointerCancel={(e) => { e.preventDefault(); e.stopPropagation(); engine?.handleMidi(pitch, 0, false); }}
            className={`absolute top-0 border border-black rounded-b-sm cursor-pointer z-10 h-[60%]
              ${active ? 'bg-[var(--accent)]' : 'bg-gradient-to-b from-[#444] to-[#111]'}
            `}
            style={{ 
              left: `${whiteIndex * whiteKeyWidth}%`,
              width: `${whiteKeyWidth * 0.6}%`,
              marginLeft: `-${whiteKeyWidth * 0.3}%`
            }}
          />
        );
      })}
    </div>
  );
}
