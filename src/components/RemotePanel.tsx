import React, { useState } from 'react';
import { RemoteStatus } from '../lib/useRemoteHost';

interface Props {
  status: RemoteStatus;
  onStart: () => void;
  onStop: () => void;
}

/**
 * The remote's switch, and the address to type into the phone once.
 *
 * It is a panel rather than a plain toggle because the address is the one thing
 * anybody needs from it, and hunting for a machine's own IP is a miserable way
 * to start.
 */
export const RemotePanel: React.FC<Props> = ({ status, onStart, onStop }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const address = status.devUrl ?? status.url;

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const light = status.error ? '#D9534F'
    : status.running && status.clients > 0 ? '#7FB069'
    : status.running ? 'var(--accent)'
    : 'rgba(255,255,255,0.25)';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`analog-btn h-8 px-2 flex items-center gap-[6px] ${status.running ? 'active' : ''}`}
        title="Play MidiMOO from a phone on the same network"
      >
        <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: light }} />
        <span className="label-meta !text-[9px]">REMOTE</span>
        {status.running && status.clients > 0 && (
          <span className="label-meta !text-[9px] !text-[var(--accent)]">{status.clients}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-[9999] w-[300px] module !bg-[var(--surface)] border border-white/15 flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between">
              <span className="label-meta !text-[var(--accent)]">PHONE REMOTE</span>
              <div
                className={`toggle-switch sm ${status.running ? 'on' : ''}`}
                onClick={() => (status.running ? onStop() : onStart())}
              />
            </div>

            {status.error && (
              <p className="label-meta !text-[9px] !text-[#D9534F] leading-relaxed">{status.error}</p>
            )}

            {status.running && address ? (
              <>
                <p className="label-meta !text-[9px] opacity-70 leading-relaxed">
                  OPEN THIS IN SAFARI ON THE PHONE, THEN SHARE → ADD TO HOME SCREEN
                </p>
                <button
                  onClick={copy}
                  title="Copy the address"
                  className="font-['Space_Mono'] text-[13px] text-[var(--accent)] bg-[var(--surface-deep)] border border-white/10 rounded-[2px] px-2 py-2 text-left break-all"
                >
                  {address}
                </button>
                <div className="flex items-center justify-between">
                  <span className="label-meta !text-[9px] opacity-60">
                    {status.clients === 0
                      ? 'NO PHONE CONNECTED'
                      : `${status.clients} CONNECTED`}
                  </span>
                  <span className="label-meta !text-[9px] !text-[var(--accent)]">
                    {copied ? 'COPIED' : ''}
                  </span>
                </div>
              </>
            ) : (
              <p className="label-meta !text-[9px] opacity-70 leading-relaxed">
                OFF. THE INSTRUMENT IS NOT LISTENING ON THE NETWORK UNTIL THIS IS
                SWITCHED ON, AND STOPS AGAIN WHEN MIDIMOO CLOSES.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
