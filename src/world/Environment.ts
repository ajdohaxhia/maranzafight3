import * as THREE from 'three';
import type { Physics } from '../core/Physics';
import type { Quality } from '../systems/SettingsManager';

export interface BoxOptions {
  pos: [number, number, number];
  size: [number, number, number];
  color?: string;
  material?: THREE.Material;
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  collider?: boolean;
  cast?: boolean;
  receive?: boolean;
}

export interface CylinderOptions {
  pos: [number, number, number];
  radiusTop: number;
  radiusBottom: number;
  height: number;
  color?: string;
  material?: THREE.Material;
  segments?: number;
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  collider?: boolean;
}

export interface SignOptions {
  pos: [number, number, number];
  size: [number, number];
  rotY?: number;
  bg?: string;
  fg?: string;
  accent?: string;
  sub?: string;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

/** Soft moon disc with a few craters, drawn once into a sprite texture. */
export function makeMoonTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    const glow = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
    glow.addColorStop(0, 'rgba(255,248,220,1)');
    glow.addColorStop(0.42, 'rgba(248,240,208,0.92)');
    glow.addColorStop(0.55, 'rgba(220,226,246,0.28)');
    glow.addColorStop(1, 'rgba(180,196,240,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);
    const rnd = seeded(91);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 54;
      const x = 128 + Math.cos(a) * r;
      const y = 128 + Math.sin(a) * r;
      const radius = 3 + rnd() * 9;
      ctx.fillStyle = `rgba(196,196,186,${(0.1 + rnd() * 0.18).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Stratified cloud sheet: soft blobs with transparent gaps, tiled on a plane. */
export function makeCloudTexture(seed = 7): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    const rnd = seeded(seed);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const radius = 24 + rnd() * 78;
      const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
      const alpha = 0.05 + rnd() * 0.11;
      gradient.addColorStop(0, `rgba(206,214,236,${alpha.toFixed(3)})`);
      gradient.addColorStop(0.55, `rgba(170,180,208,${(alpha * 0.6).toFixed(3)})`);
      gradient.addColorStop(1, 'rgba(120,130,170,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  });
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, seed: number): void {
  const rnd = seeded(seed);
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const a = rnd() * 0.12;
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    ctx.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
    ctx.fillStyle = `rgba(0,0,0,${(a * 1.6).toFixed(3)})`;
    ctx.fillRect(x + 2, y + 1, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

export function makePlazaTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    // Piastrelle realistiche: fondo calcestruzzo scuro continuo con speckles,
    // lastre di misura realistica, giunti profondi disegnati (non puntini).
    ctx.fillStyle = '#232428';
    ctx.fillRect(0, 0, 512, 512);
    const rnd = seeded(17);
    const slab = 170;
    for (let y = 0; y < 512; y += slab) {
      for (let x = 0; x < 512; x += slab) {
        const shade = 40 + Math.floor(rnd() * 12);
        ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 7})`;
        ctx.fillRect(x + 3, y + 3, slab - 6, slab - 6);
        // Giunto profondo: scia di fuga leggibile, lucentezza solo locale.
        ctx.strokeStyle = 'rgba(10,10,12,0.9)';
        ctx.lineWidth = 5;
        ctx.strokeRect(x + 1.5, y + 1.5, slab - 3, slab - 3);
        // Usura asimmetrica (scia del traffico) invece di highlight uniforme.
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(x + 10, y + slab - 14, slab - 44, 5);
        // Piccola crepa procedurale per lastra.
        if (rnd() > 0.5) {
          ctx.strokeStyle = 'rgba(8,8,10,0.5)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          const sx = x + 30 + rnd() * (slab - 90);
          const sy = y + 30 + rnd() * (slab - 90);
          ctx.moveTo(sx, sy);
          let cx = sx;
          let cy = sy;
          for (let step = 0; step < 5; step++) {
            cx += 6 + rnd() * 14;
            cy += (rnd() - 0.5) * 22;
            ctx.lineTo(cx, cy);
          }
          ctx.stroke();
        }
      }
    }
    speckle(ctx, 512, 512, 2200, 91);
  }, 3, 3);
}

export function makeMetroTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#262b2e';
    ctx.fillRect(0, 0, 512, 512);
    const tile = 64;
    for (let y = 0; y < 512; y += tile) {
      for (let x = 0; x < 512; x += tile) {
        const v = 39 + Math.floor(((x * 7 + y * 13) % 5) * 4);
        ctx.fillStyle = `rgb(${v},${v + 4},${v + 5})`;
        ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += tile) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,212,0,0.14)';
    ctx.fillRect(0, 232, 512, 10);
    speckle(ctx, 512, 512, 800, 43);
  }, 6, 6);
}

export function makeDuomoTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#38363d';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(8,8,10,0.7)';
    ctx.lineWidth = 4;
    const r = 64;
    for (let row = -1; row < 7; row++) {
      for (let col = -1; col < 7; col++) {
        const cx = col * 96 + (row % 2 === 0 ? 48 : 0);
        const cy = row * 84;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.012)';
        ctx.fill();
      }
    }
    speckle(ctx, 512, 512, 1400, 7);
  }, 5, 5);
}

export function makeCobbleTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#2a2724';
    ctx.fillRect(0, 0, 512, 512);
    const rnd = seeded(311);
    const stone = 46;
    for (let row = 0; row < 11; row++) {
      const offset = row % 2 === 0 ? 0 : stone / 2;
      for (let col = -1; col < 12; col++) {
        const x = col * stone + offset + rnd() * 3;
        const y = row * stone + rnd() * 3;
        const shade = 40 + Math.floor(rnd() * 22);
        ctx.fillStyle = `rgb(${shade + 4},${shade + 1},${shade - 2})`;
        ctx.fillRect(x + 2, y + 2, stone - 5, stone - 5);
        ctx.strokeStyle = 'rgba(9,8,8,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, stone - 5, stone - 5);
      }
    }
    const wet = ctx.createLinearGradient(0, 0, 512, 512);
    wet.addColorStop(0, 'rgba(80,120,140,0.1)');
    wet.addColorStop(0.5, 'rgba(20,20,26,0.16)');
    wet.addColorStop(1, 'rgba(120,70,150,0.1)');
    ctx.fillStyle = wet;
    ctx.fillRect(0, 0, 512, 512);
    speckle(ctx, 512, 512, 1500, 71);
  }, 5, 5);
}

export function makeGrassTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#1c2a1b';
    ctx.fillRect(0, 0, 512, 512);
    const rnd = seeded(441);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const shade = 30 + Math.floor(rnd() * 34);
      ctx.strokeStyle = `rgba(${shade},${shade + 22},${shade - 4},0.55)`;
      ctx.lineWidth = 1 + rnd();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 5, y - 3 - rnd() * 6);
      ctx.stroke();
    }
    speckle(ctx, 512, 512, 700, 23);
  }, 5, 5);
}

export function makeDirtTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#3a3128';
    ctx.fillRect(0, 0, 512, 512);
    const rnd = seeded(881);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const shade = 44 + Math.floor(rnd() * 26);
      ctx.fillStyle = `rgba(${shade + 12},${shade + 4},${shade - 8},${(0.15 + rnd() * 0.3).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + rnd() * 12, 1 + rnd() * 6, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(20,18,16,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const x = rnd() * 512;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 40, 160, x - 30, 340, x + 12, 512);
      ctx.stroke();
    }
  }, 4, 4);
}

export function makeRoofTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#2e3033';
    ctx.fillRect(0, 0, 512, 512);
    const rnd = seeded(907);
    for (let i = 0; i < 46; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const w = 30 + rnd() * 90;
      const h = 18 + rnd() * 70;
      const shade = 34 + Math.floor(rnd() * 16);
      ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 4},0.55)`;
      ctx.fillRect(x, y, w, h);
    }
    ctx.strokeStyle = 'rgba(10,11,13,0.6)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    speckle(ctx, 512, 512, 1800, 13);
  }, 4, 4);
}

export function makeWaterTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 256, 256);
    const rnd = seeded(1201);
    for (let i = 0; i < 90; i++) {
      const y = rnd() * 256;
      const x = rnd() * 256;
      const w = 12 + rnd() * 70;
      const alpha = 0.05 + rnd() * 0.22;
      ctx.strokeStyle = `rgba(${180 + Math.floor(rnd() * 60)},${200 + Math.floor(rnd() * 40)},255,${alpha.toFixed(2)})`;
      ctx.lineWidth = 0.8 + rnd() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + w * 0.3, y - 2, x + w * 0.6, y + 2, x + w, y);
      ctx.stroke();
    }
  }, 3, 3);
}

export function makeWindowTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 512, (ctx) => {
    ctx.fillStyle = '#0d0e12';
    ctx.fillRect(0, 0, 256, 512);
    const rnd = seeded(29);
    for (let y = 16; y < 500; y += 34) {
      for (let x = 14; x < 246; x += 28) {
        const lit = rnd() > 0.54;
        if (lit) {
          const warm = rnd() > 0.3;
          ctx.fillStyle = warm ? 'rgba(255,206,120,0.9)' : 'rgba(150,210,255,0.75)';
        } else {
          ctx.fillStyle = 'rgba(35,38,48,0.85)';
        }
        ctx.fillRect(x, y, 14, 18);
      }
    }
  }, 1, 1);
}

export function makeSignTexture(
  text: string,
  sub: string,
  bg = '#111214',
  fg = '#ffd400',
  accent = '#ff2f2f',
): THREE.CanvasTexture {
  return canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = 'rgba(243,239,227,0.25)';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, 488, 232);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 512, 14);
    ctx.fillStyle = fg;
    ctx.font = '900 58px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, 256, 116 + i * 58);
    });
    if (sub) {
      ctx.fillStyle = 'rgba(243,239,227,0.7)';
      ctx.font = '700 22px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(sub, 256, 210);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let i = 0; i < 26; i++) {
      ctx.fillRect(0, i * 11, 512, 1);
    }
  }, 1, 1);
}

/**
 * Owns every disposable resource for a level: group, meshes, materials,
 * textures, geometries and Rapier colliders (removed with the physics reset).
 */
export class LevelBuilder {
  readonly group = new THREE.Group();
  readonly physics: Physics;
  readonly quality: Quality;
  readonly geometries: THREE.BufferGeometry[] = [];
  readonly materials: THREE.Material[] = [];
  readonly textures: THREE.Texture[] = [];
  private readonly materialCache = new Map<string, THREE.Material>();
  readonly boxGeo: THREE.BufferGeometry;
  private readonly sphereGeo: THREE.BufferGeometry;
  private glowTexture: THREE.CanvasTexture | null = null;
  private skyRoot: THREE.Group | null = null;
  private cloudGroup: THREE.Group | null = null;
  private time = 0;
  /** Callbacks driven once per frame by the game (water, boats, flickering neon). */
  readonly animations: Array<(time: number, dt: number) => void> = [];

  constructor(physics: Physics, quality: Quality) {
    this.physics = physics;
    this.quality = quality;
    this.group.name = 'level';
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.sphereGeo = new THREE.SphereGeometry(1, 14, 10);
    this.geometries.push(this.boxGeo, this.sphereGeo);
  }

  material(
    color: string,
    options: {
      roughness?: number;
      metalness?: number;
      emissive?: string;
      emissiveIntensity?: number;
      basic?: boolean;
      transparent?: boolean;
      opacity?: number;
      map?: THREE.Texture;
      flat?: boolean;
    } = {},
  ): THREE.Material {
    const key = JSON.stringify({ color, ...options, mapId: options.map?.uuid });
    const cached = this.materialCache.get(key);
    if (cached) return cached;
    let material: THREE.Material;
    if (options.basic) {
      material = new THREE.MeshBasicMaterial({
        color,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1,
        side: THREE.FrontSide,
        toneMapped: false,
        ...(options.map ? { map: options.map } : {}),
      });
    } else {
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.78,
        metalness: options.metalness ?? 0.06,
        emissive: options.emissive ?? '#000000',
        emissiveIntensity: options.emissiveIntensity ?? 0,
        flatShading: options.flat ?? true,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1,
        ...(options.map ? { map: options.map } : {}),
      });
    }
    this.materials.push(material);
    this.materialCache.set(key, material);
    return material;
  }

  texture(texture: THREE.CanvasTexture): THREE.CanvasTexture {
    this.textures.push(texture);
    return texture;
  }

  box(options: BoxOptions): THREE.Mesh {
    const material = options.material ?? this.material(options.color ?? '#55555a');
    const mesh = new THREE.Mesh(this.boxGeo, material);
    mesh.position.set(...options.pos);
    mesh.scale.set(options.size[0], options.size[1], options.size[2]);
    if (options.rotY) mesh.rotation.y = options.rotY;
    if (options.rotX) mesh.rotation.x = options.rotX;
    if (options.rotZ) mesh.rotation.z = options.rotZ;
    mesh.castShadow = options.cast ?? false;
    mesh.receiveShadow = options.receive ?? true;
    this.group.add(mesh);
    if (options.collider) {
      this.physics.addStaticBox(
        { x: options.pos[0], y: options.pos[1], z: options.pos[2] },
        { x: options.size[0] / 2, y: options.size[1] / 2, z: options.size[2] / 2 },
        options.rotY ?? 0,
      );
    }
    return mesh;
  }

  cylinder(options: CylinderOptions): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
      options.radiusTop,
      options.radiusBottom,
      options.height,
      options.segments ?? 12,
      1,
    );
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, options.material ?? this.material(options.color ?? '#66666b'));
    mesh.position.set(...options.pos);
    if (options.rotY) mesh.rotation.y = options.rotY;
    if (options.rotX) mesh.rotation.x = options.rotX;
    if (options.rotZ) mesh.rotation.z = options.rotZ;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    if (options.collider) {
      const extent = Math.max(options.radiusTop, options.radiusBottom) * 1.3;
      this.physics.addStaticBox(
        { x: options.pos[0], y: options.pos[1], z: options.pos[2] },
        { x: extent, y: options.height / 2, z: extent },
      );
    }
    return mesh;
  }

  sphere(pos: [number, number, number], scale: [number, number, number], material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(this.sphereGeo, material);
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    this.group.add(mesh);
    return mesh;
  }

  sign(text: string, options: SignOptions): THREE.Mesh {
    const texture = this.texture(
      makeSignTexture(text, options.sub ?? '', options.bg, options.fg, options.accent),
    );
    const material = this.material('#ffffff', { basic: true, map: texture });
    const geometry = new THREE.PlaneGeometry(options.size[0], options.size[1]);
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...options.pos);
    if (options.rotY) mesh.rotation.y = options.rotY;
    this.group.add(mesh);
    this.box({
      pos: [options.pos[0], options.pos[1] + options.size[1] / 2 + 0.04, options.pos[2] - 0.03],
      size: [options.size[0] + 0.12, 0.08, 0.06],
      color: '#0a0a0c',
      rotY: options.rotY,
    });
    return mesh;
  }

  plane(
    pos: [number, number, number],
    size: [number, number],
    material: THREE.Material,
    rotX = -Math.PI / 2,
  ): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(size[0], size[1]);
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...pos);
    mesh.rotation.x = rotX;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  ground(sizeX: number, sizeZ: number, texture: THREE.Texture, y = 0, tileSize = 9): void {
    texture.repeat.set(sizeX / tileSize, sizeZ / tileSize);
    const material = this.material('#ffffff', { map: texture, roughness: 0.95 });
    this.plane([0, y, 0], [sizeX, sizeZ], material);
    this.physics.addGround(sizeX + 10, sizeZ + 10, y);
  }

  boundary(minX: number, maxX: number, minZ: number, maxZ: number, height = 2.2): void {
    const thickness = 0.7;
    const positions: Array<[number, number, number, number, number, number]> = [
      [0, height / 2, minZ - thickness / 2, maxX - minX + 2, height, thickness],
      [0, height / 2, maxZ + thickness / 2, maxX - minX + 2, height, thickness],
      [minX - thickness / 2, height / 2, 0, thickness, height, maxZ - minZ + 2],
      [maxX + thickness / 2, height / 2, 0, thickness, height, maxZ - minZ + 2],
    ];
    for (const [x, y, z, w, h, d] of positions) {
      this.physics.addStaticBox({ x, y, z }, { x: w / 2, y: h / 2, z: d / 2 });
    }
  }

  addStars(count = 380, radius = 120): void {
    const rnd = seeded(733);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const y = 0.22 + rnd() * 0.75;
      const r = Math.sqrt(1 - y * y);
      positions[i * 3] = Math.cos(a) * r * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(a) * r * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometries.push(geometry);
    const material = new THREE.PointsMaterial({
      color: 0xc9d4e0,
      size: 0.55,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.materials.push(material);
    const stars = new THREE.Points(geometry, material);
    stars.frustumCulled = false;
    stars.renderOrder = -40;
    (this.skyRoot ?? this.group).add(stars);
  }

  addSky(top: string, horizon: string): void {
    const skyRoot = new THREE.Group();
    skyRoot.name = 'night-sky';
    this.skyRoot = skyRoot;
    this.group.add(skyRoot);

    // Must stay inside the camera's far plane (260): a larger dome gets clipped
    // into a hard circular silhouette in the sky.
    const geometry = new THREE.SphereGeometry(220, 28, 18);
    this.geometries.push(geometry);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(top) },
        bottomColor: { value: new THREE.Color(horizon) },
        offset: { value: 8 },
        exponent: { value: 0.75 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.materials.push(material);
    const sky = new THREE.Mesh(geometry, material);
    sky.name = 'sky-dome';
    sky.frustumCulled = false;
    // Draw first and never write/test depth: the dome must not cut the stars
    // or the moon out of the sky with an opaque silhouette.
    sky.renderOrder = -100;
    skyRoot.add(sky);

    // Moon sits in the same direction as the key directional light so the
    // highlights on the city read as moonlight, not decoration.
    const moonTexture = this.texture(makeMoonTexture());
    const moonMaterial = new THREE.SpriteMaterial({
      map: moonTexture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false,
    });
    this.materials.push(moonMaterial);
    const moon = new THREE.Sprite(moonMaterial);
    moon.position.set(105, 148, 122);
    moon.scale.set(52, 52, 1);
    moon.renderOrder = -35;
    skyRoot.add(moon);

    // Three slow cloud sheets: cheap, layered, and they hide stars behind them
    // because they are real transparent geometry inside the star sphere.
    const cloudGroup = new THREE.Group();
    cloudGroup.name = 'clouds';
    skyRoot.add(cloudGroup);
    this.cloudGroup = cloudGroup;      const sheets: Array<[number, number, string, number]> = [
      [72, 300, '#b9c4de', 0.2],
      [104, 340, '#cdd6ea', 0.14],
      [136, 380, '#aab6d4', 0.09],
    ];
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      if (!sheet) continue;
      const cloudTexture = this.texture(makeCloudTexture(11 + i * 17));
      cloudTexture.repeat.set(2.2 + i * 0.4, 2.2 + i * 0.4);
      const cloudMat = new THREE.MeshBasicMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: sheet[3],
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      });
      this.materials.push(cloudMat);
      const cloudGeo = new THREE.PlaneGeometry(sheet[1], sheet[1]);
      this.geometries.push(cloudGeo);
      const plane = new THREE.Mesh(cloudGeo, cloudMat);
      plane.rotation.x = -Math.PI / 2;
      plane.rotation.z = i * 0.9;
      plane.position.set(i % 2 === 0 ? 40 : -60, sheet[0], i % 2 === 0 ? -50 : 70);
      plane.renderOrder = -30;
      plane.userData.spin = 0.006 + i * 0.004;
      cloudGroup.add(plane);
    }
    this.animations.push((_time, dt) => {
      if (!this.cloudGroup) return;
      for (const child of this.cloudGroup.children) {
        const spin = typeof child.userData.spin === 'number' ? child.userData.spin : 0.005;
        child.rotation.z += spin * dt;
      }
    });
  }

  /** Keeps the sky dome, stars and moon centred on the active camera. */
  followCamera(position: THREE.Vector3): void {
    if (!this.skyRoot) return;
    this.skyRoot.position.set(position.x, 0, position.z);
  }

  addSkyline(radius = 62, count = 54, baseY = -2, heightRange: [number, number] = [12, 34]): void {
    const windowTexture = this.texture(makeWindowTexture());
    const material = this.material('#14161c', { map: windowTexture, roughness: 0.9, emissive: '#1c1c22', emissiveIntensity: 0.3 });
    const geometry = this.boxGeo;
    const instanced = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const rnd = seeded(555);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.06;
      const r = radius + rnd() * 26;
      const height = heightRange[0] + rnd() * (heightRange[1] - heightRange[0]);
      const width = 5 + rnd() * 7;
      dummy.position.set(Math.cos(a) * r, baseY + height / 2, Math.sin(a) * r);
      dummy.rotation.set(0, -a + Math.PI / 2, 0);
      dummy.scale.set(width, height, 4 + rnd() * 6);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.frustumCulled = false;
    this.group.add(instanced);
  }

  addLights(options: {
    hemiSky?: string;
    hemiGround?: string;
    hemiIntensity?: number;
    moonColor?: string;
    moonIntensity?: number;
    moonPosition?: [number, number, number];
    shadows?: boolean;
    rimColor?: string;
    rimIntensity?: number;
    rimPosition?: [number, number, number];
  }): void {
    const hemi = new THREE.HemisphereLight(
      options.hemiSky ?? '#8899bb',
      options.hemiGround ?? '#332b22',
      options.hemiIntensity ?? 1.15,
    );
    this.group.add(hemi);
    const ambient = new THREE.AmbientLight(options.moonColor ?? '#cfd8ff', 0.22);
    this.group.add(ambient);

    const moon = new THREE.DirectionalLight(options.moonColor ?? '#cfd8ff', options.moonIntensity ?? 2.2);
    moon.position.set(...(options.moonPosition ?? [12, 24, 8]));
    if (options.shadows && this.quality === 'high') {
      moon.castShadow = true;
      moon.shadow.mapSize.set(2048, 2048);
      moon.shadow.camera.left = -26;
      moon.shadow.camera.right = 26;
      moon.shadow.camera.top = 26;
      moon.shadow.camera.bottom = -26;
      moon.shadow.camera.near = 1;
      moon.shadow.camera.far = 70;
      moon.shadow.bias = -0.0006;
      moon.shadow.normalBias = 0.03;
    }
    this.group.add(moon);

    if (options.rimColor) {
      const rim = new THREE.DirectionalLight(options.rimColor, options.rimIntensity ?? 0.85);
      rim.position.set(...(options.rimPosition ?? [-14, 10, -16]));
      this.group.add(rim);
    }
  }

  private ensureGlowTexture(): THREE.CanvasTexture {
    if (!this.glowTexture) {
      this.glowTexture = canvasTexture(128, 128, (ctx) => {
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
        gradient.addColorStop(0.32, 'rgba(255,255,255,0.36)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
      });
      this.textures.push(this.glowTexture);
    }
    return this.glowTexture;
  }

  /** Soft additive halo, the cheap way to fake bloom without a post pass. */
  addGlow(pos: [number, number, number], color: string, size = 2.4, opacity = 0.5): THREE.Sprite {
    const glowTexture = this.ensureGlowTexture();
    const material = new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    this.materials.push(material);
    const sprite = new THREE.Sprite(material);
    sprite.position.set(...pos);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 3;
    this.group.add(sprite);
    return sprite;
  }

  /** Fake volumetric shaft under a lamp or a stage light. */
  addLightCone(
    pos: [number, number, number],
    color: string,
    height = 6,
    radius = 1.8,
    opacity = 0.075,
  ): THREE.Mesh {
    const geometry = new THREE.ConeGeometry(radius, height, 16, 1, true);
    this.geometries.push(geometry);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    this.materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pos[0], pos[1] + height / 2, pos[2]);
    mesh.renderOrder = 2;
    this.group.add(mesh);
    return mesh;
  }

  /** Wet, neon-tinted reflection patch on the ground. */
  addPuddle(x: number, z: number, radiusX: number, radiusZ: number, color: string, opacity = 0.3): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(1, 22);
    this.geometries.push(geometry);
    const material = new THREE.MeshBasicMaterial({
      color,
      map: this.ensureGlowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(radiusX, radiusZ, 1);
    mesh.position.set(x, 0.025, z);
    this.group.add(mesh);
    return mesh;
  }

  addTree(pos: [number, number, number], height = 4.2, tone = '#1f3b26'): void {
    const trunk = this.material('#3a2c22', { roughness: 1 });
    const dark = this.material(tone, { roughness: 1 });
    const light = this.material('#37683f', { roughness: 1 });
    this.cylinder({
      pos: [pos[0], pos[1] + height * 0.34, pos[2]],
      radiusTop: 0.12,
      radiusBottom: 0.2,
      height: height * 0.68,
      material: trunk,
    });
    this.sphere([pos[0], pos[1] + height * 0.78, pos[2]], [height * 0.42, height * 0.42, height * 0.42], dark);
    this.sphere([pos[0] + 0.35, pos[1] + height * 0.94, pos[2] - 0.2], [height * 0.26, height * 0.26, height * 0.26], light);
    this.sphere([pos[0] - 0.32, pos[1] + height * 0.66, pos[2] + 0.28], [height * 0.22, height * 0.2, height * 0.22], light);
    this.physics.addStaticBox(
      { x: pos[0], y: pos[1] + height * 0.34, z: pos[2] },
      { x: 0.32, y: height * 0.34, z: 0.32 },
    );
  }

  addUmbrella(pos: [number, number, number], color = '#c8452e'): void {
    const metal = this.material('#23252a', { roughness: 0.5, metalness: 0.5 });
    this.cylinder({ pos: [pos[0], pos[1] + 1.15, pos[2]], radiusTop: 0.05, radiusBottom: 0.05, height: 2.3, material: metal });
    const canopy = new THREE.ConeGeometry(1.55, 0.42, 8);
    this.geometries.push(canopy);
    const mesh = new THREE.Mesh(canopy, this.material(color, { roughness: 0.9 }));
    mesh.position.set(pos[0], pos[1] + 2.3, pos[2]);
    mesh.castShadow = true;
    this.group.add(mesh);
    this.addGlow([pos[0], pos[1] + 1.9, pos[2]], '#ffd28a', 2.4, 0.16);
  }

  addAwning(pos: [number, number, number], width: number, depth: number, color: string, rotY = 0): void {
    const material = this.material(color, { roughness: 0.85 });
    this.box({ pos, size: [width, 0.12, depth], material, rotY, cast: true });
    const stripe = this.material('#f0e6d2', { roughness: 0.9 });
    const count = Math.max(3, Math.round(width / 0.8));
    for (let i = 0; i < count; i += 2) {
      const offset = -width / 2 + (i + 0.5) * (width / count);
      const ox = Math.cos(rotY) * offset;
      const oz = -Math.sin(rotY) * offset;
      this.box({ pos: [pos[0] + ox, pos[1] + 0.02, pos[2] + oz], size: [width / count, 0.13, depth - 0.06], material: stripe, rotY });
    }
  }

  /** Double row of bulbs sagging between two points. One draw call. */
  addStringLights(
    from: [number, number, number],
    to: [number, number, number],
    color = '#ffe6a8',
    count = 16,
    sag = 0.85,
  ): void {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      positions[i * 3] = from[0] + (to[0] - from[0]) * t;
      positions[i * 3 + 1] = from[1] + (to[1] - from[1]) * t - Math.sin(Math.PI * t) * sag;
      positions[i * 3 + 2] = from[2] + (to[2] - from[2]) * t;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometries.push(geometry);
    const material = new THREE.PointsMaterial({
      color,
      map: this.ensureGlowTexture(),
      size: 0.42,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.materials.push(material);
    const bulbs = new THREE.Points(geometry, material);
    bulbs.frustumCulled = false;
    this.group.add(bulbs);
    const mid: [number, number, number] = [
      (from[0] + to[0]) / 2,
      (from[1] + to[1]) / 2 - sag,
      (from[2] + to[2]) / 2,
    ];
    this.addGlow(mid, color, Math.max(3, count * 0.28), 0.28);
  }

  tick(dt: number): void {
    this.time += dt;
    for (const animation of this.animations) animation(this.time, dt);
  }

  addPointLight(pos: [number, number, number], color: string, intensity: number, distance = 16): THREE.PointLight {
    const light = new THREE.PointLight(color, intensity, distance, 1.8);
    light.position.set(...pos);
    if (this.quality !== 'low') this.group.add(light);
    return light;
  }

  addLamp(pos: [number, number, number], color = '#ffd88a', intensity = 1.4, height = 5.4, cone = true): void {
    const metal = this.material('#22242a', { roughness: 0.5, metalness: 0.5 });
    this.cylinder({ pos: [pos[0], height / 2, pos[2]], radiusTop: 0.08, radiusBottom: 0.13, height, material: metal, collider: true });
    this.box({ pos: [pos[0], height, pos[2]], size: [0.55, 0.16, 0.55], color: '#2c2d33' });
    this.box({
      pos: [pos[0], height - 0.18, pos[2]],
      size: [0.4, 0.12, 0.4],
      material: this.material('#fff0b8', { basic: true }),
    });
    this.addPointLight([pos[0], height - 0.2, pos[2]], color, intensity, 18);
    this.addGlow([pos[0], height - 0.22, pos[2]], color, 2.2, 0.38);
    if (cone) this.addLightCone([pos[0], 0.1, pos[2]], color, height - 0.4, 1.55, 0.045);
  }

  addBench(pos: [number, number, number], rotY = 0): void {
    const wood = this.material('#4a3a2a', { roughness: 0.9 });
    const metal = this.material('#1d1f22', { roughness: 0.5, metalness: 0.6 });
    this.box({ pos: [pos[0], pos[1] + 0.45, pos[2]], size: [2.2, 0.12, 0.62], material: wood, rotY, collider: true });
    this.box({ pos: [pos[0], pos[1] + 0.72, pos[2] - 0.28], size: [2.2, 0.5, 0.09], material: wood, rotY, rotX: -0.12 });
    for (const side of [-0.85, 0.85]) {
      const ox = Math.cos(rotY) * side;
      const oz = -Math.sin(rotY) * side;
      this.box({
        pos: [pos[0] + ox, pos[1] + 0.22, pos[2] + oz],
        size: [0.1, 0.44, 0.5],
        material: metal,
        rotY,
      });
    }
  }

  addPlanter(pos: [number, number, number], size = 1.8): void {
    const stone = this.material('#3b3a3b', { roughness: 0.95 });
    const leaves = this.material('#1e3a25', { roughness: 1 });
    const leavesLight = this.material('#2b5132', { roughness: 1 });
    this.box({
      pos: [pos[0], pos[1] + 0.32, pos[2]],
      size: [size, 0.64, size],
      material: stone,
      collider: true,
    });
    this.sphere([pos[0], pos[1] + 0.88, pos[2]], [size * 0.56, 0.64, size * 0.56], leaves);
    this.sphere([pos[0] + 0.28, pos[1] + 1.12, pos[2] - 0.2], [size * 0.32, 0.42, size * 0.32], leavesLight);
  }

  addBin(pos: [number, number, number]): void {
    this.cylinder({
      pos: [pos[0], pos[1] + 0.45, pos[2]],
      radiusTop: 0.3,
      radiusBottom: 0.34,
      height: 0.9,
      color: '#2c3a33',
      collider: true,
    });
    this.box({ pos: [pos[0], pos[1] + 0.94, pos[2]], size: [0.7, 0.08, 0.7], color: '#1c2622' });
  }

  addFence(from: [number, number], to: [number, number], height = 1.2): void {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const cx = (from[0] + to[0]) / 2;
    const cz = (from[1] + to[1]) / 2;
    const metal = this.material('#22252b', { roughness: 0.55, metalness: 0.6 });
    for (const offset of [-height / 2 + 0.15, height / 2 - 0.15]) {
      this.box({
        pos: [cx, offset + 0.6, cz],
        size: [0.06, 0.06, length],
        material: metal,
        rotY: angle,
      });
    }
    const posts = Math.max(2, Math.round(length / 2.4));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      this.box({
        pos: [from[0] + dx * t, height / 2, from[1] + dz * t],
        size: [0.07, height, 0.07],
        material: metal,
      });
    }
    this.physics.addStaticBox({ x: cx, y: height / 2, z: cz }, { x: Math.abs(dx) / 2 + 0.15, y: height / 2, z: Math.abs(dz) / 2 + 0.15 });
  }

  addHedge(from: [number, number], to: [number, number], height = 1.1): void {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const cx = (from[0] + to[0]) / 2;
    const cz = (from[1] + to[1]) / 2;
    const hedge = this.material('#1d3524', { roughness: 1 });
    this.box({
      pos: [cx, height / 2, cz],
      size: [0.85, height, length],
      material: hedge,
      rotY: angle,
      collider: true,
      cast: true,
    });
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
      }
    });
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    this.materialCache.clear();
  }
}
