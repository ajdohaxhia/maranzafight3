import { describe, expect, it } from 'vitest';
import {
  SAVE_VERSION,
  SaveManager,
  defaultSave,
  sanitizeSave,
  type StorageLike,
} from '../../src/systems/SaveManager';
import { DEFAULT_SETTINGS } from '../../src/systems/SettingsManager';
import { LEVEL_IDS } from '../../src/systems/levelIds';

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

function corruptStorage(): StorageLike {
  return {
    getItem: () => '{not valid json',
    setItem: () => undefined,
    removeItem: () => undefined,
  };
}

function failingStorage(): StorageLike {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota');
    },
    removeItem: () => undefined,
  };
}

describe('sanitizeSave', () => {
  it('returns defaults for garbage', () => {
    const save = sanitizeSave(null);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.bestScore).toBe(0);
    expect(save.settings).toEqual(DEFAULT_SETTINGS);
    for (const id of LEVEL_IDS) {
      expect(save.levelProgress[id]).toEqual({ score: 0, stars: 0, cleared: false });
    }
  });

  it('migrates positional v1/v2 saves to stable ids', () => {
    const save = sanitizeSave({
      version: 2,
      bestScore: 8000,
      unlockedLevel: 5,
      levelScores: [4200, 6100, 9000, 12000, 30000],
      levelStars: [3, 2, 1, 2, 3],
      settings: { quality: 'high' },
    });
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.bestScore).toBe(8000);
    // Positions 1-3 keep their meaning, old 4 was the rooftop and old 5 the Duomo.
    expect(save.levelProgress.stazione).toEqual({ score: 4200, stars: 3, cleared: true });
    expect(save.levelProgress.metro).toEqual({ score: 6100, stars: 2, cleared: true });
    expect(save.levelProgress.navigli).toEqual({ score: 9000, stars: 1, cleared: true });
    expect(save.levelProgress.tetti).toEqual({ score: 12000, stars: 2, cleared: true });
    // Old unlock 5 meant levels 1-4 cleared; the Duomo score proves the old finale.
    expect(save.levelProgress.duomo).toEqual({ score: 30000, stars: 3, cleared: true });
    // New levels stay locked and empty, so the campaign keeps going.
    expect(save.levelProgress['porta-venezia']).toEqual({ score: 0, stars: 0, cleared: false });
    expect(save.levelProgress.darsena).toEqual({ score: 0, stars: 0, cleared: false });
    expect(save.settings.quality).toBe('high');
  });

  it('marks only the legacy finale as cleared when the old save was completed', () => {
    const save = sanitizeSave({
      version: 1,
      completed: true,
      unlockedLevel: 3,
      levelScores: [4200, 8800, 15000],
      settings: { quality: 'high' },
    });
    expect(save.levelProgress.stazione.cleared).toBe(true);
    expect(save.levelProgress.metro.cleared).toBe(true);
    expect(save.levelProgress.navigli.cleared).toBe(false);
    expect(save.levelProgress.duomo).toBeDefined();
    expect(save.completed).toBe(false);
  });

  it('clamps invalid numbers and unknown qualities', () => {
    const save = sanitizeSave({
      bestScore: -20,
      levelProgress: { stazione: { score: 5, stars: 9, cleared: 'yes' } },
      settings: { quality: 'ultra', master: 900, music: -5, deadzone: 200, shake: 'yes' },
    });
    expect(save.bestScore).toBe(0);
    expect(save.levelProgress.stazione).toEqual({ score: 5, stars: 3, cleared: false });
    expect(save.settings.quality).toBe('medium');
    expect(save.settings.master).toBe(100);
    expect(save.settings.music).toBe(0);
    expect(save.settings.deadzone).toBe(45);
    expect(save.settings.shake).toBe(true);
  });

  it('ignores unknown level ids from a future build', () => {
    const save = sanitizeSave({
      levelProgress: { stazione: { score: 10, stars: 1, cleared: true }, atlantis: { score: 99 } },
    });
    expect(save.levelProgress.stazione.cleared).toBe(true);
    expect((save.levelProgress as Record<string, unknown>).atlantis).toBeUndefined();
  });
});

describe('SaveManager', () => {
  it('starts fresh and persists custom settings', () => {
    const storage = new MemoryStorage();
    const save = new SaveManager(storage);
    expect(save.hasProgress()).toBe(false);
    save.updateSettings({ music: 20, quality: 'high' });
    const reloaded = new SaveManager(storage);
    expect(reloaded.getSettings().music).toBe(20);
    expect(reloaded.getSettings().quality).toBe('high');
  });

  it('unlocks the next level only when the previous one is cleared', () => {
    const save = new SaveManager(new MemoryStorage());
    expect(save.isLevelUnlocked(1)).toBe(false);
    save.recordLevelComplete('stazione', 4500, 2);
    expect(save.get().levelProgress.stazione).toEqual({ score: 4500, stars: 2, cleared: true });
    expect(save.get().bestScore).toBe(4500);
    expect(save.hasProgress()).toBe(true);
    expect(save.unlockedCount).toBe(2);
    expect(save.isLevelUnlocked(1)).toBe(true);
    expect(save.nextLevelIndex()).toBe(1);
    // Jumping ahead records the level but leaves the middle of the campaign closed.
    save.recordLevelComplete('duomo', 33000, 3);
    expect(save.unlockedCount).toBe(2);
    expect(save.isLevelUnlocked(2)).toBe(false);
    expect(save.get().completed).toBe(false);
    save.recordLevelComplete('metro', 6000, 1);
    save.recordLevelComplete('navigli', 9000, 1);
    // Duomo is cleared but Brera is not, so the campaign continues in Brera.
    expect(save.unlockedCount).toBe(4);
    expect(save.nextLevelIndex()).toBe(3);
  });

  it('completes the campaign only when every level is cleared', () => {
    const save = new SaveManager(new MemoryStorage());
    for (const id of LEVEL_IDS) save.recordLevelComplete(id, 1000, 1);
    expect(save.unlockedCount).toBe(LEVEL_IDS.length);
    expect(save.nextLevelIndex()).toBe(LEVEL_IDS.length - 1);
    expect(save.get().completed).toBe(true);
  });

  it('keeps maximum score and stars per level', () => {
    const save = new SaveManager(new MemoryStorage());
    save.recordLevelComplete('metro', 1000, 2);
    save.recordLevelComplete('metro', 900, 1);
    save.recordLevelComplete('metro', 800, 3);
    expect(save.getProgress('metro')).toEqual({ score: 1000, stars: 3, cleared: true });
  });

  it('recovers from corrupt JSON', () => {
    const save = new SaveManager(corruptStorage());
    expect(save.get()).toEqual(defaultSave());
    expect(save.lastError).toContain('corrotto');
  });

  it('does not throw when storage is full', () => {
    const save = new SaveManager(failingStorage());
    expect(save.save()).toBe(false);
    expect(save.lastError).toContain('Memoria');
  });

  it('reset clears progress but keeps settings', () => {
    const save = new SaveManager(new MemoryStorage());
    save.updateSettings({ music: 12 });
    save.recordLevelComplete('metro', 7000);
    save.reset();
    expect(save.get().bestScore).toBe(0);
    expect(save.unlockedCount).toBe(1);
    expect(save.getSettings().music).toBe(12);
  });
});
