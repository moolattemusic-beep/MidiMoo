import React, { useRef, useState, useEffect } from 'react';
import { OrchidEngine } from '../lib/OrchidEngine';
import { OrchidParams } from '../types';

interface VoicingPadProps {
  engine: OrchidEngine;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
}

export function VoicingPad({ engine, params, setParams }: VoicingPadProps) {
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
      <p className="label-meta self-start mb-6">VOICING DISK</p>
      
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

        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 label-meta pointer-events-none">CLOSED</div>
        <div className="absolute top-[50%] right-[10%] -translate-y-1/2 label-meta pointer-events-none">DROP 2</div>
        <div className="absolute bottom-[20%] right-[20%] label-meta pointer-events-none">DROP 3</div>
        <div className="absolute bottom-[20%] left-[20%] label-meta pointer-events-none">DROP 4</div>
        <div className="absolute top-[50%] left-[10%] -translate-y-1/2 label-meta pointer-events-none">OPEN</div>

        {/* Draggable Thumb */}
        <div 
          className="absolute w-4 h-4 -ml-2 -mt-2 bg-[var(--accent)] rounded-full border-2 border-white pointer-events-none transition-transform duration-75 shadow-[0_0_10px_var(--accent)]"
          style={{ left: thumbX, top: thumbY }}
        />
      </div>
      
      <p className="label-meta mt-6 mb-6 text-center text-[0.5rem]">GENERATE PROBABILITY SECTOR</p>
    </div>
  );
}
