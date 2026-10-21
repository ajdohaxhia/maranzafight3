import * as THREE from 'three';
import type { AttackSpec, Combatant, HitInfo } from '../combat/types';
import type { AttackDirector } from '../ai/AttackDirector';
import type { CombatSystem } from '../combat/CombatSystem';
import type { Physics } from '../core/Physics';
import type { CharacterFactory } from '../graphics/CharacterFactory';
import { Enemy, type EnemyArchetype, type EnemyContext, type EnemyScaling } from './Enemy';

export const BOSS_ARCHETYPE: EnemyArchetype = {
  kind: 'boss',
  label: 'IL RE DEL BORSELLO',
  look: 'boss',
  hp: 520,
  speed: 2.95,
  damage: 20,
  range: 3.35,
  arc: 160,
  windup: 0.6,
  active: 0.16,
  recovery: 0.55,
  knockback: 8,
  hitstun: 0.4,
  poise: 240,
  stunDuration: 0.4,
  cooldownMin: 1.6,
  cooldownMax: 2.5,
  score: 6000,
  attackAnim: 'bag',
  radius: 0.5,
  halfHeight: 0.62,
  desiredDistance: 2.6,
};

export const BOSS_BAG: AttackSpec = {
  id: 'bossBag',
  label: 'BORSELLATA',
  anim: 'bag',
  damage: 20,
  range: 3.4,
  arc: 170,
  windup: 0.55,
  active: 0.18,
  recovery: 0.55,
  knockback: 8,
  hitstun: 0.36,
  hitstop: 0.1,
  heavy: true,
  telegraphRadius: 3.4,
};

export const BOSS_SLAM: AttackSpec = {
  id: 'bossSlam',
  label: 'TERREMOTO DA PIAZZA',
  anim: 'slam',
  damage: 24,
  range: 3.9,
  arc: 360,
  windup: 0.95,
  active: 0.12,
  recovery: 0.72,
  knockback: 10,
  hitstun: 0.5,
  hitstop: 0.14,
  heavy: true,
  aoe: true,
  aoeRadius: 3.9,
  telegraphRadius: 3.9,
};

export const BOSS_CHARGE: AttackSpec = {
  id: 'bossCharge',
  label: 'CARICA DEL RE',
  anim: 'charge',
  damage: 18,
  range: 2.35,
  arc: 95,
  windup: 0.52,
  active: 0.36,
  recovery: 0.6,
  knockback: 9,
  hitstun: 0.4,
  hitstop: 0.09,
  heavy: true,
  telegraphRadius: 2.2,
};

export class Boss extends Enemy {
  phase = 1;
  phaseTransitionTimer = 0;
  introMode = false;
  onPhaseChange: ((phase: number) => void) | null = null;
  private attackCycle = 0;

  constructor(
    physics: Physics,
    factory: CharacterFactory,
    combat: CombatSystem,
    director: AttackDirector,
    spawn: THREE.Vector3,
    scaling: EnemyScaling,
  ) {
    super(physics, factory, combat, director, BOSS_ARCHETYPE, spawn, scaling, 0);
    this.postHitInvuln = 0.07;
    this.anim.play('intro', { reset: true });
  }

  beginIntro(): void {
    this.introMode = true;
    this.invulnTimer = 999;
    this.controlNone();
    this.anim.play('intro', { reset: true });
  }

  endIntro(): void {
    this.introMode = false;
    this.invulnTimer = 0;
    this.anim.play('roar', { reset: true });
    this.attackCooldown = 0.6;
  }

  controlNone(): void {
    this.attack = null;
    this.releaseToken();
  }

  get phaseLabel(): string {
    if (this.phase === 1) return 'FASE I — TRUCCIDERO';
    if (this.phase === 2) return 'FASE II — STRADA';
    return 'FASE III — TUTTO O NIENTE';
  }

  override update(dt: number, ctx: EnemyContext): void {
    this.lastPlayerX = ctx.playerX;
    this.lastPlayerZ = ctx.playerZ;
    if (this.introMode) {
      this.anim.play('intro');
      this.faceTowards(ctx.playerX, ctx.playerZ);
      this.updateFacing(dt);
      return;
    }

    this.checkPhase();

    if (this.phaseTransitionTimer > 0) {
      this.phaseTransitionTimer = Math.max(0, this.phaseTransitionTimer - dt);
      this.invulnTimer = Math.max(this.invulnTimer, 0.1);
      this.anim.play('roar');
      this.moveHorizontal(dt, 0, 0);
      this.faceTowards(ctx.playerX, ctx.playerZ);
      this.updateFacing(dt);
      return;
    }

    super.update(dt, ctx);
  }

  private checkPhase(): void {
    if (!this.alive) return;
    const ratio = this.hp / this.maxHp;
    const next = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (next === this.phase) return;
    this.phase = next;
    this.phaseTransitionTimer = 1.5;
    this.invulnTimer = 1.5;
    this.controlNone();
    this.hurtTimer = 0;
    this.stunTimer = 0;
    this.attackCooldownScale = next === 2 ? 0.86 : next === 3 ? 0.7 : 1;
    this.speedMultiplier = next === 2 ? 1.1 : next === 3 ? 1.24 : 1;
    this.anim.play('roar', { reset: true });
    this.onPhaseChange?.(next);
  }

  protected override makeAttackSpec(): AttackSpec {
    const inMelee = Math.hypot(this.posX - (this.lastPlayerX ?? this.posX), this.posZ - (this.lastPlayerZ ?? this.posZ)) < 3.1;
    this.attackCycle += 1;
    if (this.phase >= 2 && inMelee && this.attackCycle % 2 === 0) {
      return { ...BOSS_SLAM, damage: 24 * this.damageMultiplier, range: 3.9 };
    }
    if (inMelee) {
      return { ...BOSS_BAG, damage: 20 * this.damageMultiplier, range: 3.4 };
    }
    if (this.phase === 3 && this.attackCycle % 3 === 0) {
      return { ...BOSS_SLAM, damage: 24 * this.damageMultiplier };
    }
    return { ...BOSS_CHARGE, damage: 18 * this.damageMultiplier };
  }

  private lastPlayerX: number | null = null;
  private lastPlayerZ: number | null = null;
  get damageMultiplier(): number {
    return this.phase === 3 ? 1.18 : this.phase === 2 ? 1.08 : 1;
  }

  protected override onHurt(info: HitInfo, attacker: Combatant): void {
    const superArmor = this.attack !== null && !info.heavy;
    if (superArmor) {
      this.poise -= info.damage;
      if (this.poise <= 0) {
        this.poise = this.archetype.poise;
        this.stunTimer = this.archetype.stunDuration;
        this.hurtTimer = 0.2;
        this.controlNone();
      }
      return;
    }
    super.onHurt(info, attacker);
  }
}
