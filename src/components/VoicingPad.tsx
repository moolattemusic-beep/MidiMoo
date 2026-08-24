import React, { useRef, useState, useEffect } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { OrchidParams } from '../types';
import { ColourMatrix } from './ColourMatrix';

interface VoicingPadProps {
  engine: OrchidEngine;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
}

export function VoicingPad({ engine, params, setParams }: VoicingPadProps) {
  const [showMatrix, setShowMatrix] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pos, setPos] = useState({ x: engine.params.voicingX, y: engine.params.voicingY });

  useEffect(() => {
    setPos({ x: params.voicingX, y: params.voicingY });
  }, [params.voicingX, params.voicingY]);

  const updatePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    let nx = (clientX - rect.left - centerX) / (rect.width / 2);
    let ny = (clientY - rect.top - centerY) / (rect.height / 2);

    const distance = Math.sqrt(nx * nx + ny * ny);
    if (distance > 1) {
      nx = nx / distance;
      ny = ny / distance;
    }

    setPos({ x: nx, y: ny });
    const newParams = { ...params, voicingX: nx, voicingY: ny };
    setParams(newParams);
    engine.params = newParams;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const thumbX = `${((pos.x + 1) / 2) * 100}%`;
  const thumbY = `${((pos.y + 1) / 2) * 100}%`;

  return (
    <div className="module flex flex-col items-center">
      {showMatrix && (
        <ColourMatrix
          params={params}
          setParams={setParams}
          engine={engine}
          onClose={() => setShowMatrix(false)}
        />
      )}
      <p className="label-meta self-start mb-3">VOICING DISK</p>

      {/* Dry to rich. Each quality takes its tensions in the order it wants
          them, so one control walks a triad out to the sort of chord a harp or
          a guitar is usually voiced with. */}
      <div className="w-full mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="label-meta">COLOUR</span>
          <div className="flex items-center gap-2">
            <span className="label-meta !text-[var(--accent)]">
              {(() => {
                const n = Math.max(0, Math.min(6, params.chordColor ?? 0));
                return n === 0 ? 'DRY' : `+${n}`;
              })()}
            </span>
            <button
              onClick={() => setShowMatrix(true)}
              className="analog-btn !text-[9px] !px-2 !py-[2px]"
              title="Choose which tensions each quality of chord may take"
            >
              EDIT
            </button>
          </div>
        </div>
        <input
          type="range" min={0} max={6} step={1}
          value={params.chordColor ?? 0}
          onChange={(e) => {
            const next = { ...params, chordColor: parseInt(e.target.value, 10) };
            setParams(next);
            if (engine) engine.params = next;
          }}
          className="range-sm w-full accent-[var(--accent)]"
        />
        <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
          THE CHORD'S QUALITY IS READ OFF ITS OWN THIRD AND SEVENTH, AND THE TENSIONS
          IT TAKES ARE THE ONES TICKED UNDER EDIT.
        </p>
      </div>
      
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-[240px] h-[240px] bg-[#12120f] border-[8px] border-[var(--surface)] rounded-full m-auto relative shadow-[inset_0_0_20px_#000] touch-none cursor-crosshair"
      >
        <svg viewBox="-1 -1 2 2" className="w-full h-full opacity-10 pointer-events-none">
          <polygon 
            points="0,-1 0.951,-0.309 0.588,0.809 -0.588,0.809 -0.951,-0.309" 
            fill="var(--accent)" 
            stroke="var(--accent)" 
            strokeWidth="0.05"
          />
        </svg>

        {params.voicingPlayed ? (
          <>
            {/* Two plain choices rather than five named drop voicings: how far
                the chord reaches, and how usual a way of playing it this is. */}
            <div className="absolute top-[8%] left-1/2 -translate-x-1/2 label-meta pointer-events-none">USUAL</div>
            <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 label-meta pointer-events-none">UNUSUAL</div>
            <div className="absolute top-[50%] left-[6%] -translate-y-1/2 label-meta pointer-events-none">CLOSE</div>
            <div className="absolute top-[50%] right-[6%] -translate-y-1/2 label-meta pointer-events-none">WIDE</div>
          </>
        ) : (
          <>
            <div className="absolute top-[10%] left-1/2 -translate-x-1/2 label-meta pointer-events-none">CLOSED</div>
            <div className="absolute top-[50%] right-[10%] -translate-y-1/2 label-meta pointer-events-none">DROP 2</div>
            <div className="absolute bottom-[20%] right-[20%] label-meta pointer-events-none">DROP 3</div>
            <div className="absolute bottom-[20%] left-[20%] label-meta pointer-events-none">DROP 4</div>
            <div className="absolute top-[50%] left-[10%] -translate-y-1/2 label-meta pointer-events-none">OPEN</div>
          </>
        )}

        {/* Draggable Thumb */}
        <div 
          className="absolute w-4 h-4 -ml-2 -mt-2 bg-[var(--accent)] rounded-full border-2 border-white pointer-events-none transition-transform duration-75 shadow-[0_0_10px_var(--accent)]"
          style={{ left: thumbX, top: thumbY }}
        />
      </div>
      
      <div className="flex items-center justify-between w-full mt-4 mb-3">
        <span className="label-meta">PLAYED VOICINGS</span>
        <div
          className={`toggle-switch sm ${params.voicingPlayed ? 'on' : ''}`}
          title="Voice chords from shapes taken off written progressions, rather than by stacking thirds"
          onClick={() => {
            const next = { ...params, voicingPlayed: !params.voicingPlayed };
            setParams(next);
            if (engine) { engine.params = next; engine.retriggerHeldKeys(true); }
          }}
        ></div>
      </div>
      <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
        PLAYED VOICINGS COME FROM A LIBRARY OF SHAPES LIFTED OFF WRITTEN PROGRESSIONS.
        THEY REACH ABOUT TWO OCTAVES, OFTEN PUT THE SEVENTH BELOW THE THIRD, AND MAY
        NOT START ON THE ROOT. LEFT TO RIGHT IS HOW FAR THE CHORD REACHES; TOP TO
        BOTTOM IS HOW USUAL A WAY OF PLAYING IT THIS IS. SWITCHED OFF, THE DISK GOES
        BACK TO THE DROP VOICINGS.
      </p>
    </div>
  );
}
