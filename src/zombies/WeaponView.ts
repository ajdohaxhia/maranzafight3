import * as THREE from 'three';
import type { CharacterVisual } from '../graphics/CharacterFactory';
import type { WeaponId } from './Weapons';

interface GunBuild {
  group: THREE.Group;
  muzzle: THREE.Object3D;
  /** Local Z distance used for recoil. */
  restZ: number;
}

function makeMaterial(color: string, metalness = 0.6, roughness = 0.35): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness,
    roughness,
    flatShading: true,
  });
}

/**
 * Low-poly viewmodel that lives in the player's right hand, plus the aim pose
 * applied after the animation system so shooting never looks like a punch.
 */
export class WeaponView {
  private readonly root = new THREE.Group();
  private readonly guns = new Map<WeaponId, GunBuild>();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly flash: THREE.Sprite;
  private readonly flashLight: THREE.PointLight;
  private active: WeaponId | null = null;
  private flashTime = 0;
  private recoil = 0;
  private readonly elbow: THREE.Object3D;

  constructor(visual: CharacterVisual) {
    this.elbow = visual.joints.elbowR;
    this.root.position.set(0, -0.34, 0.02);
    this.root.rotation.x = Math.PI / 2;
    this.elbow.add(this.root);

    const box = new THREE.BoxGeometry(1, 1, 1);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.geometries.push(box, cyl);
    const dark = makeMaterial('#1b1d21', 0.7, 0.32);
    const gunmetal = makeMaterial('#3a3f45', 0.75, 0.28);
    const wood = makeMaterial('#5a3a24', 0.15, 0.75);
    const accent = makeMaterial('#ffd400', 0.4, 0.4);
    const glass = new THREE.MeshStandardMaterial({ color: '#7fe8ff', emissive: '#2a9ab0', emissiveIntensity: 0.6, roughness: 0.2 });
    this.materials.push(dark, gunmetal, wood, accent, glass);

    const add = (group: THREE.Group, mat: THREE.Material, scale: [number, number, number], pos: [number, number, number], rot?: [number, number, number]): THREE.Mesh => {
      const mesh = new THREE.Mesh(box, mat);
      mesh.scale.set(...scale);
      mesh.position.set(...pos);
      if (rot) mesh.rotation.set(...rot);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    const addCyl = (group: THREE.Group, mat: THREE.Material, radius: number, length: number, pos: [number, number, number]): THREE.Mesh => {
      const mesh = new THREE.Mesh(cyl, mat);
      mesh.scale.set(radius, length, radius);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(...pos);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    const register = (id: WeaponId, group: THREE.Group, muzzleZ: number): void => {
      const muzzle = new THREE.Object3D();
      muzzle.position.set(0, 0.02, muzzleZ);
      group.add(muzzle);
      group.visible = false;
      this.root.add(group);
      this.guns.set(id, { group, muzzle, restZ: 0 });
    };

    // Pistol: compact slide, exposed grip.
    {
      const group = new THREE.Group();
      add(group, gunmetal, [0.1, 0.13, 0.36], [0, 0.04, 0.08]);
      add(group, dark, [0.09, 0.22, 0.12], [0, -0.13, -0.02], [0.32, 0, 0]);
      add(group, accent, [0.02, 0.05, 0.02], [0, 0.12, 0.22]);
      addCyl(group, dark, 0.032, 0.22, [0, 0.04, 0.34]);
      register('pistol', group, 0.46);
    }
    // SMG: boxy receiver, curved mag, red dot.
    {
      const group = new THREE.Group();
      add(group, gunmetal, [0.12, 0.16, 0.5], [0, 0.03, 0.1]);
      addCyl(group, dark, 0.035, 0.3, [0, 0.04, 0.42]);
      add(group, dark, [0.08, 0.24, 0.12], [0, -0.16, 0.04], [0.2, 0, 0]);
      add(group, dark, [0.07, 0.2, 0.1], [0, -0.15, 0.2]);
      add(group, dark, [0.06, 0.08, 0.34], [0, 0.0, -0.3]);
      add(group, accent, [0.02, 0.03, 0.22], [0, 0.12, 0.04]);
      add(group, glass, [0.05, 0.05, 0.06], [0, 0.14, 0.08]);
      register('smg', group, 0.62);
    }
    // Shotgun: long barrel, wooden pump and stock.
    {
      const group = new THREE.Group();
      add(group, gunmetal, [0.1, 0.14, 0.46], [0, 0.02, 0.06]);
      addCyl(group, dark, 0.045, 0.78, [0, 0.07, 0.5]);
      addCyl(group, dark, 0.03, 0.5, [0, -0.02, 0.45]);
      add(group, wood, [0.11, 0.13, 0.24], [0, -0.02, 0.32]);
      add(group, wood, [0.09, 0.2, 0.3], [0, -0.08, -0.26], [0.18, 0, 0]);
      add(group, accent, [0.02, 0.03, 0.12], [0, 0.11, 0.02]);
      register('shotgun', group, 0.9);
    }
    // Rifle: long precision barrel and scope.
    {
      const group = new THREE.Group();
      add(group, gunmetal, [0.11, 0.13, 0.62], [0, 0.02, 0.1]);
      addCyl(group, dark, 0.034, 0.75, [0, 0.03, 0.72]);
      add(group, dark, [0.07, 0.22, 0.12], [0, -0.15, 0.14], [0.15, 0, 0]);
      add(group, dark, [0.08, 0.16, 0.3], [0, -0.05, -0.34], [0.1, 0, 0]);
      add(group, dark, [0.07, 0.07, 0.3], [0, 0.14, 0.14]);
      add(group, glass, [0.055, 0.055, 0.16], [0, 0.18, 0.14]);
      add(group, accent, [0.018, 0.03, 0.3], [0, 0.1, 0.02]);
      register('rifle', group, 1.1);
    }

    const glowTexture = (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,246,200,1)');
        gradient.addColorStop(0.4, 'rgba(255,196,80,0.7)');
        gradient.addColorStop(1, 'rgba(255,150,40,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
      }
      return new THREE.CanvasTexture(canvas);
    })();
    const flashMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.materials.push(flashMaterial);
    this.flash = new THREE.Sprite(flashMaterial);
    this.flash.scale.set(0.55, 0.55, 1);
    this.flash.visible = false;
    this.root.add(this.flash);
    this.flashLight = new THREE.PointLight('#ffcf7a', 0, 8, 2);
    this.root.add(this.flashLight);
  }

  setWeapon(id: WeaponId | null): void {
    this.active = id;
    for (const [gunId, gun] of this.guns) gun.group.visible = gunId === id;
    if (!id) {
      this.flash.visible = false;
      this.flashLight.intensity = 0;
    }
  }

  /** Must run after player.updateVisual so the aim pose wins over the anim. */
  pose(visual: CharacterVisual, dodging: boolean, hurt: boolean): void {
    if (!this.active || dodging || hurt) return;
    visual.joints.armR.rotation.set(-1.38, 0.02, 0.1);
    visual.joints.elbowR.rotation.set(-0.16, 0, 0);
    visual.joints.armL.rotation.set(-1.08, 0.12, 0.66);
    visual.joints.elbowL.rotation.set(-1.05, 0, 0);
    visual.joints.torso.rotation.x += -0.05;
  }

  update(dt: number): void {
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    if (this.flashTime <= 0) {
      this.flash.visible = false;
      this.flashLight.intensity = 0;
    } else {
      this.flash.material.opacity = Math.min(1, this.flashTime * 14);
    }
    const gun = this.active ? this.guns.get(this.active) : null;
    if (gun) gun.group.position.z = -this.recoil * 0.09;
  }

  flashAt(): THREE.Vector3 {
    const gun = this.active ? this.guns.get(this.active) : null;
    this.flashTime = 0.07;
    this.recoil = Math.min(1, this.recoil + 0.55);
    this.flash.visible = true;
    if (gun) {
      this.flash.position.copy(gun.muzzle.position);
      this.flashLight.position.copy(gun.muzzle.position);
    }
    this.flashLight.intensity = 5.5;
    const out = new THREE.Vector3();
    if (gun) gun.muzzle.getWorldPosition(out);
    else this.elbow.getWorldPosition(out);
    return out;
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.flash.material.map?.dispose();
  }
}
