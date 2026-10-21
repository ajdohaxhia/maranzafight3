export interface LoopCallbacks {
  fixedUpdate(dt: number): void;
  render(dt: number, alpha: number): void;
}

/**
 * Fixed-timestep loop (60 Hz simulation) with a capped accumulator and
 * frame-rate telemetry. Rendering is interpolated by the consumer.
 */
export class GameLoop {
  private readonly callbacks: LoopCallbacks;
  private running = false;
  private paused = false;
  private last = 0;
  private accumulator = 0;
  private raf = 0;
  private frameCount = 0;
  private frameTimeAccum = 0;
  private _fps = 60;
  private _frameMs = 16.7;
  readonly fixedDt: number;

  constructor(callbacks: LoopCallbacks, fixedDt = 1 / 60) {
    this.callbacks = callbacks;
    this.fixedDt = fixedDt;
  }

  get fps(): number {
    return this._fps;
  }

  get frameMs(): number {
    return this._frameMs;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.last = performance.now();
    this.accumulator = 0;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const rawDt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    this.frameTimeAccum += rawDt * 1000;
    this.frameCount += 1;
    if (this.frameTimeAccum >= 400) {
      this._frameMs = this.frameTimeAccum / this.frameCount;
      this._fps = 1000 / Math.max(1, this._frameMs);
      this.frameCount = 0;
      this.frameTimeAccum = 0;
    }

    if (this.paused) {
      this.callbacks.render(0, 0);
      return;
    }

    this.accumulator += rawDt;
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < 5) {
      this.callbacks.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;
    const alpha = this.accumulator / this.fixedDt;
    this.callbacks.render(rawDt, alpha);
  };
}
