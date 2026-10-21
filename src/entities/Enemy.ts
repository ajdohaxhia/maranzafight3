import * as THREE from 'three';
import type { AttackSpec, Combatant, HitInfo } from '../combat/types';
import type { CharacterFactory, CharacterLook } from '../graphics/CharacterFactory';
import type { AnimState } from '../graphics/AnimationSystem';
import { StateMachine } from '../ai/StateMachine';
import type { AttackDirector } from '../ai/AttackDirector';
import type { CombatSystem } from '../combat/CombatSystem';
import type { Physics } from '../core/Physics';
import { Fighter } from './Fighter';
import type { Player } from './Player';

export type EnemyState =
  | 'idle'
  | 'patrol'
  | 'alert'
  | 'chase'
  | 'reposition'
  | 'attack'
  | 'recover'
  | 'hurt'
  | 'stunned'
  | 'defeated';

export type EnemyKind = 'base' | 'puffer' | 'turbo' | 'boss';

export interface EnemyArchetype {
  kind: EnemyKind;
  label: string;
  look: CharacterLook;
  hp: number;
  speed: number;
  damage: number;
  range: number;
  arc: number;
  windup: number;
  active: number;
  recovery: number;
  knockback: number;
  hitstun: number;
  poise: number;
  stunDuration: number;
  cooldownMin: number;
  cooldownMax: number;
  score: number;
  attackAnim: AnimState;
  radius: number;
  halfHeight: number;
  desiredDistance: number;
}

export interface EnemyContext {
  player: Player;
  playerX: number;
  playerZ: number;
  playerAlive: boolean;
  enemies: Enemy[];
  director: AttackDirector;
  combat: CombatSystem;
  time: number;
}

export const ENEMY_ARCHETYPES: Record<Exclude<EnemyKind, 'boss'>, EnemyArchetype> = {
  base: {
    kind: 'base',
    label: 'MARANZA BASE',
    look: 'base',
    hp: 46,
    speed: 3.35,
    damage: 9,
    range: 1.85,
    arc: 110,
    windup: 0.44,
    active: 0.1,
    recovery: 0.46,
    knockback: 3,
    hitstun: 0.24,
    poise: 26,
    stunDuration: 0.7,
    cooldownMin: 1.35,
    cooldownMax: 2.3,
    score: 120,
    attackAnim: 'punch1',
    radius: 0.37,
    halfHeight: 0.52,
    desiredDistance: 1.75,
  },
  puffer: {
    kind: 'puffer',
    label: 'MARANZA PUFFER',
    look: 'puffer',
    hp: 92,
    speed: 2.45,
    damage: 17,
    range: 2.15,
    arc: 125,
    windup: 0.66,
    active: 0.12,
    recovery: 0.62,
    knockback: 7,
    hitstun: 0.36,
    poise: 72,
    stunDuration: 0.95,
    cooldownMin: 2.1,
    cooldownMax: 3.1,
    score: 220,
    attackAnim: 'slam',
    radius: 0.44,
    halfHeight: 0.58,
    desiredDistance: 2.1,
  },
  turbo: {
    kind: 'turbo',
    label: 'MARANZA TURBO',
    look: 'turbo',
    hp: 34,
    speed: 4.5,
    damage: 7,
    range: 1.7,
    arc: 100,
    windup: 0.3,
    active: 0.08,
    recovery: 0.32,
    knockback: 2.2,
    hitstun: 0.18,
    poise: 17,
    stunDuration: 0.6,
    cooldownMin: 0.85,
    cooldownMax: 1.5,
    score: 150,
    attackAnim: 'punch2',
    radius: 0.34,
    halfHeight: 0.5,
    desiredDistance: 1.55,
  },
};

export interface EnemyScaling {
  hp: number;
  damage: number;
}

export class Enemy extends Fighter {
  readonly archetype: EnemyArchetype;
  readonly ai: StateMachine<EnemyState>;
  readonly home = new THREE.Vector3();
  readonly director: AttackDirector;
  readonly combat: CombatSystem;
  poise: number;
  hurtTimer = 0;
  stunTimer = 0;
  dodgeTimer = 0;
  attackCooldown = 0;
  dodgeCooldown = 0;
  hasToken = false;
  rewarded = false;
  deathHandled = false;
  isDebug = false;
  attackCooldownScale = 1;
  speedMultiplier = 1;
  protected readonly damageScale: number;
  private strafeDir: 1 | -1 = 1;
  private strafeTimer = 1.5;
  private patrolX = 0;
  private patrolZ = 0;
  private patrolTimer = 0;
  private lastAttackSerial = -1;
  private dodgeDir = new THREE.Vector3(1, 0, 0);

  constructor(
    physics: Physics,
    factory: CharacterFactory,
    combat: CombatSystem,
    director: AttackDirector,
    archetype: EnemyArchetype,
    spawn: THREE.Vector3,
    scaling: EnemyScaling,
    variant = 0,
  ) {
    super(physics, factory, {
      team: 'enemy',
      look: archetype.look,
      variant,
      radius: archetype.radius,
      halfHeight: archetype.halfHeight,
      maxHp: Math.round(archetype.hp * scaling.hp),
      spawn,
      yaw: Math.random() * Math.PI * 2,
    });
    this.archetype = archetype;
    this.combat = combat;
    this.director = director;
    this.damageScale = scaling.damage;
    this.poise = archetype.poise;
    this.home.copy(spawn);
    this.attackCooldown = 0.4 + Math.random() * 0.8;
    this.strafeTimer = 1 + Math.random() * 2;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.ai = new StateMachine<EnemyState>('idle');
    for (const state of [
      'idle',
      'patrol',
      'alert',
      'chase',
      'reposition',
      'attack',
      'recover',
      'hurt',
      'stunned',
      'defeated',
    ] as const) {
      this.ai.add(state, {});
    }
  }

  get archetypeLabel(): string {
    return this.archetype.label;
  }

  override isDodging(): boolean {
    return this.dodgeTimer > 0 && this.invulnTimer > 0;
  }

  update(dt: number, ctx: EnemyContext): void {
    this.tickTimers(dt);
    if (this.hurtTimer > 0) this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);
    if (this.dodgeTimer > 0) this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    if (this.dodgeCooldown > 0) this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.stunTimer <= 0 && this.hurtTimer <= 0) {
      this.poise = Math.min(this.archetype.poise, this.poise + dt * 7);
    }
    this.ai.update(dt);

    if (!this.alive) {
      this.ai.set('defeated');
      this.anim.play('ko', { duration: 1.1 });
      return;
    }

    const dist = Math.hypot(ctx.playerX - this.posX, ctx.playerZ - this.posZ);

    if (this.stunTimer > 0) {
      this.releaseToken();
      this.attack = null;
      this.ai.set('stunned');
      this.anim.play('stun');
      this.moveHorizontal(dt, 0, 0);
      this.faceTowards(ctx.playerX, ctx.playerZ);
      this.updateFacing(dt);
      return;
    }

    if (this.hurtTimer > 0) {
      this.ai.set('hurt');
      this.anim.play('hurt', { duration: 0.36 });
      this.moveHorizontal(dt, 0, 0);
      this.updateFacing(dt);
      return;
    }

    if (this.attack) {
      this.ai.set('attack');
      this.updateAttack(dt);
      this.updateFacing(dt);
      this.anim.setAttack(
        this.attack.spec.anim,
        Math.min(1, this.attack.time / Math.max(0.001, this.attack.spec.windup + this.attack.spec.active + this.attack.spec.recovery)),
        this.attack.spec.windup / Math.max(0.001, this.attack.spec.windup + this.attack.spec.active + this.attack.spec.recovery),
        (this.attack.spec.windup + this.attack.spec.active) / Math.max(0.001, this.attack.spec.windup + this.attack.spec.active + this.attack.spec.recovery),
        this.lastAttackSerial !== this.attack.serial,
      );
      this.lastAttackSerial = this.attack.serial;
      return;
    }

    this.releaseToken();
    if (this.ai.is('attack')) this.ai.set('recover');

    if (!ctx.playerAlive) {
      this.ai.set('idle');
      this.anim.play('idle');
      this.moveHorizontal(dt, 0, 0);
      this.updateFacing(dt);
      return;
    }

    // Turbo archetype sidesteps incoming player attacks.
    if (
      this.archetype.kind === 'turbo' &&
      this.dodgeCooldown <= 0 &&
      dist < 3.2 &&
      ctx.player.attack !== null &&
      Math.random() < 0.65
    ) {
      this.dodgeTimer = 0.3;
      this.dodgeCooldown = 2.4;
      this.invulnTimer = Math.max(this.invulnTimer, 0.22);
      this.attack = null;
      const side = Math.random() < 0.5 ? 1 : -1;
      this.dodgeDir.set((- (ctx.playerZ - this.posZ) / Math.max(0.001, dist)) * side, 0, ((ctx.playerX - this.posX) / Math.max(0.001, dist)) * side);
    }

    if (this.dodgeTimer > 0) {
      this.ai.set('reposition');
      this.anim.play('dodge', { duration: 0.3 });
      this.moveHorizontal(dt, this.dodgeDir.x * 7.5, this.dodgeDir.z * 7.5);
      this.faceTowards(ctx.playerX, ctx.playerZ);
      this.updateFacing(dt);
      return;
    }

    // Hysteresis between states.
    if (this.ai.is('recover')) {
      if (this.ai.elapsed < 0.28) {
        this.anim.play('idle');
        this.moveHorizontal(dt, 0, 0);
        this.faceTowards(ctx.playerX, ctx.playerZ);
        this.updateFacing(dt);
        return;
      }
      this.ai.set('chase');
    }

    if (dist > 11.5) {
      if (this.ai.is('idle') && this.ai.elapsed < 0.45) {
        this.anim.play('idle');
        this.moveHorizontal(dt, 0, 0);
        this.faceTowards(ctx.playerX, ctx.playerZ);
        this.updateFacing(dt);
        return;
      }
      this.ai.set('patrol');
      this.patrol(dt);
      this.updateFacing(dt);
      return;
    }

    if (this.ai.is('idle') || this.ai.is('patrol')) {
      this.ai.set('alert');
    }

    if (this.ai.is('alert')) {
      this.faceTowards(ctx.playerX, ctx.playerZ);
      this.updateFacing(dt);
      this.moveHorizontal(dt, 0, 0);
      this.anim.play('idle');
      if (this.ai.elapsed < 0.3) return;
      this.ai.set('chase');
    }

    const desired = this.archetype.desiredDistance;
    if (dist > desired + 0.35) {
      this.ai.set('chase');
      this.anim.play('run', { rate: this.archetype.kind === 'puffer' ? 0.75 : 1 });
      this.steer(dt, ctx.playerX, ctx.playerZ, this.archetype.speed * this.speedMultiplier, ctx.enemies);
      return;
    }

    // In range: attack when allowed, otherwise circle for an opening.
    if (this.attackCooldown <= 0 && dist <= this.archetype.range + 0.3) {
      if (this.director.request(this.id)) {
        this.hasToken = true;
        this.faceTowards(ctx.playerX, ctx.playerZ);
        this.setYaw(Math.atan2(ctx.playerX - this.posX, ctx.playerZ - this.posZ));
        this.startAttack(this.makeAttackSpec());
        return;
      }
    }

    this.ai.set('reposition');
    this.anim.play('walk', { rate: 0.85 });
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 1.2 + Math.random() * 2;
      this.strafeDir = this.strafeDir === 1 ? -1 : 1;
    }
    const dx = (ctx.playerX - this.posX) / Math.max(0.001, dist);
    const dz = (ctx.playerZ - this.posZ) / Math.max(0.001, dist);
    const tangentX = -dz * this.strafeDir;
    const tangentZ = dx * this.strafeDir;
    const radial = dist > desired ? 0.6 : dist < desired - 0.5 ? -0.7 : 0;
    const vx = tangentX * 0.75 + dx * radial;
    const vz = tangentZ * 0.75 + dz * radial;
    const length = Math.hypot(vx, vz) || 1;
    this.moveHorizontal(dt, (vx / length) * this.archetype.speed * 0.6, (vz / length) * this.archetype.speed * 0.6);
    this.faceTowards(ctx.playerX, ctx.playerZ);
    this.updateFacing(dt);
  }

  protected makeAttackSpec(): AttackSpec {
    const a = this.archetype;
    return {
      id: `enemy-${a.kind}`,
      label: a.label,
      anim: a.attackAnim,
      damage: a.damage * this.damageScale,
      range: a.range,
      arc: a.arc,
      windup: a.windup,
      active: a.active,
      recovery: a.recovery,
      knockback: a.knockback,
      hitstun: a.hitstun,
      hitstop: 0.055,
      heavy: a.kind === 'puffer',
      telegraphRadius: a.range,
    };
  }

  private startAttack(spec: AttackSpec): void {
    this.attackCooldown = (this.archetype.cooldownMin + Math.random() * (this.archetype.cooldownMax - this.archetype.cooldownMin)) * this.attackCooldownScale;
    this.combat.begin(this, spec);
    this.ai.set('attack');
  }

  protected updateAttack(dt: number): void {
    if (!this.attack) return;
    const spec = this.attack.spec;
    if (spec.id === 'bossCharge') {
      const activeStart = spec.windup;
      if (this.attack.time >= activeStart && this.attack.time <= activeStart + spec.active) {
        this.moveHorizontal(dt, this.forwardX * 8.5, this.forwardZ * 8.5);
        return;
      }
    }
    if (this.attack.time < spec.windup) {
      this.moveHorizontal(dt, this.forwardX * 0.7, this.forwardZ * 0.7);
    } else {
      this.moveHorizontal(dt, 0, 0);
    }
  }

  private steer(dt: number, targetX: number, targetZ: number, speed: number, enemies: Enemy[]): void {
    let dx = targetX - this.posX;
    let dz = targetZ - this.posZ;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist;
    dz /= dist;

    // Separation from other maranza.
    for (const other of enemies) {
      if (other === this || !other.alive) continue;
      const ox = this.posX - other.posX;
      const oz = this.posZ - other.posZ;
      const od = Math.hypot(ox, oz);
      const minDist = this.radius + other.radius + 0.45;
      if (od < minDist && od > 0.001) {
        const push = (minDist - od) / minDist;
        dx += (ox / od) * push * 1.6;
        dz += (oz / od) * push * 1.6;
      }
    }

    // Obstacle whiskers: slide around benches, columns and planters.
    const dirLength = Math.hypot(dx, dz) || 1;
    dx /= dirLength;
    dz /= dirLength;
    const origin = new THREE.Vector3(this.posX, this.pos.y + 0.9, this.posZ);
    const probe = new THREE.Vector3(dx, 0, dz);
    const hit = this.physics.raycast(origin, probe, 1.5);
    if (hit) {
      const angles = [Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];
      for (const angle of angles) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const testX = dx * cos - dz * sin;
        const testZ = dx * sin + dz * cos;
        const free = this.physics.raycast(origin, new THREE.Vector3(testX, 0, testZ), 1.4);
        if (!free) {
          dx = testX;
          dz = testZ;
          break;
        }
      }
    }

    const length = Math.hypot(dx, dz) || 1;
    this.moveHorizontal(dt, (dx / length) * speed, (dz / length) * speed);
    this.faceTowards(targetX, targetZ);
  }

  private patrol(dt: number): void {
    this.patrolTimer -= dt;
    if (this.patrolTimer <= 0) {
      this.patrolTimer = 2 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 3;
      this.patrolX = this.home.x + Math.cos(a) * r;
      this.patrolZ = this.home.z + Math.sin(a) * r;
    }
    const dx = this.patrolX - this.posX;
    const dz = this.patrolZ - this.posZ;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.4) {
      this.anim.play('walk', { rate: 0.7 });
      this.steer(dt, this.patrolX, this.patrolZ, this.archetype.speed * 0.4, []);
    } else {
      this.anim.play('idle');
      this.moveHorizontal(dt, 0, 0);
    }
    this.updateFacing(dt);
  }

  protected releaseToken(): void {
    if (this.hasToken) {
      this.director.release(this.id);
      this.hasToken = false;
    }
  }

  protected override onHurt(info: HitInfo, _attacker: Combatant): void {
    this.hurtTimer = Math.max(0.18, Math.min(0.55, info.hitstun));
    this.attack = null;
    this.releaseToken();
    this.poise -= info.damage * (info.heavy ? 1.6 : 1);
    if (this.poise <= 0) {
      this.poise = this.archetype.poise;
      this.stunTimer = this.archetype.stunDuration;
    }
    this.ai.set(this.stunTimer > 0 ? 'stunned' : 'hurt');
  }

  protected override die(attacker: Combatant): void {
    super.die(attacker);
    this.releaseToken();
    this.ai.set('defeated');
    this.physics.removeCharacter(this.body);
    this.bodyRemoved = true;
    this.deathTimer = 0;
  }
}
