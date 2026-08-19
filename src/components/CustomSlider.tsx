import React, { useRef, useState, useEffect } from 'react';

interface CustomSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export const CustomSlider: React.FC<CustomSliderProps> = ({ min, max, step, value, onChange, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const calculateValue = (clientX: number) => {
    if (!containerRef.current) return value;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const range = max - min;
    let newValue = min + percentage * range;
    
    if (step) {
      newValue = Math.round(newValue / step) * step;
    }
    
    return Math.max(min, Math.min(max, newValue));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent scrolling
    // Capture the pointer to handle movements outside the element
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
    onChange(calculateValue(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only update if this pointer is captured (meaning they are dragging)
    if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
      onChange(calculateValue(e.clientX));
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
      className={`relative w-full h-[40px] flex items-center cursor-pointer touch-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Track */}
      <div className="w-full h-[8px] bg-[#111] border border-[#444] rounded-[4px]" />
      {/* Thumb */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 w-[24px] h-[36px] bg-[var(--accent)] border-2 border-white rounded-[2px] shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ left: `calc(${percentage}% - 12px)` }}
      />
    </div>
  );
};
