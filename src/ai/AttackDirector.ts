/**
 * Grants a limited number of "attack slots". Enemies must hold a slot while
 * winding up and attacking, which prevents the classic beat 'em up pile-on.
 */
export class AttackDirector {
  maxAttackers: number;
  private readonly held = new Set<number>();

  constructor(maxAttackers = 1) {
    this.maxAttackers = Math.max(1, maxAttackers);
  }

  request(id: number): boolean {
    if (this.held.has(id)) return true;
    if (this.held.size >= this.maxAttackers) return false;
    this.held.add(id);
    return true;
  }

  release(id: number): void {
    this.held.delete(id);
  }

  has(id: number): boolean {
    return this.held.has(id);
  }

  releaseAll(): void {
    this.held.clear();
  }

  get active(): number {
    return this.held.size;
  }

  setMax(maxAttackers: number): void {
    this.maxAttackers = Math.max(1, Math.floor(maxAttackers));
    while (this.held.size > this.maxAttackers) {
      const first = this.held.values().next().value;
      if (first === undefined) break;
      this.held.delete(first);
    }
  }
}
