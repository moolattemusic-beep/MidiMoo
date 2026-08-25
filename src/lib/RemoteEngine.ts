import { RemoteCommandName, RemoteSnapshot } from './RemoteProtocol';
import { haptic } from './Haptics';

/**
 * What the phone hands to the interface in place of the engine.
 *
 * `MobileView` and its children were written to talk to an `OrchidEngine`
 * directly, and there is no engine on the phone. This wears the same shape:
 * anything that plays or changes something is sent up as a command, and
 * anything that is read comes from the last snapshot the Mac sent down. No call
 * waits for a reply — a touch lights its control and fires its haptic
 * immediately, and the sound follows a few milliseconds later.
 *
 * Feedback is fired from here rather than from the components, because this is
 * the one place every gesture already passes through. It also means the
 * arpeggio pad ticks once per note as you slide across it, which is the whole
 * reason for wanting haptics in the first place.
 */
export class RemoteEngine {
  /** A local mirror. Components assign to it; the value that counts comes down in the snapshot. */
  public params: Record<string, any>;

  public manualBaseType = -1;
  public ext_m7 = false;
  public ext_M7 = false;
  public ext_6 = false;
  public ext_9 = false;
  public ext_alt = false;

  /** The strum pad invokes this for its own drawing; nothing is streamed from the Mac. */
  public onOutputNote: ((event: any) => void) | undefined;

  private arpSequence: number[] = [];

  constructor(
    params: Record<string, any>,
    private send: (fn: RemoteCommandName, args: any[]) => void,
  ) {
    this.params = params;
  }

  /** Take the state that came down the wire. */
  public apply(snapshot: Pick<RemoteSnapshot, 'params' | 'engineState' | 'arpSequence'>) {
    this.params = snapshot.params;
    const s = snapshot.engineState ?? {};
    this.manualBaseType = s.manualBaseType ?? -1;
    this.ext_m7 = !!s.ext_m7;
    this.ext_M7 = !!s.ext_M7;
    this.ext_6 = !!s.ext_6;
    this.ext_9 = !!s.ext_9;
    this.ext_alt = !!s.ext_alt;
    this.arpSequence = snapshot.arpSequence ?? [];
  }

  public getArpeggioSequence(): number[] {
    return this.arpSequence;
  }

  public handleMidi(
    pitch: number,
    velocity: number,
    isOn: boolean,
    skipBass = false,
    isUpdate = false,
    forcePlay = false,
    isMemoryTrigger = false,
    customVoicing?: number[],
    chordIntervals?: number[],
  ) {
    haptic(isOn ? 'press' : 'release');
    this.send('handleMidi', [
      pitch, velocity, isOn, skipBass, isUpdate, forcePlay, isMemoryTrigger,
      customVoicing, chordIntervals,
    ]);
  }

  public setModifiers(baseType: number, m7: boolean, M7: boolean, six: boolean, nine: boolean) {
    this.send('setModifiers', [baseType, m7, M7, six, nine]);
  }

  public setBaseType(type: number) {
    haptic('tap');
    this.manualBaseType = type;
    this.send('setBaseType', [type]);
  }

  public releaseBaseType(type: number) {
    haptic('release');
    this.send('releaseBaseType', [type]);
  }

  public toggleExtension(ext: 'm7' | 'M7' | '6' | '9' | 'alt') {
    haptic('tap');
    this.send('toggleExtension', [ext]);
  }

  public releaseExtension(ext: 'm7' | 'M7' | '6' | '9' | 'alt') {
    haptic('release');
    this.send('releaseExtension', [ext]);
  }

  /** One tick per note as the pad is dragged across the chord. */
  public handleArpeggioNoteOn(pitch: number, velocity: number) {
    haptic('step');
    this.send('handleArpeggioNoteOn', [pitch, velocity]);
  }

  /** The pad's position. Continuous, so deliberately silent — a buzz per pixel is not feedback. */
  public emitControlChange(cc: number, value: number, channel = 1) {
    this.send('emitControlChange', [cc, value, channel]);
  }

  public updateInversion(inversion: number) {
    haptic('step');
    this.send('updateInversion', [inversion]);
  }

  /** The register slider. Re-voices what is held unless it has been set to stay silent. */
  public updateRegister(register: number) {
    haptic('step');
    this.send('updateRegister', [register]);
  }

  /** Sweep a controller so a plugin sitting in LEARN can catch it. */
  public wiggleCC(cc: number) {
    haptic('tap');
    this.send('wiggleCC', [cc]);
  }

  public panic() {
    haptic('error');
    this.send('panic', []);
  }
}
