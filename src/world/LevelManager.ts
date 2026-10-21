import * as THREE from 'three';
import type { Physics } from '../core/Physics';
import type { Quality } from '../systems/SettingsManager';
import type { WaveDefinition } from '../systems/WaveManager';
import type { MusicTrack } from '../audio/AudioManager';
import type { LevelId } from '../systems/levelIds';
import {
  buildDarsena,
  buildDuomo,
  buildIsola,
  buildMetro,
  buildNavigli,
  buildPortaVenezia,
  buildSempione,
  buildStation,
  buildTowers,
  type ArenaBuild,
} from './Arena';
import type { LevelBuilder } from './Environment';

export interface Chapter {
  number: number;
  title: string;
  subtitle: string;
  /** Short tag shown on the level card. */
  tag: string;
}

export const CHAPTERS: Chapter[] = [
  { number: 1, title: 'CAPITOLO I', subtitle: 'STAZIONE → NAVIGLI', tag: 'CENTRO' },
  { number: 2, title: 'CAPITOLO II', subtitle: 'DUOMO → SEMPIONE', tag: 'PIAZZE' },
  { number: 3, title: 'CAPITOLO III', subtitle: 'ISOLA → TETTI', tag: 'QUARTIERI' },
];

export interface LevelConfig {
  /** Stable save key: never derive progress from the array position. */
  id: LevelId;
  number: number;
  chapter: number;
  name: string;
  shortName: string;
  subtitle: string;
  music: MusicTrack;
  bossMusic: MusicTrack;
  /** True when the level ends with a boss fight instead of a normal clear. */
  boss: boolean;
  bossName?: string;
  hpScale: number;
  damageScale: number;
  maxAttackers: number;
  waves: WaveDefinition[];
  fogColor: number;
  fogNear: number;
  fogFar: number;
  build(physics: Physics, quality: Quality): ArenaBuild;
}

export interface BuiltLevel {
  config: LevelConfig;
  arena: ArenaBuild;
  builder: LevelBuilder;
}

export const LEVELS: LevelConfig[] = [
  {
    id: 'stazione',
    number: 1,
    chapter: 1,
    name: 'STAZIONE CENTRALE',
    shortName: 'STAZIONE',
    subtitle: 'MILANO · ORE 23:41',
    music: 'level1',
    bossMusic: 'level1',
    boss: false,
    hpScale: 1,
    damageScale: 1,
    maxAttackers: 1,
    fogColor: 0x0b0c14,
    fogNear: 26,
    fogFar: 105,
    build: buildStation,
    waves: [
      {
        label: 'PRIMO ROUND',
        maxAlive: 2,
        spawns: [{ kind: 'base', count: 3, interval: 1.15 }],
      },
      {
        label: 'TURBO IN ARRIVO',
        maxAlive: 3,
        spawns: [
          { kind: 'base', count: 2, interval: 1.1 },
          { kind: 'turbo', count: 2, interval: 0.85 },
        ],
      },
      {
        label: 'RESSA ALLA STAZIONE',
        maxAlive: 3,
        spawns: [
          { kind: 'base', count: 2, interval: 1.0 },
          { kind: 'turbo', count: 3, interval: 0.8 },
        ],
      },
    ],
  },
  {
    id: 'metro',
    number: 2,
    chapter: 1,
    name: 'METRO MILANO',
    shortName: 'METRO',
    subtitle: 'LINEA GIALLA · BINARIO 3',
    music: 'level2',
    bossMusic: 'level2',
    boss: false,
    hpScale: 1.12,
    damageScale: 1.05,
    maxAttackers: 2,
    fogColor: 0x071012,
    fogNear: 14,
    fogFar: 60,
    build: buildMetro,
    waves: [
      {
        label: 'BANCHINA OCCUPATA',
        maxAlive: 3,
        spawns: [
          { kind: 'base', count: 3, interval: 0.95 },
          { kind: 'turbo', count: 2, interval: 0.8 },
        ],
      },
      {
        label: 'PUFFER SUL BINARIO',
        maxAlive: 3,
        spawns: [
          { kind: 'puffer', count: 2, interval: 1.6 },
          { kind: 'base', count: 2, interval: 1.0 },
        ],
      },
      {
        label: 'ULTIMO TRENO',
        maxAlive: 4,
        spawns: [
          { kind: 'puffer', count: 2, interval: 1.4 },
          { kind: 'turbo', count: 3, interval: 0.75 },
          { kind: 'base', count: 2, interval: 1.0 },
        ],
      },
    ],
  },
  {
    id: 'navigli',
    number: 3,
    chapter: 1,
    name: 'NAVIGLI NIGHTLIFE',
    shortName: 'NAVIGLI',
    subtitle: 'RIPA DI PORTA · ORE 1:20',
    music: 'level3',
    bossMusic: 'level3',
    boss: false,
    hpScale: 1.22,
    damageScale: 1.12,
    maxAttackers: 2,
    fogColor: 0x0d0714,
    fogNear: 22,
    fogFar: 92,
    build: buildNavigli,
    waves: [
      {
        label: 'APERITIVO ROVINATO',
        maxAlive: 3,
        spawns: [
          { kind: 'base', count: 3, interval: 0.95 },
          { kind: 'turbo', count: 2, interval: 0.8 },
        ],
      },
      {
        label: 'SPRITZ E BOTTE',
        maxAlive: 3,
        spawns: [
          { kind: 'puffer', count: 2, interval: 1.4 },
          { kind: 'base', count: 2, interval: 0.9 },
          { kind: 'turbo', count: 1, interval: 0.8 },
        ],
      },
      {
        label: 'RIVA OCCUPATA',
        maxAlive: 4,
        spawns: [
          { kind: 'turbo', count: 3, interval: 0.72 },
          { kind: 'puffer', count: 2, interval: 1.3 },
          { kind: 'base', count: 2, interval: 0.9 },
        ],
      },
      {
        label: 'ULTIMO GIRO',
        maxAlive: 4,
        spawns: [
          { kind: 'turbo', count: 4, interval: 0.66 },
          { kind: 'puffer', count: 2, interval: 1.2 },
          { kind: 'base', count: 2, interval: 0.85 },
        ],
      },
    ],
  },
  {
    id: 'duomo',
    number: 4,
    chapter: 2,
    name: 'DUOMO SHOWDOWN',
    shortName: 'DUOMO',
    subtitle: 'PIAZZA DEL DUOMO · ORE 3:00',
    music: 'level5',
    bossMusic: 'boss',
    boss: true,
    bossName: 'IL RE DEL BORSELLO',
    hpScale: 1.32,
    damageScale: 1.15,
    maxAttackers: 2,
    fogColor: 0x0c0912,
    fogNear: 24,
    fogFar: 110,
    build: buildDuomo,
    waves: [
      {
        label: 'PIAZZA IN FESTA',
        maxAlive: 3,
        spawns: [
          { kind: 'base', count: 4, interval: 0.9 },
          { kind: 'turbo', count: 2, interval: 0.85 },
        ],
      },
      {
        label: 'LA GUARDIA DEL RE',
        maxAlive: 4,
        spawns: [
          { kind: 'puffer', count: 3, interval: 1.3 },
          { kind: 'turbo', count: 3, interval: 0.7 },
        ],
      },
      {
        label: 'IL RE DEL BORSELLO',
        maxAlive: 1,
        spawns: [{ kind: 'boss', count: 1, interval: 0 }],
      },
    ],
  },
  {
    id: 'porta-venezia',
    number: 5,
    chapter: 2,
    name: 'PORTA VENEZIA',
    shortName: 'PORTA VENEZIA',
    subtitle: 'CORSO BUENOS AIRES · ORE 2:10',
    music: 'level3',
    bossMusic: 'level3',
    boss: false,
    hpScale: 1.4,
    damageScale: 1.2,
    maxAttackers: 3,
    fogColor: 0x0b0a12,
    fogNear: 24,
    fogFar: 96,
    build: buildPortaVenezia,
    waves: [
      {
        label: 'VETRINE ROTTE',
        maxAlive: 3,
        spawns: [
          { kind: 'base', count: 3, interval: 0.95 },
          { kind: 'turbo', count: 3, interval: 0.8 },
        ],
      },
      {
        label: 'MARANZA IN FILA',
        maxAlive: 4,
        spawns: [
          { kind: 'puffer', count: 2, interval: 1.3 },
          { kind: 'turbo', count: 3, interval: 0.72 },
        ],
      },
      {
        label: 'SOTTO I PORTICI',
        maxAlive: 4,
        spawns: [
          { kind: 'base', count: 3, interval: 0.85 },
          { kind: 'turbo', count: 3, interval: 0.68 },
          { kind: 'puffer', count: 2, interval: 1.2 },
        ],
      },
      {
        label: 'CORSO CHIUSO',
        maxAlive: 4,
        spawns: [
          { kind: 'turbo', count: 4, interval: 0.64 },
          { kind: 'puffer', count: 3, interval: 1.15 },
          { kind: 'base', count: 2, interval: 0.85 },
        ],
      },
    ],
  },
  {
    id: 'sempione',
    number: 6,
    chapter: 2,
    name: 'PARCO SEMPIONE',
    shortName: 'SEMPIONE',
    subtitle: 'VERSO IL CASTELLO · ORE 2:40',
    music: 'level4',
    bossMusic: 'level4',
    boss: false,
    hpScale: 1.48,
    damageScale: 1.24,
    maxAttackers: 3,
    fogColor: 0x080a12,
    fogNear: 26,
    fogFar: 100,
    build: buildSempione,
    waves: [
      {
        label: 'PRATO OCCUPATO',
        maxAlive: 3,
        spawns: [
          { kind: 'base', count: 3, interval: 0.9 },
          { kind: 'puffer', count: 1, interval: 1.6 },
        ],
      },
      {
        label: 'PANCHINE OSTILI',
        maxAlive: 4,
        spawns: [
          { kind: 'turbo', count: 3, interval: 0.76 },
          { kind: 'puffer', count: 2, interval: 1.35 },
        ],
      },
      {
        label: 'LAGHETTO IN FIAMME',
        maxAlive: 4,
        spawns: [
          { kind: 'turbo', count: 4, interval: 0.68 },
          { kind: 'base', count: 3, interval: 0.82 },
        ],
      },
      {
        label: 'NOTTE BIANCA',
        maxAlive: 5,
        spawns: [
          { kind: 'turbo', count: 4, interval: 0.62 },
          { kind: 'puffer', count: 3, interval: 1.15 },
          { kind: 'base', count: 3, interval: 0.8 },
        ],
      },
    ],
  },
  {
    id: 'isola',
    number: 7,
    chapter: 3,
    name: 'ISOLA',
    shortName: 'ISOLA',
    subtitle: 'CANTIERE DELLE TORRI · ORE 3:20',
    music: 'level4',
    bossMusic: 'level4',
    boss: false,
    hpScale: 1.56,
    damageScale: 1.28,
    maxAttackers: 3,
    fogColor: 0x07070f,
    fogNear: 22,
    fogFar: 88,
    build: buildIsola,
    waves: [
      {
        label: 'CANTIERE APERTO',
        maxAlive: 4,
        spawns: [
          { kind: 'turbo', count: 3, interval: 0.8 },
          { kind: 'base', count: 3, interval: 0.9 },
        ],
      },
      {
        label: 'CONTAINER BLOCCATI',
        maxAlive: 4,
        spawns: [
          { kind: 'puffer', count: 3, interval: 1.25 },
          { kind: 'turbo', count: 3, interval: 0.72 },
        ],
      },
      {
        label: 'TURNO DI NOTTE',
        maxAlive: 5,
        spawns: [
          { kind: 'turbo', count: 4, interval: 0.66 },
          { kind: 'base', count: 3, interval: 0.8 },
          { kind: 'puffer', count: 2, interval: 1.15 },
        ],
      },
      {
        label: 'GRU IMPAZZITA',
        maxAlive: 5,
        spawns: [
          { kind: 'turbo', count: 5, interval: 0.6 },
          { kind: 'puffer', count: 3, interval: 1.05 },
          { kind: 'base', count: 2, interval: 0.78 },
        ],
      },
    ],
  },
  {
    id: 'darsena',
    number: 8,
    chapter: 3,
    name: 'DARSENA',
    shortName: 'DARSENA',
    subtitle: 'NAVIGLIO GRANDE · ORE 3:50',
    music: 'level3',
    bossMusic: 'level3',
    boss: false,
    hpScale: 1.64,
    damageScale: 1.32,
    maxAttackers: 3,
    fogColor: 0x060810,
    fogNear: 24,
    fogFar: 92,
    build: buildDarsena,
    waves: [
      {
        label: 'MERCATO NOTTURNO',
        maxAlive: 4,
        spawns: [
          { kind: 'base', count: 4, interval: 0.86 },
          { kind: 'turbo', count: 3, interval: 0.74 },
        ],
      },
      {
        label: 'BANCHI ROVESCIATI',
        maxAlive: 4,
        spawns: [
          { kind: 'puffer', count: 2, interval: 1.3 },
          { kind: 'turbo', count: 4, interval: 0.68 },
        ],
      },
      {
        label: 'FARO SPENTO',
        maxAlive: 5,
        spawns: [
          { kind: 'turbo', count: 5, interval: 0.62 },
          { kind: 'puffer', count: 3, interval: 1.1 },
          { kind: 'base', count: 2, interval: 0.82 },
        ],
      },
      {
        label: 'ULTIMA CHIAMATA',
        maxAlive: 5,
        spawns: [
          { kind: 'turbo', count: 5, interval: 0.58 },
          { kind: 'puffer', count: 4, interval: 1.0 },
          { kind: 'base', count: 3, interval: 0.76 },
        ],
      },
    ],
  },
  {
    id: 'tetti',
    number: 9,
    chapter: 3,
    name: 'TETTI DI MILANO',
    shortName: 'TETTI',
    subtitle: 'BOSCO VERTICALE · 90 METRI',
    music: 'level5',
    bossMusic: 'boss',
    boss: true,
    bossName: 'IL RE DEI TETTI',
    hpScale: 1.75,
    damageScale: 1.38,
    maxAttackers: 3,
    fogColor: 0x090614,
    fogNear: 20,
    fogFar: 130,
    build: buildTowers,
    waves: [
      {
        label: 'TETTO PRIVATO',
        maxAlive: 3,
        spawns: [
          { kind: 'turbo', count: 3, interval: 0.8 },
          { kind: 'base', count: 2, interval: 0.95 },
        ],
      },
      {
        label: 'MANUTENZIONE OSTILE',
        maxAlive: 4,
        spawns: [
          { kind: 'puffer', count: 2, interval: 1.3 },
          { kind: 'base', count: 3, interval: 0.85 },
          { kind: 'turbo', count: 1, interval: 0.8 },
        ],
      },
      {
        label: 'VENTO IN QUOTA',
        maxAlive: 4,
        spawns: [
          { kind: 'turbo', count: 4, interval: 0.68 },
          { kind: 'puffer', count: 2, interval: 1.2 },
        ],
      },
      {
        label: 'ASSEDIO SUL TETTO',
        maxAlive: 5,
        spawns: [
          { kind: 'base', count: 3, interval: 0.8 },
          { kind: 'turbo', count: 3, interval: 0.65 },
          { kind: 'puffer', count: 3, interval: 1.15 },
        ],
      },
      {
        label: 'IL RE DEI TETTI',
        maxAlive: 1,
        spawns: [{ kind: 'boss', count: 1, interval: 0 }],
      },
    ],
  },
];

export class LevelManager {
  private readonly scene: THREE.Scene;
  private readonly physics: Physics;
  private quality: Quality;
  current: BuiltLevel | null = null;

  constructor(scene: THREE.Scene, physics: Physics, quality: Quality) {
    this.scene = scene;
    this.physics = physics;
    this.quality = quality;
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
  }

  load(index: number): BuiltLevel {
    this.unload();
    const config = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
    if (!config) throw new Error('Livello inesistente');
    const arena = config.build(this.physics, this.quality);
    arena.group.name = `level-${config.number}`;
    this.scene.add(arena.group);
    this.scene.fog = new THREE.Fog(config.fogColor, config.fogNear, config.fogFar);
    this.scene.background = new THREE.Color(config.fogColor);
    this.current = { config, arena, builder: arena.builder };
    return this.current;
  }

  unload(): void {
    if (!this.current) return;
    this.current.builder.dispose();
    this.scene.fog = null;
    this.current = null;
    this.physics.resetWorld();
  }

  /** Drives per-level animated props (water, boats, blinking beacons). */
  tick(dt: number): void {
    this.current?.builder.tick(dt);
  }

  get levelNumber(): number {
    return this.current?.config.number ?? 1;
  }
}
