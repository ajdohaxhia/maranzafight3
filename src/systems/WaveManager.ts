export type EnemyKind = 'base' | 'puffer' | 'turbo' | 'boss';

export interface WaveSpawn {
  kind: EnemyKind;
  count: number;
  interval: number;
}

export interface WaveDefinition {
  label?: string;
  maxAlive: number;
  spawns: WaveSpawn[];
}

export interface SpawnRequest {
  kind: EnemyKind;
  waveIndex: number;
  ordinal: number;
}

interface QueueEntry {
  kind: EnemyKind;
  interval: number;
}

export type WaveState = 'idle' | 'active' | 'cleared' | 'complete';

/**
 * WaveManager knows nothing about 3D: it only decides *what* to spawn and
 * *when*, respecting a maximum number of simultaneous enemies.
 */
export class WaveManager {
  readonly waves: WaveDefinition[];
  waveIndex = -1;
  state: WaveState = 'idle';
  alive = 0;
  spawned = 0;
  killed = 0;
  private queue: QueueEntry[] = [];
  private timer = 0;
  started = false;

  constructor(waves: WaveDefinition[]) {
    if (waves.length === 0) throw new Error('WaveManager needs at least one wave');
    this.waves = waves.map((wave) => ({
      ...wave,
      maxAlive: Math.max(1, Math.floor(wave.maxAlive)),
      spawns: wave.spawns.map((spawn) => ({
        ...spawn,
        count: Math.max(0, Math.floor(spawn.count)),
        interval: Math.max(0, spawn.interval),
      })),
    }));
  }

  get waveNumber(): number {
    return this.waveIndex + 1;
  }

  get waveTotal(): number {
    return this.waves.length;
  }

  get currentWave(): WaveDefinition | null {
    return this.waves[this.waveIndex] ?? null;
  }

  get remainingInWave(): number {
    return this.queue.length + this.alive;
  }

  get allSpawned(): boolean {
    return this.started && this.queue.length === 0;
  }

  get waveCleared(): boolean {
    return (
      (this.state === 'active' || this.state === 'cleared') &&
      this.queue.length === 0 &&
      this.alive === 0
    );
  }

  get complete(): boolean {
    return this.state === 'complete';
  }

  /** Total enemies still to defeat in this wave plus future waves. */
  get remainingTotal(): number {
    const future = this.waves
      .slice(Math.max(0, this.waveIndex + 1))
      .flatMap((wave) => wave.spawns)
      .reduce((sum, spawn) => sum + spawn.count, 0);
    return this.remainingInWave + future;
  }

  startWave(index: number): void {
    if (index < 0 || index >= this.waves.length) return;
    const wave = this.waves[index];
    this.waveIndex = index;
    this.state = 'active';
    this.started = true;
    this.queue = [];
    this.timer = 0;
    for (const spawn of wave.spawns) {
      for (let i = 0; i < spawn.count; i++) {
        this.queue.push({ kind: spawn.kind, interval: spawn.interval });
      }
    }
  }

  start(): void {
    this.startWave(0);
  }

  nextWave(): boolean {
    if (this.waveIndex + 1 >= this.waves.length) {
      this.state = 'complete';
      return false;
    }
    this.startWave(this.waveIndex + 1);
    return true;
  }

  update(dt: number): SpawnRequest[] {
    if (this.state !== 'active') return [];
    const requests: SpawnRequest[] = [];
    const wave = this.waves[this.waveIndex];
    if (!wave) return requests;

    this.timer -= dt;

    // Allow more than one spawn per frame if long frames happen, but never
    // exceed the concurrency limit.
    let guard = 4;
    while (
      guard-- > 0 &&
      this.queue.length > 0 &&
      this.alive < wave.maxAlive &&
      this.timer <= 0
    ) {
      const entry = this.queue.shift();
      if (!entry) break;
      requests.push({
        kind: entry.kind,
        waveIndex: this.waveIndex,
        ordinal: this.spawned,
      });
      this.alive += 1;
      this.spawned += 1;
      this.timer = entry.interval;
    }

    if (this.timer < 0) this.timer = 0;
    if (this.queue.length === 0 && this.alive === 0) {
      this.state = 'cleared';
    }
    return requests;
  }

  onEnemyKilled(): void {
    this.alive = Math.max(0, this.alive - 1);
    this.killed += 1;
    if (this.state === 'active' && this.queue.length === 0 && this.alive === 0) {
      this.state = 'cleared';
    }
  }

  onEnemyRemoved(): void {
    this.alive = Math.max(0, this.alive - 1);
  }

  /** Total number of enemies queued in the current wave. */
  get currentWaveTotal(): number {
    const wave = this.currentWave;
    if (!wave) return 0;
    return wave.spawns.reduce((sum, spawn) => sum + spawn.count, 0);
  }
}
