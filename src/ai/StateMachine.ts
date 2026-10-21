export interface StateDefinition<S extends string> {
  /** Optional automatic state duration; callbacks decide what happens next. */
  duration?: number;
  onEnter?: (from: S | null) => void;
  onUpdate?: (dt: number, elapsed: number) => void;
  onExit?: (to: S) => void;
}

export class StateMachine<S extends string> {
  private readonly states = new Map<S, StateDefinition<S>>();
  private _current: S;
  private _time = 0;
  private _previous: S | null = null;

  constructor(initial: S) {
    this._current = initial;
  }

  add(name: S, definition: StateDefinition<S>): this {
    this.states.set(name, definition);
    return this;
  }

  set(name: S, force = false): boolean {
    if (!force && name === this._current) return false;
    if (!this.states.has(name)) return false;
    const old = this._current;
    this.states.get(old)?.onExit?.(name);
    this._previous = old;
    this._current = name;
    this._time = 0;
    this.states.get(name)?.onEnter?.(old);
    return true;
  }

  update(dt: number): void {
    this._time += dt;
    const state = this.states.get(this._current);
    state?.onUpdate?.(dt, this._time);
    if (state?.duration !== undefined && this._time >= state.duration) {
      this._time = state.duration;
    }
  }

  is(...names: S[]): boolean {
    return names.includes(this._current);
  }

  get current(): S {
    return this._current;
  }

  get previous(): S | null {
    return this._previous;
  }

  get elapsed(): number {
    return this._time;
  }

  get normalized(): number {
    const duration = this.states.get(this._current)?.duration;
    if (!duration) return 0;
    return Math.min(1, this._time / duration);
  }
}
