import React from 'react';
import { MidiDeviceManager } from '../lib/MidiDeviceManager';

interface Props {
  midiManager: MidiDeviceManager;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Which ports are live, as a list of things to tick rather than two dropdowns
 * that can each hold one. Several inputs play together — a keyboard and a
 * control surface — and several outputs can be fed at once.
 *
 * The choice is remembered by port name, so it survives a reload and finds the
 * same devices again on the next launch.
 */
export const MidiSetup: React.FC<Props> = ({ midiManager, onClose, onChanged }) => {
  const [, force] = React.useState(0);
  const redraw = () => { force(n => n + 1); onChanged(); };

  const [scanning, setScanning] = React.useState(false);
  const rescan = async () => {
    setScanning(true);
    await midiManager.refreshDevices();
    setScanning(false);
    redraw();
  };

  const row = (
    port: { id: string; name?: string | null },
    checked: boolean,
    toggle: (next: boolean) => void
  ) => (
    <button
      key={port.id}
      onClick={() => { toggle(!checked); redraw(); }}
      className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded-sm border transition-colors ${
        checked
          ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--ink)]'
          : 'bg-[var(--surface-deep)] border-white/10 text-[var(--ink-dim)] hover:border-white/30'
      }`}
    >
      <span
        className={`w-4 h-4 shrink-0 rounded-[2px] border flex items-center justify-center text-[10px] font-bold ${
          checked ? 'bg-[var(--accent)] border-[var(--accent)] text-black' : 'border-white/30'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      <span className="font-['Space_Mono'] text-[11px] truncate">{port.name || port.id}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="module w-[620px] max-w-full max-h-[80vh] flex flex-col gap-3 !bg-[var(--surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="label-meta">MIDI PORTS</p>
          <div className="flex items-center gap-1">
            <button onClick={rescan} className="analog-btn !text-[9px] !px-2 !py-[3px]">
              {scanning ? 'SCANNING…' : 'RESCAN'}
            </button>
            <button onClick={onClose} className="analog-btn !text-[9px] !px-2 !py-[3px]">CLOSE</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 overflow-y-auto settings-scroll pr-1">
          <div className="flex flex-col gap-1">
            <p className="label-meta mb-1">INPUTS</p>
            {midiManager.inputs.length === 0 && (
              <p className="label-meta !text-[9px] opacity-60">NOTHING CONNECTED</p>
            )}
            {midiManager.inputs.map(port =>
              row(port, midiManager.selectedInputIds.has(port.id), (next) =>
                midiManager.setInputEnabled(port.id, next))
            )}
          </div>

          <div className="flex flex-col gap-1">
            <p className="label-meta mb-1">OUTPUTS</p>
            {midiManager.outputs.length === 0 && (
              <p className="label-meta !text-[9px] opacity-60">NOTHING CONNECTED</p>
            )}
            {midiManager.outputs.map(port =>
              row(port, midiManager.selectedOutputIds.has(port.id), (next) =>
                midiManager.setOutputEnabled(port.id, next))
            )}
          </div>
        </div>

        <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
          EVERY TICKED INPUT PLAYS THE INSTRUMENT, AND EVERY TICKED OUTPUT IS SENT TO.
          THE CHOICE IS REMEMBERED BY PORT NAME, SO IT COMES BACK ON THE NEXT LAUNCH
          AND FINDS THE SAME DEVICES. UNTICKING AN OUTPUT SILENCES IT ON THE WAY OUT.
        </p>
      </div>
    </div>
  );
};
