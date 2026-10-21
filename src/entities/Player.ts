import * as THREE from 'three';
import type { Combatant, HitInfo, AttackSpec } from '../combat/types';
import { PLAYER_KICK, PLAYER_PUNCH_1, PLAYER_PUNCH_2, PLAYER_SPECIAL, attackTotal } from '../combat/types';
import type { CombatSystem } from '../combat/CombatSystem';
import type { CharacterFactory } from '../graphics/CharacterFactory';
import type { Physics } from '../core/Physics';
import { Fighter } from './Fighter';

export interface PlayerEvents {
  onAttackStart(spec: AttackSpec): void;
  onDodge(): void;
  onSpecial(): void;
  onPerfectDodge(): void;
  onHurt(): void;
  onDeath(): void;
}

const WALK_SPEED = 3.35;
const RUN_SPEED = 6.3;
const DODGE_SPEED = 9.4;
const DODGE_DURATION = 0.34;
const DODGE_COOLDOWN = 1.05;
const MAX_ENERGY = 100;

type QueuedAttack = 'punch' | 'kick' | null;

export class Player extends Fighter {
  energy = 0;
  readonly maxEnergy = MAX_ENERGY;
  hurtTimer = 0;
  dodgeTimer = 0;
  dodgeCooldown = 0;
  specialCooldown = 0;
  controlLocked = false;
  victory = false;
  /** Attack damage multiplier used by mode modifiers (default 1). */
  damageMultiplier = 1;
  chainIndex = 0;
  chainTimer = 0;
  comboHits = 0;
  private readonly dodgeDir = new THREE.Vector3(0, 0, -1);
  private readonly combat: CombatSystem;
  private readonly events: PlayerEvents;
  private queued: QueuedAttack = null;
  private queuedTtl = 0;
  private lastAttackSerial = -1;
  private aimX: number | null = null;
  private aimZ: number | null = null;
  private movingSpeed = 0;
  private hurtAnimPending = false;
  private telegraphCount = 0;
  private threatX = 0;
  private threatZ = 0;

  constructor(
    physics: Physics,
    factory: CharacterFactory,
    combat: CombatSystem,
    events: PlayerEvents,
    spawn: THREE.Vector3,
    maxHp = 120,
  ) {
    super(physics, factory, {
      team: 'player',
      look: 'player',
      radius: 0.37,
      halfHeight: 0.52,
      maxHp,
      spawn,
      yaw: 0,
    });
    this.combat = combat;
    this.events = events;
  }

  get speed(): number {
    return this.movingSpeed;
  }

  get dodgeReady(): number {
    return this.dodgeCooldown <= 0 ? 1 : 1 - this.dodgeCooldown / DODGE_COOLDOWN;
  }

  get specialReady(): boolean {
    return this.energy >= this.maxEnergy && this.specialCooldown <= 0;
  }

  /** Serial of the last attack that actually started; used by tests and HUD. */
  get lastAttackId(): number {
    return this.lastAttackSerial;
  }

  get isDodgingActive(): boolean {
    return this.dodgeTimer > 0;
  }

  override isDodging(): boolean {
    return this.dodgeTimer > 0 && this.invulnTimer > 0;
  }

  setAimTarget(x: number | null, z: number | null): void {
    this.aimX = x;
    this.aimZ = z;
  }

  /**
   * updated each frame by Game.updateEnemyTelegraphs: number of enemies currently
   * winding-up an announced attack and the nearest threat center.
   */
  setThreat(count: number, fromX: number, fromZ: number): void {
    this.telegraphCount = count;
    this.threatX = fromX;
    this.threatZ = fromZ;
  }

  setControlLocked(locked: boolean): void {
    this.controlLocked = locked;
    if (locked) {
      this.queued = null;
    }
  }

  addEnergy(amount: number): void {
    this.energy = Math.min(this.maxEnergy, Math.max(0, this.energy + amount));
  }

  tryPunch(): boolean {
    if (!this.canStart()) return false;
    if (this.attack) {
      this.queue('punch');
      return false;
    }
    const spec = this.chainTimer > 0 && this.chainIndex === 1 ? PLAYER_PUNCH_2 : this.chainTimer > 0 && this.chainIndex === 2 ? PLAYER_KICK : PLAYER_PUNCH_1;
    this.chainIndex = spec === PLAYER_PUNCH_1 ? 1 : spec === PLAYER_PUNCH_2 ? 2 : 0;
    this.chainTimer = attackTotal(spec) + 0.7;
    return this.startAttack(spec);
  }

  tryKick(): boolean {
    if (!this.canStart()) return false;
    if (this.attack) {
      this.queue('kick');
      return false;
    }
    const chained = this.chainTimer > 0 && this.chainIndex === 2;
    this.chainIndex = 0;
    this.chainTimer = chained ? attackTotal(PLAYER_KICK) + 0.7 : 0;
    return this.startAttack(PLAYER_KICK);
  }

  tryDodge(): boolean {
    if (!this.alive || this.controlLocked || this.victory || this.hurtTimer > 0 || this.dodgeCooldown > 0) {
      return false;
    }
    if (this.dodgeTimer > 0) return false;
    this.dodgeTimer = DODGE_DURATION;
    this.dodgeCooldown = DODGE_COOLDOWN;
    this.invulnTimer = Math.max(this.invulnTimer, 0.3);
    this.attack = null;
    this.queued = null;
    const mag = Math.hypot(this.lastMoveX, this.lastMoveZ);
    if (mag > 0.2) {
      this.dodgeDir.set(this.lastMoveX / mag, 0, this.lastMoveZ / mag);
    } else {
      this.dodgeDir.set(-this.forwardX, 0, -this.forwardZ);
    }
    this.events.onDodge();
    return true;
  }

  trySpecial(): boolean {
    if (this.energy < this.maxEnergy || this.specialCooldown > 0 || !this.canStart() || this.attack) {
      return false;
    }
    this.energy = 0;
    this.specialCooldown = 1.0;
    this.chainIndex = 0;
    this.chainTimer = 0;
    this.invulnTimer = Math.max(this.invulnTimer, 0.72);
    this.startAttack(PLAYER_SPECIAL);
    this.events.onSpecial();
    return true;
  }

  onPerfectDodge(): void {
    this.addEnergy(24);
    this.invulnTimer = Math.max(this.invulnTimer, 0.35);
    this.events.onPerfectDodge();
  }

  playVictory(): void {
    this.victory = true;
    this.controlLocked = true;
    this.attack = null;
    this.queued = null;
    this.anim.play('victory', { reset: true });
  }

  private lastMoveX = 0;
  private lastMoveZ = 0;

  private canStart(): boolean {
    return (
      this.alive &&
      !this.controlLocked &&
      !this.victory &&
      this.hurtTimer <= 0 &&
      this.dodgeTimer <= 0
    );
  }

  private queue(kind: Exclude<QueuedAttack, null>): void {
    this.queued = kind;
    this.queuedTtl = 0.5;
  }

  private startAttack(baseSpec: AttackSpec): boolean {
    this.faceAim();
    const spec =
      this.damageMultiplier === 1
        ? baseSpec
        : { ...baseSpec, damage: baseSpec.damage * this.damageMultiplier };
    const attack = this.combat.begin(this, spec);
    if (!attack) return false;
    this.lastAttackSerial = attack.serial;
    this.events.onAttackStart(spec);
    return true;
  }

  private faceAim(): void {
    if (this.aimX === null || this.aimZ === null) return;
    const dx = this.aimX - this.posX;
    const dz = this.aimZ - this.posZ;
    if (dx * dx + dz * dz <= 25) {
      this.setYaw(Math.atan2(dx, dz));
    }
  }

  update(dt: number, moveX = 0, moveZ = 0, run = false): void {
    this.tickTimers(dt);
    if (this.chainTimer > 0) {
      this.chainTimer = Math.max(0, this.chainTimer - dt);
      if (this.chainTimer === 0) this.chainIndex = 0;
    }
    if (this.dodgeCooldown > 0) this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    if (this.specialCooldown > 0) this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    if (this.hurtTimer > 0) this.hurtTimer = Math.max(0, this.hurtTimer - dt);

    if (!this.alive) {
      this.anim.play('ko', { duration: 1.1, reset: true });
      this.moveHorizontal(dt, 0, 0);
      this.updateFacing(dt);
      return;
    }

    if (this.victory) {
      this.anim.play('victory', { rate: 1 });
      this.moveHorizontal(dt, 0, 0);
      this.updateFacing(dt);
      return;
    }

    const moving = Math.hypot(moveX, moveZ) > 0.08;
    if (this.controlLocked) {
      moveX = 0;
      moveZ = 0;
      this.movingSpeed = 0;
    }
    this.lastMoveX = moveX;
    this.lastMoveZ = moveZ;

    // Anticipated rule: with three or more simultaneous winding-up attacks,
    // the player pre-dodges (if cooldown is ready) in the direction away from
    // the nearest threat, keeping the input control.
    if (
      this.telegraphCount >= 3 &&
      this.alive &&
      !this.controlLocked &&
      !this.victory &&
      this.hurtTimer <= 0 &&
      this.dodgeTimer <= 0 &&
      this.dodgeCooldown <= 0 &&
      !this.attack
    ) {
      const dx = this.posX - this.threatX;
      const dz = this.posZ - this.threatZ;
      const mag = Math.hypot(dx, dz);
      if (mag > 0.2) {
        this.lastMoveX = dx / mag;
        this.lastMoveZ = dz / mag;
      } else {
        this.lastMoveX = -this.forwardX;
        this.lastMoveZ = -this.forwardZ;
      }
      this.tryDodge();
    }

    if (this.hurtTimer > 0) {
      this.anim.play('hurt', { duration: 0.38 });
      this.moveHorizontal(dt, 0, 0);
      this.hurtAnimPending = true;
    } else if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
      const t = this.dodgeTimer / DODGE_DURATION;
      const speed = DODGE_SPEED * (0.35 + t * 0.75);
      this.moveHorizontal(dt, this.dodgeDir.x * speed, this.dodgeDir.z * speed);
      this.anim.play('dodge', { duration: DODGE_DURATION, reset: false });
      this.movingSpeed = speed;
    } else if (this.attack) {
      const spec = this.attack.spec;
      const total = attackTotal(spec);
      const p = Math.min(1, this.attack.time / total);
      if (p < spec.windup / total + 0.12) {
        const lunge = spec.aoe ? 0 : spec.heavy ? 2.1 : 1.7;
        this.moveHorizontal(dt, this.forwardX * lunge, this.forwardZ * lunge);
      } else {
        this.moveHorizontal(dt, 0, 0);
      }
      this.anim.setAttack(
        spec.anim,
        p,
        spec.windup / total,
        (spec.windup + spec.active) / total,
        this.lastAttackSerial !== this.attack.serial,
      );
      this.lastAttackSerial = this.attack.serial;
      this.movingSpeed = 0;
    } else {
      const speed = run ? RUN_SPEED : WALK_SPEED;
      if (moving) {
        this.moveHorizontal(dt, moveX * speed, moveZ * speed);
        this.targetYaw = Math.atan2(moveX, moveZ);
        this.movingSpeed = speed;
        this.anim.play(run ? 'run' : 'walk', { rate: run ? 1.12 : 1 });
      } else {
        this.moveHorizontal(dt, 0, 0);
        this.movingSpeed = 0;
        this.anim.play('idle');
      }
      if (this.queued) {
        this.queuedTtl -= dt;
        if (this.queuedTtl <= 0) {
          this.queued = null;
        } else if (this.canStart()) {
          const kind = this.queued;
          this.queued = null;
          if (kind === 'kick') this.tryKick();
          else this.tryPunch();
        }
      }
    }

    this.updateFacing(dt);
  }

  protected override onHurt(info: HitInfo, _attacker: Combatant): void {
    this.hurtTimer = Math.max(0.26, Math.min(0.42, info.hitstun + 0.08));
    this.attack = null;
    this.queued = null;
    this.chainIndex = 0;
    this.chainTimer = 0;
    this.dodgeTimer = 0;
    this.invulnTimer = Math.max(this.invulnTimer, 0.62);
    this.addEnergy(6);
    this.hurtAnimPending = true;
    this.events.onHurt();
  }

  protected override die(_attacker: Combatant): void {
    super.die(_attacker);
    this.controlLocked = true;
    this.hurtTimer = 0;
    this.events.onDeath();
  }

  get hurtFlash(): boolean {
    return this.hurtAnimPending;
  }

  consumeHurtFlag(): boolean {
    const value = this.hurtAnimPending;
    this.hurtAnimPending = false;
    return value;
  }
}
