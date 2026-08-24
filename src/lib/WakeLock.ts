/**
 * Keeping the phone awake.
 *
 * The proper way is `navigator.wakeLock`, which needs a secure context — so
 * over plain `http://192.168.x.x` it does not exist, and only appears once the
 * server is given a certificate. Until then there is the older trick: a silent
 * looping video keeps iOS from dimming, and rather than shipping a video file
 * one is recorded from a two-pixel canvas at run time.
 *
 * Both are best-effort. Neither failing is worth interrupting anybody over.
 */

export type WakeMethod = 'wakelock' | 'video' | 'none';

let sentinel: any = null;
let video: HTMLVideoElement | null = null;
let method: WakeMethod = 'none';
let wanted = false;

export const wakeMethod = () => method;

/** Whether the real API is even reachable here, which is to say: are we on https. */
export const wakeLockSupported = () =>
  typeof navigator !== 'undefined' && 'wakeLock' in navigator && window.isSecureContext;

async function requestWakeLock(): Promise<boolean> {
  if (!wakeLockSupported()) return false;
  try {
    sentinel = await (navigator as any).wakeLock.request('screen');
    // iOS drops the lock whenever the page goes to the background, and does not
    // hand it back on return, so the release is worth knowing about.
    sentinel.addEventListener?.('release', () => { sentinel = null; });
    method = 'wakelock';
    return true;
  } catch {
    return false;
  }
}

/** A one-second clip of nothing, made here so there is no media file to ship. */
function recordBlankClip(): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      const context = canvas.getContext('2d');
      if (!context || typeof (canvas as any).captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
        resolve(null);
        return;
      }
      const type = ['video/mp4', 'video/webm'].find(t => MediaRecorder.isTypeSupported?.(t));
      if (!type) { resolve(null); return; }

      const stream = (canvas as any).captureStream(2);
      const recorder = new MediaRecorder(stream, { mimeType: type });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        resolve(chunks.length ? new Blob(chunks, { type }) : null);
      };
      recorder.onerror = () => resolve(null);
      recorder.start();

      // The stream only produces frames if the canvas changes, so nudge it.
      const paint = setInterval(() => {
        context.fillStyle = context.fillStyle === '#000000' ? '#010101' : '#000000';
        context.fillRect(0, 0, 2, 2);
      }, 100);
      setTimeout(() => { clearInterval(paint); try { recorder.stop(); } catch { resolve(null); } }, 1000);
    } catch {
      resolve(null);
    }
  });
}

async function startVideoFallback(): Promise<boolean> {
  if (video) { try { await video.play(); method = 'video'; return true; } catch { return false; } }
  const clip = await recordBlankClip();
  if (!clip) return false;
  const element = document.createElement('video');
  element.src = URL.createObjectURL(clip);
  element.loop = true;
  element.muted = true;
  element.setAttribute('muted', '');
  element.setAttribute('playsinline', '');
  element.setAttribute('aria-hidden', 'true');
  element.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(element);
  try {
    await element.play();
    video = element;
    method = 'video';
    return true;
  } catch {
    element.remove();
    return false;
  }
}

/** Ask for whichever method this browser will give. Call it from a real gesture. */
export async function keepAwake(): Promise<WakeMethod> {
  wanted = true;
  if (await requestWakeLock()) return method;
  if (await startVideoFallback()) return method;
  method = 'none';
  return method;
}

export async function letSleep() {
  wanted = false;
  try { await sentinel?.release?.(); } catch { /* already gone */ }
  sentinel = null;
  if (video) { video.pause(); video.remove(); video = null; }
  method = 'none';
}

/**
 * iOS drops both the lock and the video the moment the app is backgrounded, so
 * coming back has to ask again.
 */
export function watchVisibility() {
  const onVisible = () => {
    if (!wanted || document.visibilityState !== 'visible') return;
    if (!sentinel) requestWakeLock().then(ok => { if (!ok) startVideoFallback(); });
    else if (video?.paused) video.play().catch(() => {});
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
