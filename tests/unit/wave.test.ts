import { describe, expect, it } from 'vitest';
import { WaveManager, type WaveDefinition } from '../../src/systems/WaveManager';

const waves: WaveDefinition[] = [
  {
    label: 'WAVE ONE',
    maxAlive: 2,
    spawns: [{ kind: 'base', count: 3, interval: 0.5 }],
  },
  {
    maxAlive: 1,
    spawns: [
      { kind: 'turbo', count: 1, interval: 0.2 },
      { kind: 'puffer', count: 1, interval: 0.2 },
    ],
  },
];

function drainFirstWave(manager: WaveManager): void {
  // Spawn 1, spawn 2 (cap), spawn 3 after a kill, then clear the wave.
  manager.update(0);
  manager.update(0.6);
  manager.onEnemyKilled();
  manager.update(0.6);
  manager.onEnemyKilled();
  manager.onEnemyKilled();
}

describe('WaveManager', () => {
  it('spawns on interval and enforces the concurrent enemy cap', () => {
    const manager = new WaveManager(waves);
    manager.start();
    expect(manager.update(0)).toHaveLength(1);
    expect(manager.alive).toBe(1);
    expect(manager.update(0.6)).toHaveLength(1);
    expect(manager.alive).toBe(2);
    expect(manager.update(5)).toHaveLength(0);
    expect(manager.remainingInWave).toBe(3);
    manager.onEnemyKilled();
    const next = manager.update(5);
    expect(next).toHaveLength(1);
    expect(manager.remainingInWave).toBe(2);
  });

  it('starts a second wave only when asked', () => {
    const manager = new WaveManager(waves);
    manager.start();
    drainFirstWave(manager);
    expect(manager.waveCleared).toBe(true);
    expect(manager.state).toBe('cleared');
    expect(manager.nextWave()).toBe(true);
    expect(manager.waveNumber).toBe(2);
    const spawn = manager.update(0);
    expect(spawn[0]?.kind).toBe('turbo');
    expect(manager.spawned).toBe(4);
  });

  it('completes after the final wave and reports totals', () => {
    const manager = new WaveManager(waves);
    manager.start();
    expect(manager.remainingTotal).toBe(5);
    drainFirstWave(manager);
    expect(manager.killed).toBe(3);
    manager.nextWave();
    manager.update(0);
    manager.onEnemyKilled();
    manager.update(1);
    manager.onEnemyKilled();
    expect(manager.waveCleared).toBe(true);
    expect(manager.nextWave()).toBe(false);
    expect(manager.state).toBe('complete');
    expect(manager.killed).toBe(5);
  });

  it('rejects empty wave arrays', () => {
    expect(() => new WaveManager([])).toThrow();
  });

  it('never spawns more than the wave count', () => {
    const manager = new WaveManager(waves);
    manager.start();
    for (let i = 0; i < 20; i++) {
      manager.update(1);
      manager.onEnemyKilled();
    }
    expect(manager.spawned).toBe(3);
    expect(manager.waveCleared).toBe(true);
  });
});
