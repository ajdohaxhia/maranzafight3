export const COMBO_WINDOW = 2.2;
export const MAX_COMBO_MULTIPLIER = 5;

/** Score multiplier grows in quarter steps every three hits. */
export function multiplierForCombo(count: number): number {
  if (count <= 0) return 1;
  const steps = Math.floor((count - 1) / 3);
  return Math.min(MAX_COMBO_MULTIPLIER, 1 + steps * 0.25);
}

export function scoreForHit(damage: number, comboMultiplier: number, perfect = false): number {
  const base = Math.max(0, Math.round(damage * 10));
  const extra = perfect ? 150 : 0;
  return Math.round(base * Math.max(1, comboMultiplier)) + extra;
}

export class ComboTracker {
  count = 0;
  timer = 0;
  best = 0;
  readonly window: number;

  constructor(windowSeconds: number = COMBO_WINDOW) {
    this.window = windowSeconds;
  }

  /** Registers a clean hit and returns the multiplier that applies to it. */
  registerHit(): number {
    this.count += 1;
    this.timer = this.window;
    this.best = Math.max(this.best, this.count);
    return this.multiplier;
  }

  update(dt: number): boolean {
    if (this.count === 0) return false;
    this.timer = Math.max(0, this.timer - dt);
    if (this.timer <= 0) {
      this.reset();
      return true;
    }
    return false;
  }

  get multiplier(): number {
    return multiplierForCombo(this.count);
  }

  get active(): boolean {
    return this.count > 1 && this.timer > 0;
  }

  get ratio(): number {
    return this.window <= 0 ? 0 : this.timer / this.window;
  }

  reset(): void {
    this.count = 0;
    this.timer = 0;
  }
}
