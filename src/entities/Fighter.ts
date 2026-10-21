import * as THREE from 'three';
import type { ActiveAttack, Combatant, HitInfo, Team } from '../combat/types';
import { GRAVITY, type CharacterBody, type Physics } from '../core/Physics';
import {
  disposeCharacter,
  flashCharacter,
  type CharacterFactory,
  type CharacterLook,
  type CharacterVisual,
} from '../graphics/CharacterFactory';
import { AnimationSystem } from '../graphics/AnimationSystem';

let nextFighterId = 1;

export interface FighterOptions {
  team: Team;
  look: CharacterLook;
  variant?: number;
  radius: number;
  halfHeight: number;
  maxHp: number;
  spawn: THREE.Vector3;
  yaw?: number;
}

function dampAngle(current: number, target: number, rate: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * rate;
}

export abstract class Fighter implements Combatant {
  readonly id = nextFighterId++;
  readonly team: Team;
  readonly visual: CharacterVisual;
  readonly anim: AnimationSystem;
  readonly body: CharacterBody;
  readonly radius: number;
  readonly halfHeight: number;
  readonly physics: Physics;
  readonly maxHp: number;

  hp: number;
  alive = true;
  attack: ActiveAttack | null = null;
  posX = 0;
  posZ = 0;
  forwardX = 0;
  forwardZ = 1;
  yaw: number;
  targetYaw: number;
  displayYaw: number;
  invulnTimer = 0;
  flash = 0;
  knockback = new THREE.Vector3();
  readonly pos = new THREE.Vector3();
  readonly prevPos = new THREE.Vector3();
  readonly displayPos = new THREE.Vector3();
  deathTimer = 0;
  protected verticalVelocity = 0;
  protected bodyRemoved = false;
  protected postHitInvuln = 0.28;
  protected readonly shadow: THREE.Mesh;
  protected readonly shadowGeo: THREE.BufferGeometry;
  protected readonly shadowMat: THREE.MeshBasicMaterial;

  constructor(physics: Physics, factory: CharacterFactory, options: FighterOptions) {
    this.physics = physics;
    this.team = options.team;
    this.maxHp = options.maxHp;
    this.hp = options.maxHp;
    this.radius = options.radius;
    this.halfHeight = options.halfHeight;
    this.yaw = options.yaw ?? 0;
    this.targetYaw = this.yaw;
    this.displayYaw = this.yaw;

    this.visual = factory.create(options.look, options.variant ?? 0);
    this.anim = new AnimationSystem(this.visual);
    this.pos.copy(options.spawn);
    this.prevPos.copy(options.spawn);
    this.displayPos.copy(options.spawn);
    this.posX = options.spawn.x;
    this.posZ = options.spawn.z;
    this.forwardX = Math.sin(this.yaw);
    this.forwardZ = Math.cos(this.yaw);
    this.visual.root.position.copy(options.spawn);
    this.visual.root.rotation.y = this.yaw;

    this.shadowGeo = new THREE.CircleGeometry(this.radius * 1.25, 18);
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      toneMapped: false,
    });
    this.shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.018;
    this.visual.root.add(this.shadow);

    this.body = physics.createCharacter(
      options.spawn.x,
      options.spawn.y,
      options.spawn.z,
      options.radius,
      options.halfHeight,
    );
  }

  get height(): number {
    return this.visual.height;
  }

  isInvulnerable(): boolean {
    return !this.alive || this.invulnTimer > 0;
  }

  isDodging(): boolean {
    return false;
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.visual.root);
  }

  setYaw(yaw: number): void {
    this.yaw = yaw;
    this.targetYaw = yaw;
    this.forwardX = Math.sin(yaw);
    this.forwardZ = Math.cos(yaw);
  }

  faceTowards(x: number, z: number): void {
    const dx = x - this.posX;
    const dz = z - this.posZ;
    if (Math.abs(dx) + Math.abs(dz) > 1e-5) {
      this.targetYaw = Math.atan2(dx, dz);
    }
  }

  /** Moves through the Rapier character controller and applies gravity. */
  protected moveHorizontal(dt: number, velocityX: number, velocityZ: number): void {
    this.verticalVelocity += GRAVITY * dt;
    const desired = new THREE.Vector3(
      (velocityX + this.knockback.x) * dt,
      this.verticalVelocity * dt,
      (velocityZ + this.knockback.z) * dt,
    );
    this.body.move(desired);
    if (this.body.grounded) {
      this.verticalVelocity = -2;
    }
    this.knockback.multiplyScalar(Math.exp(-7 * dt));
  }

  protected updateFacing(dt: number): void {
    this.yaw = dampAngle(this.yaw, this.targetYaw, 1 - Math.exp(-13 * dt));
    this.forwardX = Math.sin(this.yaw);
    this.forwardZ = Math.cos(this.yaw);
  }

  protected tickTimers(dt: number): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (!this.alive) this.deathTimer += dt;
  }

  /** Called after physics.step() to snapshot the simulated position. */
  syncFromPhysics(): void {
    if (this.bodyRemoved) return;
    this.prevPos.copy(this.pos);
    const feet = this.body.feet;
    this.pos.copy(feet);
    this.posX = feet.x;
    this.posZ = feet.z;
  }

  /** Called once per rendered frame. */
  updateVisual(dt: number, alpha: number, frozen: boolean): void {
    const a = Math.min(1, Math.max(0, alpha));
    this.displayPos.lerpVectors(this.prevPos, this.pos, a);
    this.visual.root.position.copy(this.displayPos);
    this.displayYaw = dampAngle(this.displayYaw, this.yaw, 1 - Math.exp(-18 * Math.max(dt, 0.001)));
    this.visual.root.rotation.y = this.displayYaw;
    this.anim.update(frozen ? 0 : Math.min(dt, 0.05));
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5.5);
      flashCharacter(this.visual, this.flash);
    }
  }

  applyHit(info: HitInfo, attacker: Combatant): void {
    if (!this.alive || this.isInvulnerable()) return;
    this.hp = Math.max(0, this.hp - info.damage);
    this.flash = 1;
    this.invulnTimer = Math.max(this.invulnTimer, this.postHitInvuln);
    this.knockback.set(info.dirX * info.knockback, 0, info.dirZ * info.knockback);
    this.onHurt(info, attacker);
    if (this.hp <= 0) {
      this.die(attacker);
    }
  }

  protected onHurt(_info: HitInfo, _attacker: Combatant): void {
    /* subclasses react */
  }

  protected die(_attacker: Combatant): void {
    this.alive = false;
    this.attack = null;
    this.invulnTimer = 999;
    this.anim.play('ko', { duration: 1.1, reset: true });
  }

  heal(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.flash = 0.3;
  }

  dispose(): void {
    if (!this.bodyRemoved) this.physics.removeCharacter(this.body);
    this.bodyRemoved = true;
    this.visual.root.removeFromParent();
    this.shadowGeo.dispose();
    this.shadowMat.dispose();
    disposeCharacter(this.visual);
  }
}
