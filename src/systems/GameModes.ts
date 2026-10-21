import type { BossId } from '../entities/Boss';
import { LEVELS } from '../world/LevelManager';
import type { WaveDefinition } from './WaveManager';

export type ModeId = 'campaign' | 'survival' | 'bossRush' | 'training' | 'challenge' | 'remix';

/** Survival and Boss Rush play in the Duomo; resolve by id so adding levels cannot move it. */
const DUOMO_INDEX = Math.max(0, LEVELS.findIndex((level) => level.id === 'duomo'));

export type ModifierId = 'tecnica' | 'pressione' | 'essenziale' | 'precisione';

export const MODIFIER_LABELS: Record<ModifierId, string> = {
  tecnica: 'TECNICA · MENO DANNO, PIÙ PUNTI',
  pressione: 'PRESSIONE · NEMICI PIÙ VELOCI E NUMEROSI',
  essenziale: 'ESSENZIALE · SALUTE RIDOTTA',
  precisione: 'PRECISIONE · NEMICI PIÙ DURI, COLPI PIÙ FORTI',
};

export interface ModeInfo {
  id: ModeId;
  name: string;
  kicker: string;
  description: string;
  tag: string;
}

export const MODES: ModeInfo[] = [
  {
    id: 'survival',
    name: 'SOPRAVVIVENZA',
    kicker: 'ONDATE SENZA FINE',
    description: 'Venti ondate nella piazza del Duomo, con un boss ogni cinque. Nessun livello da completare: solo il record.',
    tag: '20 ROUND · BOSS OGNI 5',
  },
  {
    id: 'bossRush',
    name: 'BOSS RUSH',
    kicker: 'SEI BOSS, UNA PIAZZA',
    description: 'Buttafuori, Trainer, DJ, Re del Borsello, Re dei Tetti e Consiglio, uno dopo l’altro. Nessuna pausa, nessun aiuto.',
    tag: '6 BOSS · FILA UNICA',
  },
  {
    id: 'training',
    name: 'ALLENAMENTO',
    kicker: 'SALA PROVE',
    description: 'Un manichino indistruttibile alla Stazione Centrale: combo, catena e schivata senza punteggi né record.',
    tag: 'NESSUN RECORD',
  },
  {
    id: 'challenge',
    name: 'SFIDE',
    kicker: 'SEED FISSI',
    description: 'Tre run con seed e modificatori dichiarati. Stesso seed, stessa configurazione: conta solo come le giochi.',
    tag: '3 SFIDE',
  },
  {
    id: 'remix',
    name: 'REMIX',
    kicker: 'MILANO RIMESCOLATA',
    description: 'Una piazza scelta dal seed, due modificatori e nemici rimescolati. Il seed è mostrato in HUD e nel risultato.',
    tag: 'SEED + 2 MOD',
  },
];

export interface ChallengeInfo {
  id: string;
  name: string;
  tag: string;
  levelIndex: number;
  modifiers: ModifierId[];
  seed: string;
}

export const CHALLENGES: ChallengeInfo[] = [
  {
    id: 'tecnica',
    name: 'TECNICA',
    tag: 'NAVIGLI · MENO DANNO, PIÙ PUNTI',
    levelIndex: 2,
    modifiers: ['tecnica'],
    seed: 'TECNICA-01',
  },
  {
    id: 'pressione',
    name: 'PRESSIONE',
    tag: 'METRO · NEMICI PIÙ VELOCI',
    levelIndex: 1,
    modifiers: ['pressione'],
    seed: 'PRESSIONE-02',
  },
  {
    id: 'essenziale',
    name: 'ESSENZIALE',
    tag: 'STAZIONE · SALUTE RIDOTTA',
    levelIndex: 0,
    modifiers: ['essenziale', 'precisione'],
    seed: 'ESSENZIALE-03',
  },
];

export interface ModifierEffects {
  playerDamage: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyDamage: number;
  enemySpeed: number;
  scoreMultiplier: number;
  extraAlive: number;
}

export function modifierEffects(modifiers: readonly ModifierId[]): ModifierEffects {
  const effects: ModifierEffects = {
    playerDamage: 1,
    playerMaxHp: 120,
    enemyHp: 1,
    enemyDamage: 1,
    enemySpeed: 1,
    scoreMultiplier: 1,
    extraAlive: 0,
  };
  for (const modifier of modifiers) {
    if (modifier === 'tecnica') {
      effects.playerDamage *= 0.8;
      effects.scoreMultiplier *= 1.5;
    } else if (modifier === 'pressione') {
      effects.enemySpeed *= 1.2;
      effects.enemyDamage *= 1.1;
      effects.extraAlive += 1;
    } else if (modifier === 'essenziale') {
      effects.playerMaxHp = Math.min(effects.playerMaxHp, 80);
      effects.enemyHp *= 1.15;
    } else if (modifier === 'precisione') {
      effects.enemyHp *= 1.25;
      effects.playerDamage *= 1.15;
      effects.scoreMultiplier *= 1.2;
    }
  }
  return effects;
}

export interface RunRules {
  mode: ModeId;
  label: string;
  seed: string;
  levelIndex: number;
  modifiers: ModifierId[];
  recordKey: string;
  records: boolean;
  training: boolean;
  bossRush: BossId[] | null;
  waves: WaveDefinition[] | null;
  effects: ModifierEffects;
}

/** FNV-1a: stable across reloads and shared seeds. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32, seeded from a text seed. */
export function createRng(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic wave for the survival ladder; every fifth round is a boss. */
export function survivalWave(round: number): WaveDefinition {
  if (round % 5 === 0) {
    return {
      label: `ROUND ${round} · BOSS`,
      maxAlive: 2,
      spawns: [
        { kind: 'boss', count: 1, interval: 0 },
        { kind: 'base', count: 1 + Math.floor(round / 10), interval: 1.4 },
      ],
    };
  }
  const base = 2 + Math.floor(round * 0.7);
  const turbo = round >= 3 ? 1 + Math.floor(round * 0.25) : 0;
  const puffer = round >= 5 ? 1 + Math.floor(round * 0.15) : 0;
  return {
    label: `ROUND ${round}`,
    maxAlive: Math.min(7, 2 + Math.floor(round / 2)),
    spawns: [
      { kind: 'base', count: base, interval: 0.9 },
      { kind: 'turbo', count: turbo, interval: 0.7 },
      { kind: 'puffer', count: puffer, interval: 1.25 },
    ],
  };
}

export function survivalWaves(rounds = 20): WaveDefinition[] {
  return Array.from({ length: rounds }, (_, index) => survivalWave(index + 1));
}

export function decorateWaves(waves: WaveDefinition[], effects: ModifierEffects): WaveDefinition[] {
  if (effects.extraAlive === 0) return waves.map((wave) => ({ ...wave }));
  return waves.map((wave) => ({
    ...wave,
    maxAlive: wave.maxAlive + effects.extraAlive,
    spawns: wave.spawns.map((spawn, index) =>
      index === 0 ? { ...spawn, count: spawn.count + effects.extraAlive } : { ...spawn },
    ),
  }));
}

const BOSS_RUSH_ORDER: BossId[] = ['buttafuori', 'trainer', 'dj', 'borsello', 'tetti', 'consiglio'];

function campaignRules(): RunRules {
  return {
    mode: 'campaign',
    label: '',
    seed: '',
    levelIndex: 0,
    modifiers: [],
    recordKey: '',
    records: false,
    training: false,
    bossRush: null,
    waves: null,
    effects: modifierEffects([]),
  };
}

export function modeRules(mode: ModeId, challengeId = 'tecnica', seedInput?: string): RunRules {
  if (mode === 'campaign') return campaignRules();
  if (mode === 'survival') {
    return {
      ...campaignRules(),
      mode,
      label: 'SOPRAVVIVENZA',
      recordKey: 'survival',
      seed: 'SURVIVAL-20',
      levelIndex: DUOMO_INDEX,
      records: true,
      waves: survivalWaves(20),
    };
  }
  if (mode === 'bossRush') {
    return {
      ...campaignRules(),
      mode,
      label: 'BOSS RUSH',
      recordKey: 'boss-rush',
      seed: 'BOSS-RUSH',
      levelIndex: DUOMO_INDEX,
      records: true,
      bossRush: [...BOSS_RUSH_ORDER],
    };
  }
  if (mode === 'training') {
    return {
      ...campaignRules(),
      mode,
      label: 'ALLENAMENTO',
      recordKey: 'training',
      seed: 'TRAINING',
      levelIndex: 0,
      training: true,
    };
  }
  if (mode === 'challenge') {
    const challenge = CHALLENGES.find((entry) => entry.id === challengeId) ?? CHALLENGES[0]!;
    const effects = modifierEffects(challenge.modifiers);
    return {
      ...campaignRules(),
      mode,
      label: `SFIDA · ${challenge.name}`,
      seed: challenge.seed,
      levelIndex: challenge.levelIndex,
      modifiers: [...challenge.modifiers],
      recordKey: `challenge-${challenge.id}`,
      records: true,
      waves: decorateWaves(LEVELS[challenge.levelIndex]?.waves ?? [], effects),
      effects,
    };
  }
  // Remix: the seed picks the arena and two modifiers.
  const seed = seedInput ?? `REMIX-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const hash = hashSeed(seed);
  const levelIndex = hash % LEVELS.length;
  const pool: ModifierId[] = ['tecnica', 'pressione', 'essenziale', 'precisione'];
  const first = pool[hash % pool.length]!;
  const second = pool[(hash >>> 5) % pool.length]!;
  const modifiers: ModifierId[] = first === second ? [first] : [first, second];
  const effects = modifierEffects(modifiers);
  return {
    ...campaignRules(),
    mode: 'remix',
    label: 'REMIX',
    seed,
    levelIndex,
    modifiers,
    recordKey: 'remix',
    records: true,
    waves: decorateWaves(LEVELS[levelIndex]?.waves ?? [], effects),
    effects,
  };
}

export function campaignRulesFor(): RunRules {
  return campaignRules();
}
