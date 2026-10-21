/**
 * Stable level identifiers. Saves, unlocks and analytics use these strings,
 * never the position of a level inside the LEVELS array, so re-ordering the
 * campaign cannot corrupt a player's progress.
 */
export const LEVEL_IDS = [
  'stazione',
  'metro',
  'navigli',
  'duomo',
  'porta-venezia',
  'sempione',
  'isola',
  'darsena',
  'tetti',
] as const;

export type LevelId = (typeof LEVEL_IDS)[number];

export const LEVEL_COUNT = LEVEL_IDS.length;

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && (LEVEL_IDS as readonly string[]).includes(value);
}

export function levelIndex(id: LevelId): number {
  return LEVEL_IDS.indexOf(id);
}

/** Old positional save order before the expansion. */
export const LEGACY_LEVEL_ORDER = ['stazione', 'metro', 'navigli', 'tetti', 'duomo'] as const;
