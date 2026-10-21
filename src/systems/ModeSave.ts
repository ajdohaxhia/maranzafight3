/**
 * Personal records for the extra modes. Same defensive shape as the campaign
 * save: never trust localStorage, keep every field numeric and bounded.
 */

export const MODES_SAVE_KEY = 'maranza-fight-3:modes';

export interface ModeRecord {
  bestScore: number;
  bestCombo: number;
  runs: number;
  wins: number;
}

export type ModeRecords = Record<string, ModeRecord>;

const EMPTY: ModeRecord = { bestScore: 0, bestCombo: 0, runs: 0, wins: 0 };

function toCount(value: unknown, max: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(max, Math.round(number));
}

export function emptyRecords(): ModeRecords {
  return {};
}

export function parseModeRecords(raw: unknown): ModeRecords {
  if (!raw || typeof raw !== 'object') return emptyRecords();
  const records: ModeRecords = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9-]{1,40}$/.test(key)) continue;
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    records[key] = {
      bestScore: toCount(entry.bestScore, 9_999_999),
      bestCombo: toCount(entry.bestCombo, 999),
      runs: toCount(entry.runs, 999_999),
      wins: toCount(entry.wins, 999_999),
    };
  }
  return records;
}

export function recordRun(
  records: ModeRecords,
  key: string,
  score: number,
  combo: number,
  win: boolean,
): { records: ModeRecords; best: boolean } {
  const previous = records[key] ?? EMPTY;
  const cleanScore = toCount(score, 9_999_999);
  const cleanCombo = toCount(combo, 999);
  const next: ModeRecord = {
    bestScore: Math.max(previous.bestScore, cleanScore),
    bestCombo: Math.max(previous.bestCombo, cleanCombo),
    runs: Math.min(999_999, previous.runs + 1),
    wins: Math.min(999_999, previous.wins + (win ? 1 : 0)),
  };
  return {
    records: { ...records, [key]: next },
    best: cleanScore > previous.bestScore && cleanScore > 0,
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_PROBE = '__maranza_modes_probe__';

function safeStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    storage.setItem(STORAGE_PROBE, '1');
    storage.removeItem(STORAGE_PROBE);
    return storage;
  } catch {
    return null;
  }
}

export class ModeSave {
  static create(): ModeSave {
    return new ModeSave();
  }

  private storage: StorageLike | null;
  private data: ModeRecords;

  constructor(storage: StorageLike | null = safeStorage()) {
    this.storage = storage;
    this.data = this.load();
  }

  get(key: string): ModeRecord {
    return this.data[key] ?? { ...EMPTY };
  }

  all(): ModeRecords {
    return { ...this.data };
  }

  record(key: string, score: number, combo: number, win: boolean): boolean {
    const result = recordRun(this.data, key, score, combo, win);
    this.data = result.records;
    this.persist();
    return result.best;
  }

  reset(): void {
    this.data = emptyRecords();
    this.persist();
  }

  private load(): ModeRecords {
    try {
      const raw = this.storage?.getItem(MODES_SAVE_KEY);
      if (!raw) return emptyRecords();
      return parseModeRecords(JSON.parse(raw));
    } catch {
      return emptyRecords();
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(MODES_SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked: records stay in memory for this session.
    }
  }
}
