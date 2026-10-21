import * as THREE from 'three';
import { Fighter } from '../entities/Fighter';
import type { CombatSystem } from '../combat/CombatSystem';
import type { AttackSpec, Combatant, HitInfo } from '../combat/types';
import type { CharacterFactory } from '../graphics/CharacterFactory';
import type { Physics } from '../core/Physics';

export type ZombieKind = 'walker' | 'runner' | 'brute' | 'elite';

export interface ZombieArchetype {
  kind: ZombieKind;
  label: string;
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
  cooldown: number;
  scale: number;
  radius: number;
  halfHeight: number;
  points: number;
  anim: AttackSpec['anim'];
  aoe?: boolean;
}

export const ZOMBIE_ARCHETYPES: Record<ZombieKind, ZombieArchetype> = {
  walker: {
    kind: 'walker',
    label: 'PASSANTE',
    hp: 150,
    speed: 1.85,
    damage: 11,
    range: 1.75,
    arc: 110,
    windup: 0.52,
    active: 0.12,
    recovery: 0.55,
    knockback: 3,
    hitstun: 0.24,
    poise: 40,
    cooldown: 1.4,
    scale: 1,
    radius: 0.36,
    halfHeight: 0.52,
    points: 90,
    anim: 'punch1',
  },
  runner: {
    kind: 'runner',
    label: 'CORRIDORE',
    hp: 110,
    speed: 4.1,
    damage: 9,
    range: 1.65,
    arc: 100,
    windup: 0.32,
    active: 0.1,
    recovery: 0.34,
    knockback: 2,
    hitstun: 0.18,
    poise: 26,
    cooldown: 0.95,
    scale: 0.94,
    radius: 0.34,
    halfHeight: 0.5,
    points: 120,
    anim: 'punch2',
  },
  brute: {
    kind: 'brute',
    label: 'PALAZZINARO',
    hp: 420,
    speed: 1.55,
    damage: 22,
    range: 2.3,
    arc: 130,
    windup: 0.82,
    active: 0.16,
    recovery: 0.7,
    knockback: 7,
    hitstun: 0.4,
    poise: 150,
    cooldown: 2.1,
    scale: 1.22,
    radius: 0.46,
    halfHeight: 0.6,
    points: 320,
    anim: 'slam',
  },
  elite: {
    kind: 'elite',
    label: 'SINDACO MORTO',
    hp: 900,
    speed: 1.7,
    damage: 28,
    range: 3.4,
    arc: 360,
    windup: 1.05,
    active: 0.18,
    recovery: 0.9,
    knockback: 10,
    hitstun: 0.55,
    poise: 260,
    cooldown: 3.2,
    scale: 1.3,
    radius: 0.5,
    halfHeight: 0.66,
    points: 800,
    anim: 'slam',
    aoe: true,
  },
};

export interface ZombieContext {
  targetX: number;
  targetZ: number;
  targetAlive: boolean;
  zombies: Zombie[];
  /** Optional waypoint (window outside/inside) that overrides direct chase. */
  waypoint: { x: number; z: number } | null;
  time: number;
}

export class Zombie extends Fighter {
  readonly kind: ZombieKind;
  readonly archetype: ZombieArchetype;
  readonly combat: CombatSystem;
  hurtTimer = 0;
  attackCooldown = 0;
  poise: number;
  /** True while the zombie is climbing through a window (no combat). */
  entering = false;
  /** Set by the mode to give a one-shot speed multiplier on spawn. */
  speedMultiplier = 1;
  rewarded = false;
  deathHandled = false;
  /** Marks the window this zombie is trying to break through. */
  windowId: string | null = null;
  entryStage: 'outside' | 'inside' | null = null;
  private strafeDir: 1 | -1 = 1;
  private strafeTimer = 1.3;
  private lastAttackSerial = -1;
  private readonly visualScale: number;

  constructor(
    physics: Physics,
    factory: CharacterFactory,
    combat: CombatSystem,
    archetype: ZombieArchetype,
    spawn: THREE.Vector3,
    variant = 0,
  ) {
    super(physics, factory, {
      team: 'enemy',
      look: 'zombie',
      variant,
      radius: archetype.radius,
      halfHeight: archetype.halfHeight,
      maxHp: archetype.hp,
      spawn,
      yaw: Math.random() * Math.PI * 2,
    });
    this.combat = combat;
    this.kind = archetype.kind;
    this.archetype = archetype;
    this.visualScale = archetype.scale;
    this.visual.visual.scale.setScalar(archetype.scale);
    this.poise = archetype.poise;
    this.attackCooldown = 0.3 + Math.random() * 0.6;
    this.strafeTimer = 1 + Math.random() * 2;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    // Bullets may hit the same zombie on consecutive frames: no melee i-frames.
    this.postHitInvuln = 0;
  }

  get headY(): number {
    return this.pos.y + 1.58 * this.visualScale;
  }

  get bodyY(): number {
    return this.pos.y + 1.0 * this.visualScale;
  }

  override isInvulnerable(): boolean {
    return !this.alive;
  }

  update(dt: number, ctx: ZombieContext): void {
    this.tickTimers(dt);
    if (this.hurtTimer > 0) this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    if (!this.alive) {
      this.anim.play('ko', { duration: 1.1, reset: true });
      this.moveHorizontal(dt, 0, 0);
      this.updateFacing(dt);
      return;
    }

    if (this.hurtTimer > 0) {
      this.attack = null;
      this.anim.play('hurt', { duration: 0.34 });
      this.moveHorizontal(dt, 0, 0);
      this.updateFacing(dt);
      return;
    }

    if (this.attack) {
      const spec = this.attack.spec;
      const total = spec.windup + spec.active + spec.recovery;
      const p = Math.min(1, this.attack.time / total);
      this.anim.setAttack(spec.anim, p, spec.windup / total, (spec.windup + spec.active) / total, this.lastAttackSerial !== this.attack.serial);
      this.lastAttackSerial = this.attack.serial;
      if (this.attack.time < spec.windup) {
        this.moveHorizontal(dt, this.forwardX * 0.55, this.forwardZ * 0.55);
      } else {
        this.moveHorizontal(dt, 0, 0);
      }
      this.updateFacing(dt);
      return;
    }

    if (!ctx.targetAlive) {
      this.anim.play('idle');
      this.moveHorizontal(dt, 0, 0);
      this.updateFacing(dt);
      return;
    }

    const waypoint = ctx.waypoint;
    const tx = waypoint ? waypoint.x : ctx.targetX;
    const tz = waypoint ? waypoint.z : ctx.targetZ;
    const dist = Math.hypot(ctx.targetX - this.posX, ctx.targetZ - this.posZ);
    const distToWaypoint = Math.hypot(tx - this.posX, tz - this.posZ);

    if (waypoint && distToWaypoint < 1.15) {
      // The mode handles the barricade damage; the zombie just tears at it.
      this.anim.play(this.archetype.kind === 'runner' ? 'walk' : 'punch1', { rate: 0.8 });
      this.moveHorizontal(dt, 0, 0);
      this.faceTowards(tx, tz);
      this.updateFacing(dt);
      return;
    }

    if (waypoint || dist > this.archetype.range + 0.32) {
      const speed = this.archetype.speed * this.speedMultiplier;
      this.steer(dt, tx, tz, speed, ctx.zombies);
      const running = this.archetype.kind === 'runner' || (waypoint ? false : dist > 7);
      this.anim.play(running ? 'run' : 'walk', { rate: running ? 1.05 : 0.85 });
      return;
    }

    // In range: attack, otherwise shuffle sideways so they do not stack.
    if (this.attackCooldown <= 0) {
      this.faceTowards(ctx.targetX, ctx.targetZ);
      this.setYaw(Math.atan2(ctx.targetX - this.posX, ctx.targetZ - this.posZ));
      this.combat.begin(this, this.makeAttackSpec());
      this.attackCooldown = this.archetype.cooldown * (0.85 + Math.random() * 0.3);
      return;
    }

    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 1 + Math.random() * 2;
      this.strafeDir = this.strafeDir === 1 ? -1 : 1;
    }
    const dx = (ctx.targetX - this.posX) / Math.max(0.001, dist);
    const dz = (ctx.targetZ - this.posZ) / Math.max(0.001, dist);
    const tx2 = -dz * this.strafeDir;
    const tz2 = dx * this.strafeDir;
    this.moveHorizontal(dt, tx2 * 0.55, tz2 * 0.55);
    this.faceTowards(ctx.targetX, ctx.targetZ);
    this.anim.play('walk', { rate: 0.7 });
    this.updateFacing(dt);
  }

  makeAttackSpec(): AttackSpec {
    const a = this.archetype;
    return {
      id: `zombie-${a.kind}`,
      label: a.label,
      anim: a.anim,
      damage: a.damage,
      range: a.range,
      arc: a.arc,
      windup: a.windup,
      active: a.active,
      recovery: a.recovery,
      knockback: a.knockback,
      hitstun: a.hitstun,
      hitstop: a.kind === 'brute' || a.kind === 'elite' ? 0.08 : 0.04,
      heavy: a.kind === 'brute' || a.kind === 'elite',
      brandLabel: a.label,
      aoe: a.aoe,
      aoeRadius: a.aoe ? a.range : undefined,
      telegraphRadius: a.range * (a.aoe ? 1.3 : 1),
      telegraphColor: a.kind === 'elite' ? '#ff2f2f' : a.kind === 'brute' ? '#ff8a3d' : '#ffd400',
    };
  }

  private steer(dt: number, targetX: number, targetZ: number, speed: number, zombies: Zombie[]): void {
    let dx = targetX - this.posX;
    let dz = targetZ - this.posZ;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist;
    dz /= dist;

    for (const other of zombies) {
      if (other === this || !other.alive) continue;
      const ox = this.posX - other.posX;
      const oz = this.posZ - other.posZ;
      const od = Math.hypot(ox, oz);
      const minDist = this.radius + other.radius + 0.4;
      if (od < minDist && od > 0.001) {
        const push = (minDist - od) / minDist;
        dx += (ox / od) * push * 1.8;
        dz += (oz / od) * push * 1.8;
      }
    }

    const length = Math.hypot(dx, dz) || 1;
    dx /= length;
    dz /= length;

    // Whiskers: slide around benches, columns and building corners.
    const origin = new THREE.Vector3(this.posX, this.pos.y + 0.9, this.posZ);
    const hit = this.physics.raycast(origin, new THREE.Vector3(dx, 0, dz), 1.4);
    if (hit) {
      for (const angle of [Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2]) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const testX = dx * cos - dz * sin;
        const testZ = dx * sin + dz * cos;
        if (!this.physics.raycast(origin, new THREE.Vector3(testX, 0, testZ), 1.3)) {
          dx = testX;
          dz = testZ;
          break;
        }
      }
    }

    this.moveHorizontal(dt, dx * speed, dz * speed);
    this.faceTowards(targetX, targetZ);
    this.updateFacing(dt);
  }

  protected override onHurt(info: HitInfo, _attacker: Combatant): void {
    this.hurtTimer = Math.max(0.1, Math.min(0.4, info.hitstun));
    this.attack = null;
    this.poise -= info.damage * (info.heavy ? 1.4 : 1);
    if (this.poise <= 0) {
      this.poise = this.archetype.poise;
      this.hurtTimer = Math.max(this.hurtTimer, 0.62);
      this.attackCooldown = Math.max(this.attackCooldown, 0.7);
    }
  }

  protected override die(attacker: Combatant): void {
    super.die(attacker);
    this.attack = null;
    this.detachBody();
    this.deathTimer = 0;
  }

  override dispose(): void {
    super.dispose();
  }
}
