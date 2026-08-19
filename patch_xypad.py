import re
content = open('src/components/ArpeggioXYPad.tsx').read()

old_imports = """import { OrchidParams } from '../types';

interface ArpeggioXYPadProps {"""
new_imports = """import { OrchidParams } from '../types';
import { CustomSlider } from './CustomSlider';

interface ArpeggioXYPadProps {"""
if old_imports in content:
    content = content.replace(old_imports, new_imports)

old_props = """interface ArpeggioXYPadProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
}

export function ArpeggioXYPad({ engine, params }: ArpeggioXYPadProps) {"""

new_props = """interface ArpeggioXYPadProps {
  engine: OrchidEngine | null;
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
}

export function ArpeggioXYPad({ engine, params, setParams }: ArpeggioXYPadProps) {"""
if old_props in content:
    content = content.replace(old_props, new_props)
    
old_vel1 = "       const velocity = Math.max(1, Math.min(127, Math.round(xVal * 127)));"
new_vel1 = "       const maxVel = params.arpeggioMaxVelocity ?? 127;\n       const velocity = Math.max(1, Math.min(maxVel, Math.round(xVal * maxVel)));"
content = content.replace(old_vel1, new_vel1)

old_jsx = """  return (
    <div className="module flex flex-col items-center flex-1 h-full">
      <p className="label-meta self-start mb-6">ARPEGGIO STRUM PAD</p>
      
      <div 
        ref={containerRef}"""

new_jsx = """  return (
    <div className="module flex flex-col items-center flex-1 h-full">
      <p className="label-meta self-start mb-2">ARPEGGIO STRUM PAD</p>
      
      <div className="w-full flex gap-4 mb-4">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px]">OCTAVES</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px]">{params.arpeggioOctaves ?? 4}</span>
          </div>
          <CustomSlider 
            min={1} max={6} step={1} 
            value={params.arpeggioOctaves ?? 4} 
            onChange={(v) => {
              const newParams = { ...params, arpeggioOctaves: v };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }} 
          />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-meta !text-[10px]">MAX VELOCITY</span>
            <span className="label-meta !text-[var(--accent)] !text-[10px]">{params.arpeggioMaxVelocity ?? 127}</span>
          </div>
          <CustomSlider 
            min={10} max={127} step={1} 
            value={params.arpeggioMaxVelocity ?? 127} 
            onChange={(v) => {
              const newParams = { ...params, arpeggioMaxVelocity: v };
              setParams(newParams);
              if (engine) engine.params = newParams;
            }} 
          />
        </div>
      </div>
      
      <div 
        ref={containerRef}"""

if old_jsx in content:
    content = content.replace(old_jsx, new_jsx)

open('src/components/ArpeggioXYPad.tsx', 'w').write(content)
print("Patched XY pad")
