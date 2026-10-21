import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from './SettingsManager';
import { LEVEL_IDS, LEGACY_LEVEL_ORDER, type LevelId } from './levelIds';

export const SAVE_VERSION = 3;
export const SAVE_KEY = 'maranza-fight-3:save';

export interface LevelProgress {
  score: number;
  stars: number;
  cleared: boolean;
}

export interface SaveData {
  version: number;
  bestScore: number;
  /** Progress keyed by stable level id, never by array position. */
  levelProgress: Record<LevelId, LevelProgress>;
  /** True only when the whole campaign (Tetti di Milano) has been cleared. */
  completed: boolean;
  settings: Settings;
  updatedAt: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function emptyProgress(): Record<LevelId, LevelProgress> {
  const progress = {} as Record<LevelId, LevelProgress>;
  for (const id of LEVEL_IDS) progress[id] = { score: 0, stars: 0, cleared: false };
  return progress;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    bestScore: 0,
    levelProgress: emptyProgress(),
    completed: false,
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: 0,
  };
}

function finiteInt(value: unknown, min: number, max: number, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function sanitizeProgressEntry(raw: unknown): LevelProgress {
  if (typeof raw !== 'object' || raw === null) return { score: 0, stars: 0, cleared: false };
  const data = raw as Record<string, unknown>;
  return {
    score: finiteInt(data.score, 0, 99_999_999),
    stars: finiteInt(data.stars, 0, 3),
    cleared: data.cleared === true,
  };
}

/**
 * v1/v2 stored `levelScores`/`levelStars` by position, with `unlockedLevel` as
 * the highest reachable level. v3 uses ids: the old position 4 was the Bosco
 * Verticale (now "tetti") and position 5 the Duomo, so the migration remaps.
 */
function migrateLegacy(data: Record<string, unknown>): SaveData {
  const scores = Array.isArray(data.levelScores) ? data.levelScores : [];
  const stars = Array.isArray(data.levelStars) ? data.levelStars : [];
  const unlocked = finiteInt(data.unlockedLevel, 1, LEGACY_LEVEL_ORDER.length, 1);
  const legacyCompleted = data.completed === true;
  const progress = emptyProgress();

  LEGACY_LEVEL_ORDER.forEach((id, index) => {
    // v2 also wrote a per-level score on completion, so a positive Duomo score
    // proves the old finale was beaten even when `completed` stayed false.
    const duomoScore = finiteInt(scores[4], 0, 99_999_999);
    const cleared = index < unlocked - 1 || (id === 'duomo' && (legacyCompleted || duomoScore > 0));
    progress[id] = {
      score: finiteInt(scores[index], 0, 99_999_999),
      stars: finiteInt(stars[index], 0, 3),
      cleared,
    };
  });

  return {
    version: SAVE_VERSION,
    bestScore: finiteInt(data.bestScore, 0, 99_999_999),
    levelProgress: progress,
    completed: legacyCompleted && progress.tetti.cleared,
    settings: sanitizeSettings(data.settings),
    updatedAt: finiteInt(data.updatedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}

export function sanitizeSave(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw === null) return defaultSave();
  const data = raw as Record<string, unknown>;
  const rawProgress = data.levelProgress;
  if (typeof rawProgress !== 'object' || rawProgress === null) {
    if (Array.isArray(data.levelScores)) return migrateLegacy(data);
    return {
      ...defaultSave(),
      bestScore: finiteInt(data.bestScore, 0, 99_999_999),
      settings: sanitizeSettings(data.settings),
    };
  }

  const progress = emptyProgress();
  for (const id of LEVEL_IDS) {
    progress[id] = sanitizeProgressEntry((rawProgress as Record<string, unknown>)[id]);
  }
  return {
    version: SAVE_VERSION,
    bestScore: finiteInt(data.bestScore, 0, 99_999_999),
    levelProgress: progress,
    completed: data.completed === true,
    settings: sanitizeSettings(data.settings),
    updatedAt: finiteInt(data.updatedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}

export class SaveManager {
  private data: SaveData;
  private readonly key: string;
  private readonly storage: StorageLike | null;
  lastError: string | null = null;

  constructor(storage: StorageLike | null, key: string = SAVE_KEY) {
    this.storage = storage;
    this.key = key;
    this.data = defaultSave();
    this.load();
  }

  static create(): SaveManager {
    let storage: StorageLike | null = null;
    try {
      storage = typeof localStorage !== 'undefined' ? localStorage : null;
      // Safari in private mode throws on setItem, probe once.
      if (storage) {
        const probe = '__maranza_probe__';
        storage.setItem(probe, '1');
        storage.removeItem(probe);
      }
    } catch {
      storage = null;
    }
    return new SaveManager(storage);
  }

  load(): SaveData {
    if (!this.storage) {
      this.lastError = 'Salvataggio locale non disponibile.';
      this.data = defaultSave();
      return this.data;
    }
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) {
        this.data = defaultSave();
      } else {
        this.data = sanitizeSave(JSON.parse(raw));
      }
      this.lastError = null;
    } catch {
      this.data = defaultSave();
      this.lastError = 'Salvataggio corrotto: ripristinato quello iniziale.';
    }
    return this.data;
  }

  save(): boolean {
    this.data.updatedAt = Date.now();
    if (!this.storage) return false;
    try {
      this.storage.setItem(this.key, JSON.stringify(this.data));
      this.lastError = null;
      return true;
    } catch {
      this.lastError = 'Memoria del browser piena o bloccata.';
      return false;
    }
  }

  get(): SaveData {
    return this.data;
  }

  getSettings(): Settings {
    return this.data.settings;
  }

  updateSettings(partial: Partial<Settings>): Settings {
    this.data.settings = sanitizeSettings({ ...this.data.settings, ...partial });
    this.save();
    return this.data.settings;
  }

  getProgress(id: LevelId): LevelProgress {
    return this.data.levelProgress[id] ?? { score: 0, stars: 0, cleared: false };
  }

  /** A level is playable when it is first or the previous one was cleared. */
  isLevelUnlocked(index: number): boolean {
    if (index <= 0) return true;
    const previous = LEVEL_IDS[index - 1];
    return previous ? this.getProgress(previous).cleared : false;
  }

  /** Number of playable levels (1..LEVEL_COUNT). */
  get unlockedCount(): number {
    let count = 1;
    for (let index = 1; index < LEVEL_IDS.length; index++) {
      if (this.isLevelUnlocked(index)) count = index + 1;
      else break;
    }
    return count;
  }

  /** Continue target: first playable level not yet cleared, else the last one. */
  nextLevelIndex(): number {
    for (let index = 0; index < LEVEL_IDS.length; index++) {
      if (this.isLevelUnlocked(index) && !this.getProgress(LEVEL_IDS[index]!).cleared) return index;
    }
    return Math.max(0, this.unlockedCount - 1);
  }

  recordLevelComplete(id: LevelId, score: number, stars = 0): SaveData {
    const entry = this.getProgress(id);
    entry.score = Math.max(entry.score, Math.max(0, Math.floor(score)));
    entry.stars = Math.min(3, Math.max(entry.stars, Math.floor(stars)));
    entry.cleared = true;
    this.data.levelProgress[id] = entry;
    this.data.bestScore = Math.max(this.data.bestScore, Math.max(0, score));
    this.data.completed = LEVEL_IDS.every((levelId) => this.getProgress(levelId).cleared);
    this.save();
    return this.data;
  }

  recordScore(score: number): boolean {
    const clean = Math.max(0, Math.floor(score));
    if (clean > this.data.bestScore) {
      this.data.bestScore = clean;
      this.save();
      return true;
    }
    return false;
  }

  reset(): void {
    const settings = { ...this.data.settings };
    this.data = defaultSave();
    this.data.settings = settings;
    if (this.storage) {
      try {
        this.storage.removeItem(this.key);
      } catch {
        /* storage can refuse; nothing else to do */
      }
    }
    this.save();
  }

  hasProgress(): boolean {
    return this.unlockedCount > 1 || this.data.bestScore > 0 || this.data.completed;
  }
}
