import * as THREE from 'three';
import type { Physics } from './Physics';

export type CameraMode = 'follow' | 'menu' | 'orbit' | 'frozen';

export interface OrbitOptions {
  center: THREE.Vector3;
  radius: number;
  height: number;
  speed: number;
  startAngle?: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Third-person camera with orbit controls, wall avoidance and trauma shake.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private physics: Physics | null = null;
  mode: CameraMode = 'follow';
  yaw = 0;
  pitch = 0.17;
  distance = 4.3;
  sensitivity = 1;
  invertY = false;
  shakeEnabled = true;
  private trauma = 0;
  private lift = 0;
  private baseFov: number;
  private fovKick = 0;
  private target = new THREE.Vector3(0, 1.4, 0);
  private smoothTarget = new THREE.Vector3(0, 1.4, 0);
  private orbit: OrbitOptions | null = null;
  private orbitTime = 0;
  private shakeTime = 0;
  private readonly desired = new THREE.Vector3();
  private readonly lookPoint = new THREE.Vector3();
  private readonly basisForward = new THREE.Vector3();
  private readonly basisRight = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.baseFov = camera.fov;
    this.camera.rotation.order = 'YXZ';
  }

  setBaseFov(fov: number): void {
    this.baseFov = fov;
    this.fovKick = 0;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  setPhysics(physics: Physics | null): void {
    this.physics = physics;
  }

  setMode(mode: CameraMode, orbit?: OrbitOptions): void {
    this.mode = mode;
    if (orbit) {
      this.orbit = orbit;
      this.orbitTime = 0;
    }
  }

  setTarget(position: THREE.Vector3): void {
    this.target.set(position.x, position.y + 1.32, position.z);
  }

  addLook(dx: number, dy: number): void {
    if (this.mode !== 'follow') return;
    const s = this.sensitivity * 0.0028;
    this.yaw -= dx * s;
    const pitchDelta = dy * s * (this.invertY ? -1 : 1);
    this.pitch = Math.min(1.08, Math.max(-0.16, this.pitch + pitchDelta));
  }

  addShake(amount: number): void {
    if (!this.shakeEnabled) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Quick zoom-in that snaps back: the punch behind a heavy hit. */
  addPunch(degrees: number): void {
    if (!this.shakeEnabled) return;
    this.fovKick = Math.min(9, this.fovKick + degrees);
  }

  /** Horizontal movement basis from the camera looking direction. */
  getBasis(): { forward: THREE.Vector3; right: THREE.Vector3 } {
    this.basisForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    this.basisRight.crossVectors(this.basisForward, UP).normalize();
    return { forward: this.basisForward, right: this.basisRight };
  }

  update(dt: number): void {
    if (this.mode === 'menu' || this.mode === 'orbit') {
      this.updateOrbit(dt);
      return;
    }
    if (this.mode === 'frozen') {
      this.updateShake(dt);
      return;
    }

    const damp = 1 - Math.exp(-11 * dt);
    this.smoothTarget.lerp(this.target, damp);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    this.desired.set(
      Math.sin(this.yaw) * cp * this.distance,
      sp * this.distance + 0.55,
      Math.cos(this.yaw) * cp * this.distance,
    );
    let allowed = this.distance;

    // Probe with a few parallel rays so door frames and columns do not clip.
    if (this.physics) {
      const dir = this.desired.clone().normalize();
      const probes = 5;
      for (let i = 0; i < probes; i++) {
        const angle = (i / probes) * Math.PI * 2;
        const offset = new THREE.Vector3(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35);
        const origin = this.smoothTarget.clone().add(offset);
        origin.y += 0.15;
        const hit = this.physics.raycast(origin, dir, this.distance);
        if (hit) {
          allowed = Math.min(allowed, Math.max(1.3, hit.distance - 0.28));
        }
      }
    }

    const scale = this.distance > 0 ? allowed / this.distance : 1;
    const camPos = this.lookPoint
      .copy(this.smoothTarget)
      .addScaledVector(this.desired, scale);
    // When something forces the camera up against the player's back, lift it
    // instead of leaving the view jammed into a pillar or a wall.
    const squeeze = THREE.MathUtils.clamp((2.9 - allowed) / 1.6, 0, 1);
    this.lift += (squeeze * 1.5 - this.lift) * (1 - Math.exp(-7 * dt));
    camPos.y = Math.max(0.45, camPos.y + this.lift);

    // The camera must not end up inside the player capsule.
    const horizontal = new THREE.Vector3(camPos.x - this.smoothTarget.x, 0, camPos.z - this.smoothTarget.z);
    if (horizontal.lengthSq() < 0.7) {
      horizontal.setLength(0.7);
      camPos.x = this.smoothTarget.x + horizontal.x;
      camPos.z = this.smoothTarget.z + horizontal.z;
    }

    this.camera.position.copy(camPos);
    this.updateShake(dt);
    this.camera.lookAt(this.smoothTarget);
  }

  private updateOrbit(dt: number): void {
    this.orbitTime += dt;
    const orbit = this.orbit;
    if (!orbit) return;
    const angle = (orbit.startAngle ?? Math.PI * 0.8) + this.orbitTime * orbit.speed;
    this.camera.position.set(
      orbit.center.x + Math.sin(angle) * orbit.radius,
      orbit.height,
      orbit.center.z + Math.cos(angle) * orbit.radius,
    );
    this.lookPoint.set(orbit.center.x, orbit.center.y, orbit.center.z);
    this.updateShake(dt);
    this.camera.lookAt(this.lookPoint);
  }

  private updateShake(dt: number): void {
    this.updateFov(dt);
    if (this.trauma <= 0) return;
    this.shakeTime += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    const strength = this.trauma * this.trauma;
    if (!this.shakeEnabled) return;
    const t = this.shakeTime;
    this.camera.position.x += Math.sin(t * 61) * 0.16 * strength;
    this.camera.position.y += Math.cos(t * 47) * 0.12 * strength;
    this.camera.position.z += Math.sin(t * 53 + 2) * 0.12 * strength;
    this.camera.rotation.z += Math.sin(t * 43) * 0.018 * strength;
  }

  private updateFov(dt: number): void {
    if (this.fovKick <= 0) return;
    this.fovKick = Math.max(0, this.fovKick - dt * 30);
    this.camera.fov = this.baseFov - this.fovKick;
    this.camera.updateProjectionMatrix();
  }

  resetToPlayer(): void {
    this.yaw = 0;
    this.pitch = 0.17;
    this.lift = 0;
    this.fovKick = 0;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.smoothTarget.copy(this.target);
  }

  freezeAt(position: THREE.Vector3, look: THREE.Vector3): void {
    this.mode = 'frozen';
    this.camera.position.copy(position);
    this.camera.lookAt(look);
  }
}
