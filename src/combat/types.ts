import type { AnimState } from '../graphics/AnimationSystem';

export type Team = 'player' | 'enemy';

export interface AttackSpec {
  id: string;
  label: string;
  anim: AnimState;
  damage: number;
  range: number;
  arc: number;
  windup: number;
  active: number;
  recovery: number;
  knockback: number;
  hitstun: number;
  hitstop: number;
  heavy: boolean;
  /** Fighter-facing name announced on HUD when the attack starts (defaults to label). */
  brandLabel?: string;
  aoe?: boolean;
  aoeRadius?: number;
  energyGain?: number;
  energyCost?: number;
  unblockable?: boolean;
  /** Visual telegraph radius; defaults to range. */
  telegraphRadius?: number;
  /** Telegraph ring color for threat-tier color coding. */
  telegraphColor?: string;
}

export interface ActiveAttack {
  serial: number;
  spec: AttackSpec;
  time: number;
  hitTargets: Set<number>;
  struckAoe: boolean;
  startedAt: number;
}

export interface HitInfo {
  damage: number;
  dirX: number;
  dirZ: number;
  knockback: number;
  hitstun: number;
  hitstop: number;
  heavy: boolean;
  specId: string;
  fromX: number;
  fromZ: number;
}

export interface Combatant {
  readonly id: number;
  readonly team: Team;
  posX: number;
  posZ: number;
  radius: number;
  forwardX: number;
  forwardZ: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  attack: ActiveAttack | null;
  isInvulnerable(): boolean;
  isDodging(): boolean;
  applyHit(info: HitInfo, attacker: Combatant): void;
}

export const PLAYER_PUNCH_1: AttackSpec = {
  id: 'punch1',
  label: 'DIRITTO',
  anim: 'punch1',
  damage: 8,
  range: 1.8,
  arc: 115,
  windup: 0.07,
  active: 0.09,
  recovery: 0.16,
  knockback: 2.4,
  hitstun: 0.16,
  hitstop: 0.045,
  heavy: false,
  energyGain: 6,
}

export const PLAYER_PUNCH_2: AttackSpec = {
  id: 'punch2',
  label: 'GANCIO',
  anim: 'punch2',
  damage: 10,
  range: 1.85,
  arc: 120,
  windup: 0.08,
  active: 0.09,
  recovery: 0.17,
  knockback: 2.8,
  hitstun: 0.18,
  hitstop: 0.05,
  heavy: false,
  energyGain: 7,
};

export const PLAYER_KICK: AttackSpec = {
  id: 'kick',
  label: 'CALCIO VOLANTE',
  anim: 'kick',
  damage: 20,
  range: 2.2,
  arc: 135,
  windup: 0.16,
  active: 0.11,
  recovery: 0.33,
  knockback: 6,
  hitstun: 0.34,
  hitstop: 0.085,
  heavy: true,
  energyGain: 11,
};

export const PLAYER_SPECIAL: AttackSpec = {
  id: 'special',
  label: 'RIVOLTA MILANESE',
  anim: 'special',
  damage: 30,
  range: 4.2,
  arc: 360,
  windup: 0.34,
  active: 0.1,
  recovery: 0.52,
  knockback: 8.5,
  hitstun: 0.65,
  hitstop: 0.13,
  heavy: true,
  aoe: true,
  aoeRadius: 4.1,
  energyCost: 100,
};

export function attackTotal(spec: AttackSpec): number {
  return spec.windup + spec.active + spec.recovery;
}
