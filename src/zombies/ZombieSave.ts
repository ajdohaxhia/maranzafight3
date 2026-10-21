import { WEAPONS, type WeaponId, type WeaponSlot } from './Weapons';
import type { ZombiePerkId } from './ZombiesMap';

export const ZOMBIES_SAVE_VERSION = 1;
export const ZOMBIES_SAVE_KEY = 'maranza-fight-3:zombies';

export type ZombiesRunMode = 'infinite' | 'extraction';

export interface ZombiesRunSnapshot {
  mode: ZombiesRunMode;
  /** Round to resume from (the beginning of the next round). */
  nextRound: number;
  points: number;
  hp: number;
  weapons: { slots: Array<WeaponSlot | null>; active: 0 | 1 };
  doors: string[];
  power: boolean;
  perks: ZombiePerkId[];
  kills: number;
  headshots: number;
  time: number;
}

export interface ZombiesRecords {
  bestRound: number;
  bestKills: number;
  bestPoints: number;
  runs: number;
  extractions: number;
}

export interface ZombiesSaveData {
  version: number;
  records: ZombiesRecords;
  active: ZombiesRunSnapshot | null;
  updatedAt: number;
}

export interface ZombieStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PERKS: ZombiePerkId[] = ['resistenza', 'ricarica', 'mobilita'];

function int(value: unknown, min: number, max: number, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function defaultZombiesSave(): ZombiesSaveData {
  return {
    version: ZOMBIES_SAVE_VERSION,
    records: { bestRound: 0, bestKills: 0, bestPoints: 0, runs: 0, extractions: 0 },
    active: null,
    updatedAt: 0,
  };
}

function sanitizeWeapons(raw: unknown): ZombiesRunSnapshot['weapons'] {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const slots = Array.isArray(source.slots) ? source.slots : [];
  const cleanSlots: Array<WeaponSlot | null> = [null, null];
  for (let i = 0; i < 2; i++) {
    const slot = slots[i];
    if (typeof slot !== 'object' || slot === null) continue;
    const data = slot as Record<string, unknown>;
    if (typeof data.id !== 'string' || !(data.id in WEAPONS)) continue;
    const id = data.id as WeaponId;
    const spec = WEAPONS[id];
    cleanSlots[i] = {
      id,
      // Clamp to the real weapon so a future/corrupt save cannot create a
      // 999-round pistol or an unknown gun that crashes the HUD.
      mag: int(data.mag, 0, spec.magazine),
      reserve: int(data.reserve, 0, spec.reserveMax),
      tier: int(data.tier, 1, 3, 1),
    };
  }
  return { slots: cleanSlots, active: source.active === 1 ? 1 : 0 };
}

function sanitizeSnapshot(raw: unknown): ZombiesRunSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  if (data.mode !== 'infinite' && data.mode !== 'extraction') return null;
  const perks = Array.isArray(data.perks)
    ? data.perks.filter((perk): perk is ZombiePerkId => typeof perk === 'string' && PERKS.includes(perk as ZombiePerkId))
    : [];
  const doors = Array.isArray(data.doors)
    ? [...new Set(data.doors.filter((door): door is string => typeof door === 'string'))].slice(0, 12)
    : [];
  return {
    mode: data.mode,
    nextRound: int(data.nextRound, 1, 999, 1),
    points: int(data.points, 0, 9_999_999),
    hp: int(data.hp, 1, 999, 120),
    weapons: sanitizeWeapons(data.weapons),
    doors,
    power: data.power === true,
    perks,
    kills: int(data.kills, 0, 9_999_999),
    headshots: int(data.headshots, 0, 9_999_999),
    time: int(data.time, 0, 99_999_999),
  };
}

export function sanitizeZombiesSave(raw: unknown): ZombiesSaveData {
  if (typeof raw !== 'object' || raw === null) return defaultZombiesSave();
  const data = raw as Record<string, unknown>;
  const recordsRaw = (typeof data.records === 'object' && data.records !== null ? data.records : {}) as Record<string, unknown>;
  return {
    version: ZOMBIES_SAVE_VERSION,
    records: {
      bestRound: int(recordsRaw.bestRound, 0, 9999),
      bestKills: int(recordsRaw.bestKills, 0, 999_999),
      bestPoints: int(recordsRaw.bestPoints, 0, 99_999_999),
      runs: int(recordsRaw.runs, 0, 99_999),
      extractions: int(recordsRaw.extractions, 0, 99_999),
    },
    active: sanitizeSnapshot(data.active),
    updatedAt: int(data.updatedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}

export class ZombieSave {
  private data: ZombiesSaveData;
  private readonly storage: ZombieStorage | null;
  private readonly key: string;
  lastError: string | null = null;

  constructor(storage: ZombieStorage | null, key = ZOMBIES_SAVE_KEY) {
    this.storage = storage;
    this.key = key;
    this.data = defaultZombiesSave();
    this.load();
  }

  static create(): ZombieSave {
    let storage: ZombieStorage | null = null;
    try {
      storage = typeof localStorage !== 'undefined' ? localStorage : null;
      if (storage) {
        storage.setItem('__maranza_z_probe__', '1');
        storage.removeItem('__maranza_z_probe__');
      }
    } catch {
      storage = null;
    }
    return new ZombieSave(storage);
  }

  load(): ZombiesSaveData {
    if (!this.storage) {
      this.lastError = 'Salvataggio Zombies non disponibile: la run resta in memoria.';
      this.data = defaultZombiesSave();
      return this.data;
    }
    try {
      const raw = this.storage.getItem(this.key);
      this.data = raw ? sanitizeZombiesSave(JSON.parse(raw)) : defaultZombiesSave();
      this.lastError = null;
    } catch {
      this.data = defaultZombiesSave();
      this.lastError = 'Salvataggio Zombies corrotto: ripristinato.';
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
      this.lastError = 'Memoria del browser piena: la run resta in memoria.';
      return false;
    }
  }

  get records(): ZombiesRecords {
    return this.data.records;
  }

  get active(): ZombiesRunSnapshot | null {
    return this.data.active;
  }

  snapshot(snapshot: ZombiesRunSnapshot | null): void {
    this.data.active = snapshot;
    this.save();
  }

  recordRun(result: { round: number; kills: number; points: number; extracted: boolean }): void {
    const records = this.data.records;
    records.bestRound = Math.max(records.bestRound, Math.max(0, Math.floor(result.round)));
    records.bestKills = Math.max(records.bestKills, Math.max(0, Math.floor(result.kills)));
    records.bestPoints = Math.max(records.bestPoints, Math.max(0, Math.floor(result.points)));
    records.runs += 1;
    if (result.extracted) records.extractions += 1;
    this.save();
  }

  /** Starts a brand-new run: the previous checkpoint is discarded. */
  startNew(): void {
    this.data.active = null;
    this.save();
  }

  clearActive(): void {
    this.data.active = null;
    this.save();
  }

  reset(): void {
    this.data = defaultZombiesSave();
    if (this.storage) {
      try {
        this.storage.removeItem(this.key);
      } catch {
        /* ignore */
      }
    }
    this.save();
  }
}
