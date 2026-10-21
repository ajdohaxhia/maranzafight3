import { describe, expect, it } from 'vitest';
import {
  ZOMBIES_SAVE_KEY,
  ZombieSave,
  defaultZombiesSave,
  sanitizeZombiesSave,
  type ZombieStorage,
  type ZombiesRunSnapshot,
} from '../../src/zombies/ZombieSave';

class MemoryStorage implements ZombieStorage {
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

function snapshot(overrides: Partial<ZombiesRunSnapshot> = {}): ZombiesRunSnapshot {
  return {
    mode: 'infinite',
    nextRound: 4,
    points: 2500,
    hp: 80,
    weapons: {
      slots: [
        { id: 'pistol', mag: 12, reserve: 96, tier: 1 },
        { id: 'smg', mag: 30, reserve: 180, tier: 2 },
      ],
      active: 1,
    },
    doors: ['d0', 'd1'],
    power: true,
    perks: ['resistenza'],
    kills: 22,
    headshots: 5,
    time: 345,
    ...overrides,
  };
}

describe('sanitizeZombiesSave', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizeZombiesSave(null)).toEqual(defaultZombiesSave());
    expect(sanitizeZombiesSave('nope')).toEqual(defaultZombiesSave());
  });

  it('clamps record counters and drops invalid run fields', () => {
    const save = sanitizeZombiesSave({
      version: 99,
      records: { bestRound: -4, bestKills: 3.9, bestPoints: 12, runs: 2, extractions: 'x' },
      active: { mode: 'chaos', points: 100 },
    });
    expect(save.version).toBe(1);
    expect(save.records).toEqual({ bestRound: 0, bestKills: 3, bestPoints: 12, runs: 2, extractions: 0 });
    expect(save.active).toBeNull();
  });

  it('clamps ammo to the real weapon and drops unknown weapons', () => {
    const save = sanitizeZombiesSave({
      active: snapshot({
        weapons: {
          slots: [
            { id: 'pistol', mag: 999, reserve: 9999, tier: 9 },
            { id: 'railgun', mag: 5, reserve: 5, tier: 1 } as never,
          ],
          active: 1,
        },
      }),
    });
    expect(save.active?.weapons.slots[0]).toEqual({ id: 'pistol', mag: 12, reserve: 144, tier: 3 });
    expect(save.active?.weapons.slots[1]).toBeNull();
    expect(save.active?.weapons.active).toBe(1);
  });

  it('deduplicates doors and keeps only known perks', () => {
    const save = sanitizeZombiesSave({
      active: snapshot({ doors: ['d0', 'd0', 'd1', 'd1', 'd9'], perks: ['resistenza', 'volo' as never] }),
    });
    expect(save.active?.doors).toEqual(['d0', 'd1', 'd9']);
    expect(save.active?.perks).toEqual(['resistenza']);
  });
});

describe('ZombieSave', () => {
  it('persists a checkpoint and clears it when a run starts or ends', () => {
    const storage = new MemoryStorage();
    const save = new ZombieSave(storage);
    save.snapshot(snapshot());
    const reloaded = new ZombieSave(storage);
    expect(reloaded.active?.nextRound).toBe(4);
    expect(reloaded.active?.weapons.slots[1]?.id).toBe('smg');

    reloaded.startNew();
    expect(reloaded.active).toBeNull();
    expect(JSON.parse(storage.getItem(ZOMBIES_SAVE_KEY) ?? '{}').active).toBeNull();
  });

  it('only improves records and counts extracted runs once', () => {
    const save = new ZombieSave(new MemoryStorage());
    save.recordRun({ round: 12, kills: 40, points: 9000, extracted: false });
    save.recordRun({ round: 8, kills: 55, points: 4000, extracted: true });
    expect(save.records).toEqual({
      bestRound: 12,
      bestKills: 55,
      bestPoints: 9000,
      runs: 2,
      extractions: 1,
    });
  });

  it('recovers from corrupt JSON and keeps a clear error', () => {
    const storage = new MemoryStorage();
    storage.setItem(ZOMBIES_SAVE_KEY, '{broken');
    const save = new ZombieSave(storage);
    expect(save.records.bestRound).toBe(0);
    expect(save.lastError).toContain('corrotto');
  });

  it('does not throw when storage is full', () => {
    const storage: ZombieStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    const save = new ZombieSave(storage);
    expect(save.save()).toBe(false);
    expect(save.lastError).toContain('Memoria');
  });
});
