import { describe, expect, it } from 'vitest';
import {
  CHALLENGES,
  createRng,
  decorateWaves,
  hashSeed,
  modeRules,
  modifierEffects,
  survivalWave,
  survivalWaves,
} from '../../src/systems/GameModes';
import { ModeSave, MODES_SAVE_KEY, parseModeRecords, recordRun } from '../../src/systems/ModeSave';
import type { StorageLike } from '../../src/systems/ModeSave';
import { LEVELS } from '../../src/world/LevelManager';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('mode rules', () => {
  it('builds a 20-round survival ladder with a boss every fifth round', () => {
    const rules = modeRules('survival');
    expect(rules.mode).toBe('survival');
    expect(rules.waves).toHaveLength(20);
    expect(rules.records).toBe(true);
    expect(rules.recordKey).toBe('survival');
    for (const [index, wave] of rules.waves!.entries()) {
      const round = index + 1;
      const boss = wave.spawns.find((spawn) => spawn.kind === 'boss');
      expect(Boolean(boss), `round ${round}`).toBe(round % 5 === 0);
      expect(wave.maxAlive).toBeGreaterThanOrEqual(1);
      expect(wave.maxAlive).toBeLessThanOrEqual(7);
    }
  });

  it('queues every campaign boss exactly once in the boss rush', () => {
    const rules = modeRules('bossRush');
    expect(rules.waves).toBeNull();
    expect(rules.bossRush).toEqual(['buttafuori', 'trainer', 'dj', 'borsello', 'tetti', 'consiglio']);
    expect(new Set(rules.bossRush).size).toBe(rules.bossRush!.length);
    expect(rules.records).toBe(true);
  });

  it('anchors survival and boss rush to the Duomo by id, not a stale index', () => {
    const duomo = LEVELS.findIndex((level) => level.id === 'duomo');
    expect(duomo).toBeGreaterThanOrEqual(0);
    expect(modeRules('survival').levelIndex).toBe(duomo);
    expect(modeRules('bossRush').levelIndex).toBe(duomo);
  });

  it('keeps training scoreless and wave-free', () => {
    const rules = modeRules('training');
    expect(rules.training).toBe(true);
    expect(rules.waves).toBeNull();
    expect(rules.bossRush).toBeNull();
    expect(rules.records).toBe(false);
    expect(rules.effects.playerMaxHp).toBe(120);
  });

  it('pins challenge seeds, modifiers and their effects', () => {
    for (const challenge of CHALLENGES) {
      const rules = modeRules('challenge', challenge.id);
      expect(rules.seed).toBe(challenge.seed);
      expect(rules.modifiers).toEqual(challenge.modifiers);
      expect(rules.recordKey).toBe(`challenge-${challenge.id}`);
      expect(rules.waves?.length).toBeGreaterThan(0);
    }
    const essenziale = modeRules('challenge', 'essenziale');
    expect(essenziale.effects.playerMaxHp).toBeLessThanOrEqual(80);
    expect(essenziale.effects.enemyHp).toBeGreaterThan(1);
    expect(essenziale.effects.playerDamage).toBeGreaterThan(1);
    expect(essenziale.effects.scoreMultiplier).toBeGreaterThan(1);
    expect(modeRules('challenge', 'tecnica').effects.scoreMultiplier).toBeGreaterThan(1.4);
  });

  it('derives the remix arena and modifiers deterministically from the seed', () => {
    const first = modeRules('remix', 'tecnica', 'REMIX-TEST');
    const second = modeRules('remix', 'tecnica', 'REMIX-TEST');
    expect(first).toEqual(second);
    expect(first.mode).toBe('remix');
    expect(first.seed).toBe('REMIX-TEST');
    expect(first.modifiers.length).toBeGreaterThan(0);
    expect(first.modifiers.length).toBeLessThanOrEqual(2);
    expect(first.levelIndex).toBeGreaterThanOrEqual(0);
    expect(first.waves?.length).toBeGreaterThan(0);

    const other = modeRules('remix', 'tecnica', 'REMIX-OTHER');
    expect(other.modifiers).not.toEqual(first.modifiers);
    expect(hashSeed('REMIX-TEST')).not.toBe(hashSeed('REMIX-OTHER'));
  });

  it('never leaves a survival spawn queue empty', () => {
    for (let round = 1; round <= 200; round++) {
      const wave = survivalWave(round);
      const total = wave.spawns.reduce((sum, spawn) => sum + spawn.count, 0);
      expect(total, `round ${round}`).toBeGreaterThan(0);
    }
    expect(survivalWaves(5)).toHaveLength(5);
  });

  it('adds extra concurrency only for pressure-style modifiers', () => {
    expect(modifierEffects([]).extraAlive).toBe(0);
    expect(modifierEffects(['pressione']).extraAlive).toBe(1);
    expect(modifierEffects(['pressione']).enemySpeed).toBeGreaterThan(1);

    const waves = [{ label: 'X', maxAlive: 3, spawns: [{ kind: 'base' as const, count: 2, interval: 1 }] }];
    const decorated = decorateWaves(waves, modifierEffects(['pressione']));
    expect(decorated[0]!.maxAlive).toBe(4);
    expect(decorated[0]!.spawns[0]!.count).toBe(3);
    // The source wave is left untouched.
    expect(waves[0]!.maxAlive).toBe(3);
    expect(waves[0]!.spawns[0]!.count).toBe(2);
  });

  it('produces the same seeded sequence across calls', () => {
    const a = createRng('SEED-1');
    const b = createRng('SEED-1');
    for (let i = 0; i < 8; i++) expect(a()).toBe(b());
    const c = createRng('SEED-2');
    expect(c()).not.toBe(createRng('SEED-1')());
  });
});

describe('mode records', () => {
  it('keeps the best score and combo while counting runs and wins', () => {
    let records = parseModeRecords({});
    let result = recordRun(records, 'survival', 1200, 9, false);
    records = result.records;
    expect(result.best).toBe(true);
    expect(records.survival).toEqual({ bestScore: 1200, bestCombo: 9, runs: 1, wins: 0 });

    result = recordRun(records, 'survival', 800, 14, true);
    records = result.records;
    expect(result.best).toBe(false);
    expect(records.survival).toEqual({ bestScore: 1200, bestCombo: 14, runs: 2, wins: 1 });
  });

  it('drops unknown or malformed storage entries', () => {
    const records = parseModeRecords({
      'boss-rush': { bestScore: '4200', bestCombo: -3, runs: 2, wins: 1 },
      'BAD KEY': { bestScore: 9999, bestCombo: 1, runs: 1, wins: 1 },
      broken: 'nope',
      another: { bestScore: Infinity, bestCombo: 2, runs: 1, wins: 0 },
    });
    expect(records['boss-rush']).toEqual({ bestScore: 4200, bestCombo: 0, runs: 2, wins: 1 });
    expect(records['BAD KEY']).toBeUndefined();
    expect(records.broken).toBeUndefined();
    expect(records.another).toEqual({ bestScore: 0, bestCombo: 2, runs: 1, wins: 0 });
  });

  it('persists through a storage implementation and survives garbage', () => {
    const storage = new MemoryStorage();
    const save = new ModeSave(storage);
    expect(save.get('remix').bestScore).toBe(0);
    save.record('remix', 3300, 11, false);
    expect(storage.data.get(MODES_SAVE_KEY)).toContain('3300');

    const reloaded = new ModeSave(storage);
    expect(reloaded.get('remix')).toEqual({ bestScore: 3300, bestCombo: 11, runs: 1, wins: 0 });

    storage.setItem(MODES_SAVE_KEY, '{garbage');
    const corrupt = new ModeSave(storage);
    expect(corrupt.all()).toEqual({});
  });

  it('does not throw when storage is blocked', () => {
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    };
    const save = new ModeSave(blocked);
    expect(save.get('survival').bestScore).toBe(0);
    expect(save.record('survival', 100, 3, true)).toBe(true);
    expect(save.get('survival').bestScore).toBe(100);
  });
});
