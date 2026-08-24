import React from 'react';
import { OrchidParams } from '../types';
import { OrchidEngine } from '../lib/OrchidEngine';
import {
  ChordQuality,
  COLOUR_ORDER,
  DEFAULT_COLOUR_MATRIX,
  QUALITIES,
  TENSIONS,
  colourTensionsFor,
  parseColourMatrix,
} from '../lib/ChordColour';

interface Props {
  params: OrchidParams;
  setParams: (p: OrchidParams) => void;
  engine: OrchidEngine | null;
  onClose: () => void;
}

/**
 * Which tensions each quality of chord is allowed to take. The colour control
 * walks whatever is ticked, in the order that quality wants them — so unticking
 * the ninth on a dominant moves the sharp ninth up a place rather than leaving
 * a gap.
 */
export const ColourMatrix: React.FC<Props> = ({ params, setParams, engine, onClose }) => {
  const matrix = parseColourMatrix(params.chordColorMatrix);

  const write = (next: Record<string, string[]>) => {
    const merged = { ...params, chordColorMatrix: JSON.stringify(next) };
    setParams(merged);
    if (engine) engine.params = merged;
  };

  const toggle = (quality: ChordQuality, id: string) => {
    const current = new Set(matrix[quality] ?? []);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    write({ ...matrix, [quality]: [...current] });
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="module w-[760px] max-w-full max-h-[80vh] flex flex-col gap-3 !bg-[var(--surface)] overflow-y-auto settings-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="label-meta">COLOUR — WHICH TENSIONS EACH CHORD MAY TAKE</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => write({ ...DEFAULT_COLOUR_MATRIX })}
              className="analog-btn !text-[9px] !px-2 !py-[3px]"
            >
              RESET
            </button>
            <button onClick={onClose} className="analog-btn !text-[9px] !px-2 !py-[3px]">CLOSE</button>
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left label-meta !text-[9px] pb-2 pr-2"></th>
              {TENSIONS.map(t => (
                <th key={t.id} className="label-meta !text-[9px] pb-2 text-center whitespace-nowrap">{t.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {QUALITIES.map(q => {
              const on = new Set(matrix[q.id] ?? []);
              return (
                <tr key={q.id} className="border-t border-white/5">
                  <td className="label-meta !text-[10px] py-1 pr-3 whitespace-nowrap" title={q.hint}>
                    {q.label}
                  </td>
                  {TENSIONS.map(t => {
                    const checked = on.has(t.id);
                    // Where this tension falls in the order the colour control
                    // walks, so the effect of a tick is visible.
                    const place = checked
                      ? colourTensionsFor(q.id, matrix).findIndex(x => x.id === t.id) + 1
                      : 0;
                    return (
                      <td key={t.id} className="py-1 text-center">
                        <button
                          onClick={() => toggle(q.id, t.id)}
                          title={`${q.label} · ${t.label}`}
                          className={`w-7 h-6 rounded-[2px] border font-['Space_Mono'] text-[9px] transition-colors ${
                            checked
                              ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
                              : 'bg-[var(--surface-deep)] border-white/15 text-transparent hover:border-white/40'
                          }`}
                        >
                          {place || '·'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex flex-col gap-1">
          <p className="label-meta !text-[9px]">AS THE COLOUR CONTROL IS TURNED UP</p>
          {QUALITIES.map(q => {
            const order = colourTensionsFor(q.id, matrix);
            return (
              <div key={q.id} className="flex items-center gap-2">
                <span className="label-meta !text-[9px] w-12 shrink-0">{q.label}</span>
                <span className="font-['Space_Mono'] text-[10px] text-[var(--accent)]">
                  {order.length ? order.map(t => t.label).join('  →  ') : 'nothing'}
                </span>
              </div>
            );
          })}
        </div>

        <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
          THE QUALITY IS READ OFF THE CHORD'S OWN THIRD AND SEVENTH, SO A DOMINANT IS
          ONE HOWEVER IT ARRIVED. THE NUMBER IN EACH BOX IS WHERE THAT TENSION FALLS
          AS THE COLOUR CONTROL IS TURNED UP; UNTICKING ONE MOVES THE REST UP RATHER
          THAN LEAVING A GAP. A TENSION THE CHORD ALREADY STATES IS NEVER ADDED
          TWICE, AND A SEVENTH IS NEVER PUT AGAINST THE OTHER SEVENTH.
        </p>
      </div>
    </div>
  );
};

/** The order each quality is written in, for anything that needs it. */
export { COLOUR_ORDER };
