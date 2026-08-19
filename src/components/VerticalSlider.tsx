import React, { useRef, useState, useEffect } from 'react';

interface VerticalSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export const VerticalSlider: React.FC<VerticalSliderProps> = ({ min, max, step = 1, value, onChange, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const calculateValue = (clientY: number) => {
    if (!containerRef.current) return value;
    const rect = containerRef.current.getBoundingClientRect();
    
    // For vertical sliders, top is max, bottom is min.
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    const percentage = 1 - (y / rect.height);
    const range = max - min;
    let newValue = min + percentage * range;
    
    if (step) {
      newValue = Math.round(newValue / step) * step;
    }
    
    return Math.max(min, Math.min(max, newValue));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
    onChange(calculateValue(e.clientY));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
      onChange(calculateValue(e.clientY));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div 
      ref={containerRef}
      className={`relative w-[40px] h-[150px] flex justify-center cursor-pointer touch-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Track */}
      <div className="w-[8px] h-full bg-[#111] border border-[#444] rounded-[4px]" />
      {/* Thumb */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-[36px] h-[24px] bg-[var(--accent)] border-2 border-white rounded-[2px] shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ bottom: `calc(${percentage}% - 12px)` }}
      />
    </div>
  );
};
