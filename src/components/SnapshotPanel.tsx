import React, { useState } from 'react';
import { Snapshot } from '../lib/Snapshots';

interface SnapshotPanelProps {
  snapshots: Snapshot[];
  currentName: string | null;
  onSave: (name: string) => void;
  onRecall: (snap: Snapshot) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const when = (ms: number): string => {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const SnapshotPanel: React.FC<SnapshotPanelProps> = ({
  snapshots, currentName, onSave, onRecall, onRename, onDelete, onClose,
}) => {
  const [name, setName] = useState(currentName ?? '');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  // Deleting a setup cannot be undone, so the button asks once rather than
  // acting on a click that might have been meant for RECALL beside it.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const ordered = [...snapshots].sort((a, b) => b.saved - a.saved);
  const clash = snapshots.some(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());

  const save = () => {
    if (!name.trim()) return;
    onSave(name);
    setConfirmDelete(null);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="module w-[620px] max-w-full max-h-[80vh] flex flex-col gap-3 !bg-[var(--surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="label-meta">SETUPS</p>
          <button onClick={onClose} className="analog-btn !text-[9px] !px-2 !py-[3px]">CLOSE</button>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="flex-1 bg-[var(--surface-deep)] border border-white/10 px-2 py-1 text-[12px] font-['Space_Mono'] text-[var(--accent)] uppercase"
            placeholder="NAME THIS SETUP"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          />
          <button
            onClick={save}
            disabled={!name.trim()}
            className={`analog-btn !px-3 ${name.trim() ? 'active' : 'opacity-40'}`}
          >
            {clash ? 'REPLACE' : 'SAVE'}
          </button>
        </div>

        <div className="flex flex-col gap-1 overflow-y-auto settings-scroll pr-1 min-h-[60px]">
          {ordered.length === 0 && (
            <p className="label-meta !text-[9px] opacity-60">NOTHING SAVED YET</p>
          )}
          {ordered.map(snap => (
            <div
              key={snap.id}
              className={`flex items-center gap-2 px-2 py-[6px] border ${
                currentName === snap.name
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-white/5 bg-[var(--surface-deep)]'
              }`}
            >
              {renamingId === snap.id ? (
                <input
                  autoFocus
                  className="flex-1 bg-[var(--surface)] border border-white/10 px-2 py-[2px] text-[11px] font-['Space_Mono'] text-[var(--accent)] uppercase"
                  value={renameText}
                  maxLength={40}
                  onChange={(e) => setRenameText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { onRename(snap.id, renameText); setRenamingId(null); }
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => { onRename(snap.id, renameText); setRenamingId(null); }}
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="font-['Space_Mono'] text-[12px] truncate">{snap.name}</p>
                  <p className="label-meta !text-[8px] opacity-50">{when(snap.saved)}</p>
                </div>
              )}

              <button
                onClick={() => onRecall(snap)}
                className="analog-btn !text-[9px] !px-2 !py-[3px]"
              >
                RECALL
              </button>
              <button
                onClick={() => { setRenamingId(snap.id); setRenameText(snap.name); }}
                className="analog-btn !text-[9px] !px-2 !py-[3px]"
              >
                RENAME
              </button>
              {confirmDelete === snap.id ? (
                <button
                  onClick={() => { onDelete(snap.id); setConfirmDelete(null); }}
                  className="analog-btn !text-[9px] !px-2 !py-[3px] bg-red-900/80 text-red-100 border-red-500"
                >
                  SURE?
                </button>
              ) : (
                <button
                  onClick={() => setConfirmDelete(snap.id)}
                  className="analog-btn !text-[9px] !px-2 !py-[3px]"
                >
                  DELETE
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="help-text label-meta !text-[0.6rem] opacity-75 leading-relaxed">
          A SETUP HOLDS EVERY SETTING AND ALL EIGHT PADS. IT DOES NOT HOLD YOUR MIDI
          PORTS OR WHICH SOCKET THE OUTBOARD SYNTH IS ON — THOSE DESCRIBE THE RIG, NOT
          THE SOUND, SO RECALLING A SETUP NEVER REPOINTS YOUR OUTPUTS. RECALL STOPS ALL
          NOTES FIRST, SINCE CHANGING EVERY PARAMETER UNDER A HELD CHORD WOULD STRAND IT.
        </p>
      </div>
    </div>
  );
};
