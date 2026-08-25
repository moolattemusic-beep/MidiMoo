/**
 * Feeling something when you touch the glass.
 *
 * There is no single way to do this on a phone browser, so this is three
 * layers, tried in order, and honest about the fact that the good one is not
 * available everywhere:
 *
 *   1. `navigator.vibrate` — a real, controllable buzz. Android only; iOS has
 *      never implemented it and shows no sign of doing so.
 *   2. A native switch control. Safari 17.4 gives `<input type="checkbox"
 *      switch>` the system toggle haptic, and that is the only genuine haptic
 *      an iPhone will produce from a web page. Driving a hidden one from inside
 *      a touch handler borrows it for other controls; it either lands or does
 *      nothing, which is why it sits behind the real thing rather than beside
 *      it.
 *   3. A short low tone through the speaker. Audible rather than felt on an
 *      iPhone — the speaker has nothing down there — so it is off unless asked
 *      for, and offered mainly because a click is still feedback.
 */

export type HapticKind = 'tap' | 'press' | 'release' | 'step' | 'error';

/** Vibration patterns, in milliseconds. Short: this is punctuation, not alarm. */
const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  press: 14,
  release: 6,
  step: 4,
  error: [18, 40, 18],
};

/** Speaker-click shapes for the audio fallback: [hertz, seconds, gain]. */
const TONES: Record<HapticKind, [number, number, number]> = {
  tap: [58, 0.016, 0.5],
  press: [44, 0.026, 0.62],
  release: [72, 0.012, 0.34],
  step: [96, 0.008, 0.26],
  error: [36, 0.05, 0.7],
};

/**
 * The id of the one real switch on the page. iOS fires its system haptic when a
 * switch is genuinely operated — and a `<label for>` pointing at it counts,
 * wherever that label happens to be. Clicking the switch from script does not,
 * which is why the pads are labels rather than buttons.
 */
export const HAPTIC_TARGET_ID = 'midimoo-haptic-tick';

/** Spread onto anything that should tick when touched. */
export const hapticLabelProps = (): { htmlFor?: string } =>
  hasNativeSwitch() && enabled ? { htmlFor: HAPTIC_TARGET_ID } : {};

let enabled = true;
let audioFallback = false;
let audioCtx: AudioContext | null = null;
let switchEl: HTMLInputElement | null = null;

const canVibrate = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

/** Whether Safari renders checkboxes as native switches, which is what carries the haptic. */
export const hasNativeSwitch = () =>
  typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;

/**
 * A rendered-but-invisible switch to borrow the system haptic from. It cannot
 * be `display: none` or hidden — an element the layout has thrown away does not
 * respond to a click.
 */
function ensureSwitch(): HTMLInputElement | null {
  if (!hasNativeSwitch()) return null;
  if (switchEl && switchEl.isConnected) return switchEl;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  // Kept inside the viewport: focusing a control off at -9999px makes Safari
  // scroll to it, which would drag the surface out from under the finger.
  input.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(input);
  switchEl = input;
  return input;
}

/**
 * Unlock the audio context. Browsers only allow this from a real gesture, so it
 * is called from the first touch rather than at load.
 */
export function primeHaptics() {
  ensureSwitch();
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      audioCtx = null;
    }
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
}

export function setHapticsEnabled(on: boolean) { enabled = on; }
export function hapticsEnabled() { return enabled; }

export function setAudioFallback(on: boolean) {
  audioFallback = on;
  if (on) primeHaptics();
}
export function audioFallbackEnabled() { return audioFallback; }

/** What the phone can actually do, for the settings row to report honestly. */
export function hapticCapability(): 'vibrate' | 'switch' | 'audio' | 'none' {
  if (canVibrate()) return 'vibrate';
  if (hasNativeSwitch()) return 'switch';
  if (audioFallback) return 'audio';
  return 'none';
}

function speakerClick(kind: HapticKind) {
  if (!audioCtx) return;
  const [hz, seconds, gain] = TONES[kind];
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(hz, now);
  // A hard edge and a fast decay: what makes it read as a click rather than a note.
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(amp).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + seconds + 0.01);
}

/**
 * Fire the best feedback this device has. Call it from inside the touch handler
 * — the switch layer needs to be within the gesture, and every layer is cheaper
 * than the render that follows it.
 */
export function haptic(kind: HapticKind = 'tap') {
  if (!enabled) return;
  if (canVibrate()) {
    try { navigator.vibrate(PATTERNS[kind]); return; } catch { /* fall through */ }
  }
  // No script-driven path on iOS: a switch toggled from code does not tick, so
  // there is nothing to try here. Controls that want the system haptic carry
  // `hapticLabelProps()` and get it from the touch itself.
  if (audioFallback) speakerClick(kind);
}
