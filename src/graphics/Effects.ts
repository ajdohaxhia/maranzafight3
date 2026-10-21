import * as THREE from 'three';

interface Spark {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  spin: number;
  color: THREE.Color;
}

interface RingFx {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  baseScale: number;
  delay: number;
}

interface Telegraph {
  mesh: THREE.Mesh;
  until: number;
  radius: number;
}

interface PillarFx {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface FlashFx {
  sprite: THREE.Sprite;
  life: number;
  maxLife: number;
  baseScale: number;
}

const MAX_SPARKS = 140;
const MAX_RINGS = 10;
const MAX_TELEGRAPHS = 8;
const MAX_PILLARS = 4;
const MAX_FLASHES = 8;

/**
 * Object-pooled arcade feedback: sparks, shockwave rings, ground telegraphs
 * and special-attack pillars. No allocation during gameplay.
 */
export class Effects {
  private readonly scene: THREE.Scene;
  private readonly group = new THREE.Group();
  private readonly sparkMesh: THREE.InstancedMesh;
  private readonly sparks: Spark[] = [];
  private readonly rings: RingFx[] = [];
  private readonly pillars: PillarFx[] = [];
  private readonly flashes: FlashFx[] = [];
  private readonly telegraphs: Map<number, Telegraph> = new Map();
  private readonly dummy = new THREE.Object3D();
  private readonly sparkGeo: THREE.BufferGeometry;
  private readonly ringGeo: THREE.BufferGeometry;
  private readonly pillarGeo: THREE.BufferGeometry;
  private readonly sparkMat: THREE.MeshBasicMaterial;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly telegraphMat: THREE.MeshBasicMaterial;
  private readonly pillarMat: THREE.MeshBasicMaterial;
  private density = 1;
  private now = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.renderOrder = 5;
    this.scene.add(this.group);

    this.sparkGeo = new THREE.IcosahedronGeometry(1, 0);
    this.sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.sparkMesh = new THREE.InstancedMesh(this.sparkGeo, this.sparkMat, MAX_SPARKS);
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.count = MAX_SPARKS;
    this.group.add(this.sparkMesh);

    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparks.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 0.05,
        spin: 0,
        color: new THREE.Color('#ffffff'),
      });
      this.dummy.position.set(0, -1000, 0);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, this.dummy.matrix);
      this.sparkMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;

    this.ringGeo = new THREE.RingGeometry(0.82, 1, 32);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd400,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.pillarGeo = new THREE.CylinderGeometry(0.7, 0.35, 1, 12, 1, true);
    this.pillarMat = new THREE.MeshBasicMaterial({
      color: 0xffe45c,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.telegraphMat = new THREE.MeshBasicMaterial({
      color: 0xff2f2f,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    for (let i = 0; i < MAX_RINGS; i++) {
      const mesh = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.group.add(mesh);
      this.rings.push({ mesh, life: 0, maxLife: 1, baseScale: 1, delay: 0 });
    }
    for (let i = 0; i < MAX_PILLARS; i++) {
      const mesh = new THREE.Mesh(this.pillarGeo, this.pillarMat.clone());
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.group.add(mesh);
      this.pillars.push({ mesh, life: 0, maxLife: 1 });
    }

    // Bright additive puffs for heavy impacts: reads as a bloom flash.
    const flashTexture = this.createGlowTexture();
    for (let i = 0; i < MAX_FLASHES; i++) {
      const material = new THREE.SpriteMaterial({
        map: flashTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 7;
      this.group.add(sprite);
      this.flashes.push({ sprite, life: 0, maxLife: 1, baseScale: 1 });
    }
    this.flashTexture = flashTexture;
  }

  private createGlowTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.28, 'rgba(255,255,255,0.55)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private readonly flashTexture: THREE.Texture | null = null;

  setDensity(density: number): void {
    this.density = Math.min(1, Math.max(0.25, density));
  }

  spawnSparks(position: THREE.Vector3, color: string, count = 10, power = 1): void {
    const total = Math.max(3, Math.round(count * this.density));
    const baseColor = new THREE.Color(color);
    let spawned = 0;
    for (const spark of this.sparks) {
      if (spawned >= total) break;
      if (spark.active) continue;
      spark.active = true;
      spark.pos.set(
        position.x + (Math.random() - 0.5) * 0.35,
        position.y + 0.9 + (Math.random() - 0.5) * 0.35,
        position.z + (Math.random() - 0.5) * 0.35,
      );
      const speed = (2.2 + Math.random() * 3.4) * power;
      const a = Math.random() * Math.PI * 2;
      const up = 1.4 + Math.random() * 3.4 * power;
      spark.vel.set(Math.cos(a) * speed, up, Math.sin(a) * speed);
      spark.maxLife = 0.22 + Math.random() * 0.3;
      spark.life = spark.maxLife;
      spark.size = 0.035 + Math.random() * 0.045;
      spark.spin = (Math.random() - 0.5) * 18;
      spark.color.copy(baseColor);
      spawned++;
    }
  }

  spawnRing(position: THREE.Vector3, color: string, radius: number, duration = 0.4, delay = 0): void {
    const slot = this.rings.find((ring) => ring.life <= 0) ?? this.rings[0];
    if (!slot) return;
    slot.life = duration;
    slot.maxLife = duration;
    slot.baseScale = radius;
    slot.delay = delay;
    const material = slot.mesh.material as THREE.MeshBasicMaterial;
    material.color.set(color);
    material.opacity = 0;
    slot.mesh.position.set(position.x, 0.06, position.z);
    slot.mesh.scale.setScalar(radius * 0.25);
    slot.mesh.visible = true;
  }

  spawnPillar(position: THREE.Vector3, color: string, height: number): void {
    const slot = this.pillars.find((pillar) => pillar.life <= 0) ?? this.pillars[0];
    if (!slot) return;
    slot.life = 0.45;
    slot.maxLife = 0.45;
    const material = slot.mesh.material as THREE.MeshBasicMaterial;
    material.color.set(color);
    slot.mesh.position.set(position.x, height / 2, position.z);
    slot.mesh.scale.set(1, height, 1);
    slot.mesh.visible = true;
  }

  /** Short bright burst at the impact point. Cheap fake bloom. */
  spawnFlash(position: THREE.Vector3, color: string, size = 1.5, duration = 0.22): void {
    const slot = this.flashes.find((flash) => flash.life <= 0) ?? this.flashes[0];
    if (!slot) return;
    slot.life = duration;
    slot.maxLife = duration;
    slot.baseScale = size;
    const material = slot.sprite.material as THREE.SpriteMaterial;
    material.color.set(color);
    material.opacity = 0.9;
    slot.sprite.position.copy(position);
    slot.sprite.scale.setScalar(size * 0.35);
    slot.sprite.visible = true;
  }

  setTelegraph(id: number, position: THREE.Vector3, radius: number, duration: number, color?: string): void {
    let entry = this.telegraphs.get(id);
    if (!entry) {
      if (this.telegraphs.size >= MAX_TELEGRAPHS) return;
      const mesh = new THREE.Mesh(this.ringGeo, this.telegraphMat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = true;
      mesh.renderOrder = 4;
      this.group.add(mesh);
      entry = { mesh, until: 0, radius };
      this.telegraphs.set(id, entry);
    }
    if (color) (entry.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    entry.until = this.now + duration;
    entry.radius = radius;
    entry.mesh.position.set(position.x, 0.045, position.z);
    entry.mesh.scale.setScalar(radius);
    entry.mesh.visible = true;
  }

  clearTelegraph(id: number): void {
    const entry = this.telegraphs.get(id);
    if (!entry) return;
    this.group.remove(entry.mesh);
    (entry.mesh.material as THREE.Material).dispose();
    this.telegraphs.delete(id);
  }

  update(dt: number): void {
    this.now += dt;
    const clamped = Math.min(dt, 0.05);

    for (let i = 0; i < this.sparks.length; i++) {
      const spark = this.sparks[i];
      if (!spark) continue;
      if (spark.active) {
        spark.life -= clamped;
        if (spark.life <= 0) {
          spark.active = false;
          this.dummy.position.set(0, -1000, 0);
          this.dummy.scale.setScalar(0);
        } else {
          spark.vel.y -= 11 * clamped;
          spark.pos.addScaledVector(spark.vel, clamped);
          if (spark.pos.y < 0.04) {
            spark.pos.y = 0.04;
            spark.vel.y *= -0.35;
            spark.vel.x *= 0.7;
            spark.vel.z *= 0.7;
          }
          const lifeRatio = spark.life / spark.maxLife;
          const scale = spark.size * (0.4 + lifeRatio * 0.9);
          this.dummy.position.copy(spark.pos);
          this.dummy.rotation.set(spark.spin * this.now, spark.spin * this.now * 0.7, 0);
          this.dummy.scale.setScalar(scale);
          this.dummy.updateMatrix();
          this.sparkMesh.setMatrixAt(i, this.dummy.matrix);
          this.sparkMesh.setColorAt(i, spark.color);
        }
      }
      if (!spark.active) {
        this.dummy.position.set(0, -1000, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.sparkMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;

    for (const ring of this.rings) {
      if (ring.life <= 0) {
        ring.mesh.visible = false;
        continue;
      }
      if (ring.delay > 0) {
        ring.delay -= clamped;
        continue;
      }
      ring.life -= clamped;
      const t = 1 - Math.max(0, ring.life) / ring.maxLife;
      const material = ring.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.85 * (1 - t));
      ring.mesh.scale.setScalar(ring.baseScale * (0.3 + t * 1.1));
      ring.mesh.visible = ring.life > 0;
    }

    for (const pillar of this.pillars) {
      if (pillar.life <= 0) {
        pillar.mesh.visible = false;
        continue;
      }
      pillar.life -= clamped;
      const t = 1 - Math.max(0, pillar.life) / pillar.maxLife;
      const material = pillar.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.7 * (1 - t));
      pillar.mesh.scale.x = pillar.mesh.scale.z = 1 + t * 0.8;
      pillar.mesh.visible = pillar.life > 0;
    }

    for (const flash of this.flashes) {
      if (flash.life <= 0) {
        flash.sprite.visible = false;
        continue;
      }
      flash.life -= clamped;
      const t = 1 - Math.max(0, flash.life) / flash.maxLife;
      const material = flash.sprite.material as THREE.SpriteMaterial;
      material.opacity = Math.max(0, 0.9 * (1 - t) * (1 - t));
      flash.sprite.scale.setScalar(flash.baseScale * (0.35 + t * 0.95));
      flash.sprite.visible = flash.life > 0;
    }

    for (const [id, entry] of this.telegraphs) {
      if (entry.until < this.now) {
        this.clearTelegraph(id);
        continue;
      }
      const pulse = 0.4 + Math.abs(Math.sin(this.now * 9)) * 0.35;
      const material = entry.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = pulse;
      entry.mesh.scale.setScalar(entry.radius * (0.94 + pulse * 0.08));
    }
  }

  clear(): void {
    for (const spark of this.sparks) spark.active = false;
    for (const ring of this.rings) {
      ring.life = 0;
      ring.mesh.visible = false;
    }
    for (const pillar of this.pillars) {
      pillar.life = 0;
      pillar.mesh.visible = false;
    }
    for (const flash of this.flashes) {
      flash.life = 0;
      flash.sprite.visible = false;
    }
    for (const id of [...this.telegraphs.keys()]) this.clearTelegraph(id);
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
    this.sparkGeo.dispose();
    this.ringGeo.dispose();
    this.pillarGeo.dispose();
    this.sparkMat.dispose();
    this.ringMat.dispose();
    this.pillarMat.dispose();
    this.telegraphMat.dispose();
    this.sparkMesh.dispose();
    for (const ring of this.rings) {
      this.group.remove(ring.mesh);
      (ring.mesh.material as THREE.Material).dispose();
    }
    for (const pillar of this.pillars) {
      this.group.remove(pillar.mesh);
      (pillar.mesh.material as THREE.Material).dispose();
    }
    for (const entry of this.telegraphs.values()) {
      (entry.mesh.material as THREE.Material).dispose();
    }
    for (const flash of this.flashes) {
      this.group.remove(flash.sprite);
      (flash.sprite.material as THREE.Material).dispose();
    }
    this.flashTexture?.dispose();
    this.group.clear();
  }
}
