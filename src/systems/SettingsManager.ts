export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  quality: Quality;
  master: number;
  music: number;
  sfx: number;
  mute: boolean;
  sensitivity: number;
  deadzone: number;
  shake: boolean;
  invertY: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'medium',
  master: 80,
  music: 60,
  sfx: 85,
  mute: false,
  sensitivity: 100,
  deadzone: 18,
  shake: true,
  invertY: false,
};

export function isQuality(value: unknown): value is Quality {
  return value === 'low' || value === 'medium' || value === 'high';
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Normalizes any unknown payload into a valid Settings object. */
export function sanitizeSettings(raw: unknown): Settings {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    quality: isQuality(source.quality) ? source.quality : DEFAULT_SETTINGS.quality,
    master: clamp(source.master, 0, 100, DEFAULT_SETTINGS.master),
    music: clamp(source.music, 0, 100, DEFAULT_SETTINGS.music),
    sfx: clamp(source.sfx, 0, 100, DEFAULT_SETTINGS.sfx),
    mute: typeof source.mute === 'boolean' ? source.mute : DEFAULT_SETTINGS.mute,
    sensitivity: clamp(source.sensitivity, 30, 220, DEFAULT_SETTINGS.sensitivity),
    deadzone: clamp(source.deadzone, 0, 45, DEFAULT_SETTINGS.deadzone),
    shake: typeof source.shake === 'boolean' ? source.shake : DEFAULT_SETTINGS.shake,
    invertY: typeof source.invertY === 'boolean' ? source.invertY : DEFAULT_SETTINGS.invertY,
  };
}

/** Picks a sensible starting quality for the device the game is running on. */
export function guessDefaultQuality(isTouch: boolean, deviceMemory?: number): Quality {
  if (!isTouch) return 'high';
  if (typeof deviceMemory === 'number' && deviceMemory <= 3) return 'low';
  return 'medium';
}
