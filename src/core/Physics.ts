import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export const FIXED_DT = 1 / 60;
export const GRAVITY = -26;

export interface RayHit {
  distance: number;
  point: THREE.Vector3;
  colliderHandle: number;
}

export class CharacterBody {
  readonly collider: RAPIER.Collider;
  readonly body: RAPIER.RigidBody;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly offsetY: number;
  grounded = true;
  vy = 0;
  readonly lastMovement = new THREE.Vector3();

  constructor(
    body: RAPIER.RigidBody,
    collider: RAPIER.Collider,
    controller: RAPIER.KinematicCharacterController,
    radius: number,
    halfHeight: number,
  ) {
    this.body = body;
    this.collider = collider;
    this.controller = controller;
    this.offsetY = halfHeight + radius;
  }

  get center(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get feet(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y - this.offsetY, t.z);
  }

  get position(): THREE.Vector3 {
    return this.feet;
  }

  /** Applies a displacement through the character controller (collides & slides). */
  move(displacement: THREE.Vector3): void {
    this.controller.computeColliderMovement(this.collider, {
      x: displacement.x,
      y: displacement.y,
      z: displacement.z,
    });
    const m = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    this.lastMovement.set(m.x, m.y, m.z);
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    if (this.grounded && this.vy < 0) this.vy = 0;
  }

  teleport(feetX: number, feetY: number, feetZ: number): void {
    const y = feetY + this.offsetY;
    this.body.setTranslation({ x: feetX, y, z: feetZ }, true);
    this.body.setNextKinematicTranslation({ x: feetX, y, z: feetZ });
    this.vy = 0;
  }
}

export class Physics {
  world!: RAPIER.World;
  private characterColliders = new Set<number>();
  private ready = false;
  private staticBodyCount = 0;

  static async create(): Promise<Physics> {
    const physics = new Physics();
    await RAPIER.init();
    physics.world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
    physics.world.timestep = FIXED_DT;
    physics.ready = true;
    return physics;
  }

  get isReady(): boolean {
    return this.ready;
  }

  get bodyCount(): number {
    return this.world ? this.world.bodies.len() : 0;
  }

  resetWorld(): void {
    if (!this.world) return;
    // Every static and character collider is parented to a rigid body.
    for (const body of this.world.bodies.getAll()) {
      this.world.removeRigidBody(body);
    }
    this.characterColliders.clear();
    this.staticBodyCount = 0;
    this.ready = true;
  }

  addStaticBox(
    center: THREE.Vector3 | { x: number; y: number; z: number },
    halfExtents: THREE.Vector3 | { x: number; y: number; z: number },
    rotationY = 0,
    friction = 0.9,
  ): RAPIER.Collider {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z);
    if (rotationY !== 0) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0));
      bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
    const body = this.world.createRigidBody(bodyDesc);
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setFriction(friction)
        .setRestitution(0),
      body,
    );
    this.staticBodyCount += 1;
    return collider;
  }

  addGround(sizeX: number, sizeZ: number, y = 0, thickness = 1): RAPIER.Collider {
    return this.addStaticBox(
      { x: 0, y: y - thickness / 2, z: 0 },
      { x: sizeX / 2, y: thickness / 2, z: sizeZ / 2 },
      0,
      1,
    );
  }

  createCharacter(
    feetX: number,
    feetY: number,
    feetZ: number,
    radius: number,
    halfHeight: number,
  ): CharacterBody {
    const centerY = feetY + halfHeight + radius;
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(feetX, centerY, feetZ);
    const body = this.world.createRigidBody(bodyDesc);
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, radius).setFriction(0.2),
      body,
    );
    const controller = this.world.createCharacterController(0.02);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.enableAutostep(0.35, 0.18, true);
    controller.enableSnapToGround(0.35);
    controller.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((38 * Math.PI) / 180);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setCharacterMass(78);
    this.characterColliders.add(collider.handle);
    return new CharacterBody(body, collider, controller, radius, halfHeight);
  }

  removeCharacter(character: CharacterBody): void {
    this.characterColliders.delete(character.collider.handle);
    if (this.world) {
      this.world.removeRigidBody(character.body);
    }
  }

  step(): void {
    this.world.step();
  }

  /**
   * Raycast against the level only (characters excluded by default) so the
   * camera does not snap when an enemy walks behind the player.
   */
  raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    includeCharacters = false,
  ): RayHit | null {
    if (!this.world) return null;
    const dir = direction.clone();
    if (dir.lengthSq() < 1e-8) return null;
    dir.normalize();
    const ray = new RAPIER.Ray(origin, dir);
    const predicate = includeCharacters
      ? undefined
      : (collider: RAPIER.Collider) => !this.characterColliders.has(collider.handle);
    const hit = this.world.castRay(ray, maxDistance, true, undefined, undefined, undefined, undefined, predicate);
    if (!hit) return null;
    const distance = Math.max(0, hit.timeOfImpact);
    return {
      distance,
      point: origin.clone().addScaledVector(dir, distance),
      colliderHandle: hit.collider.handle,
    };
  }

  dispose(): void {
    this.characterColliders.clear();
    this.world.free();
    this.ready = false;
  }
}
