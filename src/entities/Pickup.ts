import * as THREE from 'three';

const sharedGeometry = {
  bun: new THREE.SphereGeometry(1, 10, 8),
  filling: new THREE.BoxGeometry(1, 1, 1),
  olive: new THREE.SphereGeometry(1, 8, 6),
};

export class Pickup {
  readonly root = new THREE.Group();
  readonly position: THREE.Vector3;
  readonly heal: number;
  collected = false;
  private life = 30;
  private readonly materials: THREE.Material[] = [];
  private readonly ring: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private spin: number;

  constructor(scene: THREE.Scene, position: THREE.Vector3, heal = 30) {
    this.position = position.clone();
    this.heal = heal;
    this.spin = Math.random() * Math.PI * 2;
    const bunMat = new THREE.MeshStandardMaterial({ color: '#d9a95c', roughness: 0.85, flatShading: true });
    const crustMat = new THREE.MeshStandardMaterial({ color: '#b57c34', roughness: 0.9, flatShading: true });
    const hamMat = new THREE.MeshStandardMaterial({ color: '#b94b45', roughness: 0.8, flatShading: true });
    const cheeseMat = new THREE.MeshStandardMaterial({ color: '#f0d58a', roughness: 0.7, flatShading: true });
    const oliveMat = new THREE.MeshStandardMaterial({ color: '#3d5b2a', roughness: 0.8 });
    this.materials.push(bunMat, crustMat, hamMat, cheeseMat, oliveMat);

    const top = new THREE.Mesh(sharedGeometry.bun, bunMat);
    top.scale.set(0.26, 0.14, 0.15);
    top.position.y = 0.15;
    const bottom = new THREE.Mesh(sharedGeometry.bun, crustMat);
    bottom.scale.set(0.26, 0.09, 0.15);
    bottom.position.y = 0.0;
    const ham = new THREE.Mesh(sharedGeometry.filling, hamMat);
    ham.scale.set(0.42, 0.05, 0.24);
    ham.position.y = 0.08;
    const cheese = new THREE.Mesh(sharedGeometry.filling, cheeseMat);
    cheese.scale.set(0.38, 0.035, 0.22);
    cheese.position.set(0.02, 0.11, 0.01);
    cheese.rotation.z = 0.1;
    const toothpick = new THREE.Mesh(sharedGeometry.filling, bunMat);
    toothpick.scale.set(0.02, 0.2, 0.02);
    toothpick.position.y = 0.27;
    const olive = new THREE.Mesh(sharedGeometry.olive, oliveMat);
    olive.scale.setScalar(0.055);
    olive.position.y = 0.37;
    this.root.add(top, bottom, ham, cheese, toothpick, olive);
    this.root.position.copy(position).setY(0.72);

    this.ringMat = new THREE.MeshBasicMaterial({
      color: '#ffd400',
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.materials.push(this.ringMat);
    const ringGeo = new THREE.RingGeometry(0.55, 0.7, 24);
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(position.x, 0.035, position.z);
    scene.add(this.ring);
    scene.add(this.root);
  }

  update(dt: number): void {
    if (this.collected) return;
    this.life -= dt;
    this.spin += dt * 2.4;
    this.root.rotation.y = this.spin;
    this.root.position.y = 0.72 + Math.sin(this.spin * 1.6) * 0.08;
    const pulse = 0.4 + Math.abs(Math.sin(this.spin * 1.4)) * 0.35;
    this.ringMat.opacity = this.life < 5 ? pulse * Math.max(0, this.life / 5) : pulse;
  }

  get expired(): boolean {
    return this.life <= 0;
  }

  collect(): void {
    this.collected = true;
    this.root.visible = false;
    this.ring.visible = false;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.ring.removeFromParent();
    this.ring.geometry.dispose();
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry !== sharedGeometry.bun && object.geometry !== sharedGeometry.filling && object.geometry !== sharedGeometry.olive) {
        object.geometry.dispose();
      }
    });
    for (const material of this.materials) material.dispose();
  }
}
