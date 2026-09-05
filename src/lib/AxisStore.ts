/**
 * The two controller axes, shared between everything that moves them.
 *
 * A finger dragging a chord button and a finger on the XY pad are the same two
 * numbers, so they cannot each keep their own copy — grabbing the pad after
 * dragging a chord would otherwise jump the value back to wherever the pad
 * happened to be left.
 *
 * It is a store rather than React state because the readout wants to show every
 * change, and the board around it is a hundred and forty-four buttons: putting
 * this in state would re-render all of them seventy times a second to move two
 * numbers. Only what subscribes re-renders.
 */

export interface AxisValues {
  x: number;
  y: number;
}

/** Where the axes sit when nothing has moved them. */
export const AXIS_REST = 64;

export class AxisStore {
  private value: AxisValues = { x: AXIS_REST, y: AXIS_REST };
  private listeners = new Set<() => void>();

  /**
   * Stable while nothing changes, which `useSyncExternalStore` requires: a
   * fresh object every read would spin.
   */
  public get = (): AxisValues => this.value;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Returns the axes that actually moved, so only those need sending. */
  public set(next: Partial<AxisValues>): Array<keyof AxisValues> {
    const x = clamp(next.x ?? this.value.x);
    const y = clamp(next.y ?? this.value.y);
    const moved: Array<keyof AxisValues> = [];
    // Rounded, because a controller is a whole number: a change too small to
    // alter the byte that goes out is not a change.
    if (Math.round(x) !== Math.round(this.value.x)) moved.push('x');
    if (Math.round(y) !== Math.round(this.value.y)) moved.push('y');
    if (moved.length === 0) return moved;
    this.value = { x, y };
    for (const listener of this.listeners) listener();
    return moved;
  }

  public reset(): Array<keyof AxisValues> {
    return this.set({ x: AXIS_REST, y: AXIS_REST });
  }
}

function clamp(v: number): number {
  if (!Number.isFinite(v)) return AXIS_REST;
  return Math.max(0, Math.min(127, v));
}
