import React, { useState } from 'react';
import { RemoteAddress, RemoteStatus } from '../lib/useRemoteHost';

interface Props {
  status: RemoteStatus;
  onStart: () => void;
  onStop: () => void;
}

const KIND_LABEL: Record<RemoteAddress['kind'], string> = {
  usb: 'CABLE',
  wifi: 'WI-FI',
  other: 'NETWORK',
};

/**
 * The remote's switch, and the addresses a phone can reach it on.
 *
 * More than one is offered because they are not equally good: a tethered
 * iPhone talks over the cable, which has no radio to contend with and no power
 * saving to wake up from, and that shows in the timing. It is listed first when
 * it exists.
 */
export const RemotePanel: React.FC<Props> = ({ status, onStart, onStop }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const addresses = status.addresses ?? [];
  const hasCable = addresses.some(a => a.kind === 'usb');

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      setCopied(null);
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
        title="Play MidiMOO from a phone, over Wi-Fi or the cable"
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
          <div className="absolute right-0 top-9 z-[9999] w-[320px] module !bg-[var(--surface)] border border-white/15 flex flex-col gap-3 p-3">
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

            {status.running ? (
              <>
                <p className="label-meta !text-[9px] opacity-70 leading-relaxed">
                  OPEN ONE OF THESE IN SAFARI ON THE PHONE, THEN SHARE → ADD TO HOME SCREEN
                </p>

                {addresses.length === 0 && (
                  <p className="label-meta !text-[9px] !text-[#D9534F] leading-relaxed">
                    NO NETWORK FOUND. THE MAC IS NOT ON WI-FI AND NOTHING IS TETHERED.
                  </p>
                )}

                {addresses.map(address => (
                  <button
                    key={address.host}
                    onClick={() => copy(address.url)}
                    title={`${address.label} — click to copy`}
                    className={`flex flex-col gap-1 text-left bg-[var(--surface-deep)] border rounded-[2px] px-2 py-2 ${
                      address.kind === 'usb' ? 'border-[var(--accent)]/60' : 'border-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`label-meta !text-[8px] ${address.kind === 'usb' ? '!text-[var(--accent)]' : 'opacity-60'}`}>
                        {KIND_LABEL[address.kind]}
                      </span>
                      <span className="label-meta !text-[8px] opacity-40">{address.label}</span>
                      {copied === address.url && (
                        <span className="label-meta !text-[8px] !text-[var(--accent)] ml-auto">COPIED</span>
                      )}
                    </span>
                    <span className="font-['Space_Mono'] text-[13px] text-[var(--accent)] break-all">
                      {address.url}
                    </span>
                  </button>
                ))}

                {!hasCable && (
                  <p className="help-text label-meta !text-[8px] opacity-60 leading-relaxed">
                    FOR A STEADIER LINK, PLUG THE IPHONE IN AND TURN ON PERSONAL
                    HOTSPOT. A CABLE ENTRY APPEARS HERE WITHIN A FEW SECONDS.
                  </p>
                )}

                <span className="label-meta !text-[9px] opacity-60">
                  {status.clients === 0 ? 'NO PHONE CONNECTED' : `${status.clients} CONNECTED`}
                </span>
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
