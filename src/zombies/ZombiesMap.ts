import * as THREE from 'three';
import type { Physics } from '../core/Physics';
import type { Quality } from '../systems/SettingsManager';
import {
  LevelBuilder,
  makeCobbleTexture,
  makeWindowTexture,
} from '../world/Environment';
import { WEAPONS, type WeaponId } from './Weapons';

type Collider = ReturnType<Physics['addStaticBox']>;

export type ZombieSectorId = 'atrio' | 'via' | 'cortile' | 'metro' | 'piazza';
export type ZombiePerkId = 'resistenza' | 'ricarica' | 'mobilita';

export interface ZombieSector {
  id: ZombieSectorId;
  name: string;
  subtitle: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const ZOMBIE_SECTORS: ZombieSector[] = [
  { id: 'atrio', name: 'BOTTEGA', subtitle: 'ATRIO · VIA PADOVA', minX: -14, maxX: 14, minZ: 46, maxZ: 74 },
  { id: 'via', name: 'VIA COMMERCIALE', subtitle: 'CORSO BUENOS AIRES', minX: -20, maxX: 20, minZ: 8, maxZ: 46 },
  { id: 'cortile', name: 'CORTILE', subtitle: 'CORTILE DI VIA PADOVA', minX: -62, maxX: -20, minZ: 8, maxZ: 46 },
  { id: 'metro', name: 'ACCESSO METRO', subtitle: 'METRO · LINEA GIALLA', minX: 20, maxX: 62, minZ: 8, maxZ: 44 },
  { id: 'piazza', name: 'PIAZZA', subtitle: 'PIAZZA DEL DUOMO', minX: -38, maxX: 38, minZ: -46, maxZ: 8 },
];

export interface ZombieDoor {
  id: string;
  label: string;
  price: number;
  sector: ZombieSectorId;
  /** Sectors joined once the shutter is bought open. */
  connects: [ZombieSectorId, ZombieSectorId];
  axis: 'x' | 'z';
  center: THREE.Vector3;
  width: number;
  open: boolean;
  openTime: number;
  group: THREE.Group;
  collider: Collider | null;
}

export interface ZombieWindow {
  id: string;
  sector: ZombieSectorId;
  axis: 'x' | 'z';
  center: THREE.Vector3;
  inside: THREE.Vector3;
  outside: THREE.Vector3;
  health: number;
  maxHealth: number;
  broken: boolean;
  group: THREE.Group;
  planks: THREE.Mesh[];
  collider: Collider | null;
}

export type ZombieInteractKind = 'door' | 'wallbuy' | 'ammo' | 'power' | 'perk' | 'bench' | 'extract';

export interface ZombieInteractable {
  id: string;
  kind: ZombieInteractKind;
  label: string;
  sub: string;
  price: number;
  x: number;
  z: number;
  radius: number;
  weapon?: WeaponId;
  perk?: ZombiePerkId;
  doorId?: string;
}

export interface ZombiesMapBuild {
  group: THREE.Group;
  builder: LevelBuilder;
  playerStart: THREE.Vector3;
  startYaw: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  sectors: ZombieSector[];
  doors: ZombieDoor[];
  windows: ZombieWindow[];
  interactables: ZombieInteractable[];
  extraction: { x: number; z: number; radius: number; group: THREE.Group };
  previewPosition: THREE.Vector3;
  previewLookAt: THREE.Vector3;
  tick(dt: number): void;
  followCamera(position: THREE.Vector3): void;
  openDoor(id: string): boolean;
  damageWindow(id: string, amount: number): boolean;
  repairWindow(id: string): boolean;
  reachableSectors(openDoors: ReadonlySet<string>): Set<ZombieSectorId>;
  sectorAt(x: number, z: number): ZombieSectorId | null;
  dispose(): void;
}

interface Gap {
  center: number;
  width: number;
  height: number;
}

const PLATE = 5.2;

function makeSign(
  builder: LevelBuilder,
  text: string,
  pos: [number, number, number],
  size: [number, number],
  rotY: number,
  bg: string,
  fg: string,
  accent: string,
  sub = '',
): void {
  builder.sign(text, { pos, size, rotY, bg, fg, accent, sub });
}

function addCar(builder: LevelBuilder, x: number, z: number, rotY: number, color: string): void {
  const body = builder.material(color, { roughness: 0.45, metalness: 0.35 });
  const glass = builder.material('#0e1a22', { roughness: 0.2, metalness: 0.5 });
  const rubber = builder.material('#121214', { roughness: 0.95 });
  builder.box({ pos: [x, 0.55, z], size: [1.85, 0.55, 4.2], material: body, rotY, collider: true, cast: true });
  builder.box({ pos: [x, 0.98, z - 0.15], size: [1.65, 0.5, 2.1], material: glass, rotY });
  for (const side of [-0.82, 0.82]) {
    for (const along of [-1.3, 1.3]) {
      const ox = Math.cos(rotY) * side + Math.sin(rotY) * along;
      const oz = -Math.sin(rotY) * side + Math.cos(rotY) * along;
      builder.cylinder({
        pos: [x + ox, 0.34, z + oz],
        radiusTop: 0.33,
        radiusBottom: 0.33,
        height: 0.22,
        material: rubber,
        rotZ: Math.PI / 2,
        rotY,
        segments: 10,
      });
    }
  }
  builder.box({ pos: [x, 0.62, z + 2.12], size: [1.5, 0.18, 0.1], material: builder.material('#ff2a2a', { basic: true }) });
}

function addMarketStall(builder: LevelBuilder, x: number, z: number, color: string): void {
  const wood = builder.material('#4b3a2b', { roughness: 0.9 });
  const cloth = builder.material(color, { roughness: 0.95 });
  builder.box({ pos: [x, 0.9, z], size: [3.2, 0.14, 1.5], material: wood, collider: true });
  for (const dx of [-1.45, 1.45]) {
    for (const dz of [-0.6, 0.6]) {
      builder.box({ pos: [x + dx, 0.45, z + dz], size: [0.1, 0.9, 0.1], material: wood });
    }
  }
  builder.box({ pos: [x, 2.15, z], size: [3.5, 0.1, 1.8], material: cloth, rotX: -0.08, cast: true });
  builder.box({ pos: [x, 1.7, z + 0.7], size: [3.1, 0.5, 0.08], material: cloth });
  builder.addGlow([x, 1.5, z], '#ffcf7a', 2.4, 0.2);
}

export function buildZombiesMap(physics: Physics, quality: Quality): ZombiesMapBuild {
  const builder = new LevelBuilder(physics, quality);
  const sectors = ZOMBIE_SECTORS;
  const doors: ZombieDoor[] = [];
  const windows: ZombieWindow[] = [];
  const interactables: ZombieInteractable[] = [];

  builder.addSky('#03040b', '#2a2233');
  builder.addStars(720, 185);
  builder.addSkyline(128, 96, -6, [18, 64]);
  builder.ground(190, 190, makeCobbleTexture(), 0, 10);
  builder.addLights({
    hemiSky: '#4c5c88',
    hemiGround: '#241b18',
    hemiIntensity: 1.05,
    moonColor: '#b6c6ee',
    moonIntensity: 2.45,
    moonPosition: [90, 170, 120],
    shadows: true,
    rimColor: '#ff8a4a',
    rimIntensity: 0.5,
    rimPosition: [-60, 22, 40],
  });
  builder.boundary(-94, 94, -74, 94, 3.2);

  const plaster = builder.material('#3d3a36', { roughness: 0.95 });
  const trim = builder.material('#575047', { roughness: 0.88 });
  const metal = builder.material('#23262b', { roughness: 0.48, metalness: 0.65 });
  const wood = builder.material('#4a392a', { roughness: 0.92 });
  const shutterMat = builder.material('#3d4247', { roughness: 0.42, metalness: 0.72 });
  const plankMat = builder.material('#5a4029', { roughness: 0.95 });
  const neonYellow = builder.material('#ffd400', { basic: true });

  // ── Walls ─────────────────────────────────────────────────────────────
  const wallX = (x: number, z1: number, z2: number, gaps: Gap[], mat = plaster): void => {
    const sorted = [...gaps].sort((a, b) => a.center - b.center);
    let cursor = Math.min(z1, z2);
    const end = Math.max(z1, z2);
    for (const gap of sorted) {
      const start = gap.center - gap.width / 2;
      if (start > cursor) {
        builder.box({
          pos: [x, PLATE / 2, (cursor + start) / 2],
          size: [0.55, PLATE, start - cursor],
          material: mat,
          collider: true,
          cast: true,
        });
      }
      builder.box({
        pos: [x, gap.height + (PLATE - gap.height) / 2, gap.center],
        size: [0.55, PLATE - gap.height, gap.width],
        material: mat,
      });
      cursor = gap.center + gap.width / 2;
    }
    if (cursor < end) {
      builder.box({
        pos: [x, PLATE / 2, (cursor + end) / 2],
        size: [0.55, PLATE, end - cursor],
        material: mat,
        collider: true,
        cast: true,
      });
    }
  };

  const wallZ = (z: number, x1: number, x2: number, gaps: Gap[], mat = plaster): void => {
    const sorted = [...gaps].sort((a, b) => a.center - b.center);
    let cursor = Math.min(x1, x2);
    const end = Math.max(x1, x2);
    for (const gap of sorted) {
      const start = gap.center - gap.width / 2;
      if (start > cursor) {
        builder.box({
          pos: [(cursor + start) / 2, PLATE / 2, z],
          size: [start - cursor, PLATE, 0.55],
          material: mat,
          collider: true,
          cast: true,
        });
      }
      builder.box({
        pos: [gap.center, gap.height + (PLATE - gap.height) / 2, z],
        size: [gap.width, PLATE - gap.height, 0.55],
        material: mat,
      });
      cursor = gap.center + gap.width / 2;
    }
    if (cursor < end) {
      builder.box({
        pos: [(cursor + end) / 2, PLATE / 2, z],
        size: [end - cursor, PLATE, 0.55],
        material: mat,
        collider: true,
        cast: true,
      });
    }
  };

  // ── Doors ─────────────────────────────────────────────────────────────
  const addDoor = (
    id: string,
    label: string,
    price: number,
    x: number,
    z: number,
    axis: 'x' | 'z',
    connects: [ZombieSectorId, ZombieSectorId],
    sector: ZombieSectorId,
  ): void => {
    const width = 3.4;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    builder.group.add(group);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    builder.geometries.push(geo);
    const shutter = new THREE.Mesh(geo, shutterMat);
    shutter.scale.set(axis === 'x' ? width : 0.32, 3.25, axis === 'x' ? 0.32 : width);
    shutter.position.y = 1.7;
    shutter.castShadow = true;
    group.add(shutter);
    for (let i = 0; i < 7; i++) {
      const slat = new THREE.Mesh(geo, metal);
      slat.scale.set(axis === 'x' ? width - 0.12 : 0.34, 0.035, axis === 'x' ? 0.34 : width - 0.12);
      slat.position.y = 0.45 + i * 0.42;
      group.add(slat);
    }
    const collider = physics.addStaticBox(
      { x, y: 1.7, z },
      axis === 'x' ? { x: width / 2, y: 1.62, z: 0.3 } : { x: 0.3, y: 1.62, z: width / 2 },
    );
    const rotY = axis === 'x' ? 0 : Math.PI / 2;
    makeSign(builder, label, [x, 3.9, z + (axis === 'x' ? 0.5 : 0)], [3.4, 0.9], rotY, '#101218', '#ffd400', '#ff2f2f', `${price} PUNTI`);
    doors.push({
      id,
      label,
      price,
      sector,
      connects,
      axis,
      center: new THREE.Vector3(x, 0, z),
      width,
      open: false,
      openTime: 0,
      group,
      collider,
    });
    interactables.push({
      id: `door-${id}`,
      kind: 'door',
      label: `APRI ${label}`,
      sub: `${price} PUNTI · NUOVA ZONA`,
      price,
      x,
      z: z + (axis === 'x' ? 2.2 : 0),
      radius: 3.1,
      doorId: id,
    });
  };

  // ── Windows + barricades ──────────────────────────────────────────────
  const addWindow = (
    id: string,
    sector: ZombieSectorId,
    x: number,
    z: number,
    axis: 'x' | 'z',
    insideDir: 1 | -1,
  ): void => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    builder.group.add(group);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    builder.geometries.push(geo);
    const planks: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const plank = new THREE.Mesh(geo, plankMat);
      plank.scale.set(axis === 'x' ? 2.8 : 0.12, 0.26, axis === 'x' ? 0.12 : 2.8);
      plank.position.set(0, 0.35 + i * 0.5, 0);
      plank.rotation.z = i % 2 === 0 ? 0.045 : -0.035;
      plank.castShadow = true;
      group.add(plank);
      planks.push(plank);
    }
    const nailMat = builder.material('#a8a49a', { roughness: 0.35, metalness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const nail = new THREE.Mesh(geo, nailMat);
      nail.scale.set(0.05, 0.05, 0.05);
      nail.position.set(axis === 'x' ? -1.1 + i * 0.72 : 0.06, 0.5 + (i % 2) * 1.2, axis === 'x' ? 0.06 : -1.1 + i * 0.72);
      group.add(nail);
    }
    // Only the lower half of the opening is solid: the slatted barricade stops
    // feet and bodies, but shots at chest height pass between the planks.
    const center = new THREE.Vector3(x, 0.45, z);
    const collider = physics.addStaticBox(
      center,
      axis === 'x' ? { x: 1.35, y: 0.45, z: 0.2 } : { x: 0.2, y: 0.45, z: 1.35 },
    );
    const inside =
      axis === 'x'
        ? new THREE.Vector3(x, 0, z + insideDir * 1.55)
        : new THREE.Vector3(x + insideDir * 1.55, 0, z);
    const outside =
      axis === 'x'
        ? new THREE.Vector3(x, 0, z - insideDir * 2.4)
        : new THREE.Vector3(x - insideDir * 2.4, 0, z);
    windows.push({
      id,
      sector,
      axis,
      center: new THREE.Vector3(x, 0, z),
      inside,
      outside,
      health: 160,
      maxHealth: 160,
      broken: false,
      group,
      planks,
      collider,
    });
  };

  // Atrio (start shop).
  wallZ(74, -14, 14, []);
  wallZ(46, -62, 20, [
    { center: 0, width: 3.4, height: 3.3 },
    { center: -30, width: 2.8, height: 2.7 },
    { center: -48, width: 2.8, height: 2.7 },
  ]);
  wallX(-14, 46, 74, [
    { center: 56, width: 2.7, height: 2.7 },
    { center: 66, width: 2.7, height: 2.7 },
  ]);
  wallX(14, 46, 74, [
    { center: 56, width: 2.7, height: 2.7 },
    { center: 66, width: 2.7, height: 2.7 },
  ]);

  // Via / cortile / metro partitions and piazza wall.
  wallX(-20, 8, 46, [
    { center: 36, width: 3.4, height: 3.3 },
    { center: 16, width: 2.7, height: 2.7 },
    { center: 26, width: 2.7, height: 2.7 },
    { center: 44, width: 2.7, height: 2.7 },
  ]);
  wallX(20, 8, 44, [
    { center: 36, width: 3.4, height: 3.3 },
    { center: 16, width: 2.7, height: 2.7 },
    { center: 26, width: 2.7, height: 2.7 },
  ]);
  wallZ(8, -62, 62, [
    { center: 0, width: 3.4, height: 3.3 },
    { center: -34, width: 3.4, height: 3.3 },
    { center: 34, width: 3.4, height: 3.3 },
  ]);
  wallZ(44, 20, 62, [
    { center: 30, width: 2.7, height: 2.7 },
    { center: 50, width: 2.7, height: 2.7 },
  ]);
  wallX(-62, 8, 46, [
    { center: 16, width: 2.7, height: 2.7 },
    { center: 32, width: 2.7, height: 2.7 },
  ]);
  wallX(62, 8, 44, [
    { center: 16, width: 2.7, height: 2.7 },
    { center: 34, width: 2.7, height: 2.7 },
  ]);
  wallX(-38, -46, 8, [
    { center: -12, width: 2.7, height: 2.7 },
    { center: -30, width: 2.7, height: 2.7 },
  ]);
  wallX(38, -46, 8, [
    { center: -12, width: 2.7, height: 2.7 },
    { center: -30, width: 2.7, height: 2.7 },
  ]);
  wallZ(-46, -38, 38, []);

  // Door shutters.
  addDoor('d0', 'ATRIO → VIA', 500, 0, 46, 'x', ['atrio', 'via'], 'atrio');
  addDoor('d1', 'VIA → CORTILE', 750, -20, 36, 'z', ['via', 'cortile'], 'via');
  addDoor('d2', 'VIA → METRO', 750, 20, 36, 'z', ['via', 'metro'], 'via');
  addDoor('d3', 'VIA → PIAZZA', 1000, 0, 8, 'x', ['via', 'piazza'], 'via');
  addDoor('d4', 'CORTILE → PIAZZA', 750, -34, 8, 'x', ['cortile', 'piazza'], 'cortile');
  addDoor('d5', 'METRO → PIAZZA', 750, 34, 8, 'x', ['metro', 'piazza'], 'metro');

  // Barricade windows.
  addWindow('w-a1', 'atrio', -14, 56, 'z', 1);
  addWindow('w-a2', 'atrio', -14, 66, 'z', 1);
  addWindow('w-a3', 'atrio', 14, 56, 'z', -1);
  addWindow('w-a4', 'atrio', 14, 66, 'z', -1);
  addWindow('w-v1', 'via', -20, 16, 'z', 1);
  addWindow('w-v2', 'via', -20, 26, 'z', 1);
  addWindow('w-v3', 'via', -20, 44, 'z', 1);
  addWindow('w-v4', 'via', 20, 16, 'z', -1);
  addWindow('w-v5', 'via', 20, 26, 'z', -1);
  addWindow('w-c1', 'cortile', -62, 16, 'z', 1);
  addWindow('w-c2', 'cortile', -62, 32, 'z', 1);
  addWindow('w-c3', 'cortile', -30, 46, 'x', -1);
  addWindow('w-c4', 'cortile', -48, 46, 'x', -1);
  addWindow('w-m1', 'metro', 62, 16, 'z', -1);
  addWindow('w-m2', 'metro', 62, 34, 'z', -1);
  addWindow('w-m3', 'metro', 30, 44, 'x', -1);
  addWindow('w-m4', 'metro', 50, 44, 'x', -1);
  addWindow('w-p1', 'piazza', -38, -12, 'z', 1);
  addWindow('w-p2', 'piazza', -38, -30, 'z', 1);
  addWindow('w-p3', 'piazza', 38, -12, 'z', -1);
  addWindow('w-p4', 'piazza', 38, -30, 'z', -1);

  // ── City backdrop blocks ─────────────────────────────────────────────
  const cityBlock = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    tone: string,
    label: string,
  ): void => {
    const windowTexture = builder.texture(makeWindowTexture());
    windowTexture.repeat.set(Math.max(1.5, w / 4.5), Math.max(1.5, h / 4.2));
    const facadeMaterial = builder.material('#ffffff', { map: windowTexture, roughness: 0.9, flat: false });
    const baseMat = builder.material(tone, { roughness: 0.94 });
    builder.box({ pos: [cx, h / 2 + 1.2, cz], size: [w, h, d], material: facadeMaterial, collider: true, cast: true });
    builder.box({ pos: [cx, 1.2, cz], size: [w + 0.3, 2.4, d + 0.3], material: baseMat, collider: true });
    builder.box({ pos: [cx, h + 1.32, cz], size: [w + 0.5, 0.24, d + 0.5], material: trim });
    for (const side of [-1, 1]) {
      builder.box({ pos: [cx + (w / 2) * side, h + 1.6, cz], size: [0.5, 0.7, d * 0.8], material: trim });
    }
    builder.box({ pos: [cx + w * 0.22, h + 1.85, cz + d * 0.18], size: [1.4, 1.1, 1.1], material: metal });
    builder.box({ pos: [cx - w * 0.24, h + 1.75, cz - d * 0.2], size: [0.9, 0.9, 0.9], material: metal });
    makeSign(builder, label, [cx, 2.7, cz + d / 2 + 0.28], [Math.min(w * 0.75, 6), 0.9], 0, '#101216', '#f2e8cf', '#ffd400', 'MILANO');
  };

  // Outer street walls (the dense first ring of the neighbourhood).
  const blocks: Array<[number, number, number, number, number, string, string]> = [
    [-78, 20, 14, 22, 26, '#2f3330', 'CONDOMINIO'],
    [-78, 50, 14, 24, 18, '#3a302a', 'TRATTORIA'],
    [-64, 74, 20, 14, 22, '#33302c', 'PENSIONE'],
    [-30, 84, 24, 16, 30, '#2a2f35', 'HOTEL'],
    [8, 84, 26, 15, 24, '#35322c', 'GARAGE'],
    [44, 80, 22, 16, 34, '#272c33', 'UFFICI'],
    [76, 56, 16, 26, 20, '#322e2a', 'MERCATO'],
    [78, 22, 16, 24, 28, '#282c30', 'BANCA'],
    [76, -8, 18, 20, 36, '#242a32', 'GRATTACIELO'],
    [70, -36, 22, 18, 26, '#312c2c', 'ALBERGO'],
    [42, -58, 24, 16, 32, '#272b31', 'TEATRO'],
    [2, -64, 26, 14, 22, '#332f2b', 'CATTEDRALE'],
    [-38, -62, 22, 16, 30, '#2b3036', 'TRIBUNALE'],
    [-72, -42, 20, 20, 24, '#302c2b', 'MAGAZZINI'],
    [-80, -8, 16, 22, 34, '#262b32', 'TORRE'],
    [-80, 76, 18, 14, 16, '#3a332b', 'OSTERIA'],
    [60, 72, 20, 14, 18, '#34302c', 'TABACCHI'],
  ];
  for (const block of blocks) cityBlock(...block);

  // ── Atrio / bottega ──────────────────────────────────────────────────
  // Open-roof bottega: no ceiling, so the third-person camera never ends up
  // above it. Pendant lights and wall strips still sell the interior.
  for (let i = -3; i <= 3; i++) {
    builder.cylinder({ pos: [i * 4, 2.9, 60], radiusTop: 0.02, radiusBottom: 0.02, height: 0.9, color: '#1e1e22' });
    builder.box({ pos: [i * 4, 2.9, 60], size: [0.55, 0.16, 0.55], material: builder.material('#fff0c0', { basic: true }) });
    builder.addGlow([i * 4, 2.78, 60], '#ffe0a0', 2.1, 0.3);
  }
  for (const x of [-13.4, 13.4]) {
    builder.box({ pos: [x, 2.62, 60], size: [0.14, 0.12, 24], material: builder.material('#ffd48a', { basic: true }) });
    builder.addGlow([x, 2.6, 60], '#ffcf7a', 2.6, 0.16);
  }
  builder.box({ pos: [0, 0.95, 50], size: [9, 1.1, 1.1], material: wood, collider: true });
  builder.box({ pos: [0, 1.58, 50], size: [9.2, 0.12, 1.3], material: trim });
  for (let i = -3; i <= 3; i++) {
    builder.box({ pos: [i * 1.3, 1.15, 50], size: [0.5, 0.5, 0.5], material: builder.material(i % 2 === 0 ? '#b8442a' : '#d8b24a', { roughness: 0.85 }) });
  }
  builder.box({ pos: [-9, 1.1, 56], size: [1.4, 2.2, 3.4], material: wood, collider: true });
  builder.box({ pos: [9, 1.1, 56], size: [1.4, 2.2, 3.4], material: wood, collider: true });
  for (const x of [-11.5, 11.5]) {
    builder.box({ pos: [x, 1.2, 69], size: [2.2, 2.4, 4.4], material: metal, collider: true });
    builder.box({ pos: [x, 2.45, 69], size: [2.4, 0.1, 4.6], material: trim });
  }
  makeSign(builder, 'BOTTEGA', [0, 2.45, 47.2], [5.4, 1.2], 0, '#141218', '#ffd400', '#ff3d8a', 'APERTO FINO ALLE 6');
  makeSign(builder, 'NON APRITE', [-14, 2.1, 61], [3.2, 0.85], Math.PI / 2, '#161016', '#ff6a5a', '#ffd400', 'ZONA CONTAMINATA');
  builder.addPointLight([0, 2.7, 58], '#ffd9a0', 1.6, 18);
  builder.addLamp([-10, 0, 70], '#ffd88a', 1.2, 4.6);
  builder.addLamp([10, 0, 70], '#ffd88a', 1.2, 4.6);
  addMarketStall(builder, 6.5, 64, '#8a2a2a');
  builder.addPuddle(-3, 70, 2.4, 1.6, '#4a6a72', 0.2);
  addCar(builder, 17.5, 58, Math.PI / 2, '#223244');

  // ── Via commerciale ──────────────────────────────────────────────────
  builder.box({ pos: [-15, 2.55, 26], size: [3.6, 0.14, 14], material: builder.material('#7a2626', { roughness: 0.9 }), cast: true });
  for (const z of [18, 26, 34]) {
    builder.addLamp([-17.5, 0, z], '#ffd88a', 1.5, 5.6);
    builder.addLamp([17.5, 0, z], '#ffd88a', 1.5, 5.6);
  }
  for (const z of [20, 30, 40]) {
    builder.addBench([0, 0, z], Math.PI / 2);
    builder.addBin([1.5, 0, z]);
  }
  for (const z of [12, 22, 32]) builder.addPlanter([-14, 0, z], 1.4);
  makeSign(builder, 'VIA PADOVA', [0, 4.1, 28], [6.4, 1.3], Math.PI / 2, '#0f1218', '#f2ead4', '#ffd400', 'CORSO BUENOS AIRES');
  makeSign(builder, 'POLLERIA', [-19.4, 3.4, 12], [4.4, 1.05], Math.PI / 2, '#1a0f12', '#ffd400', '#ff3d8a', 'APERTO');
  makeSign(builder, 'BARBIERE', [19.4, 3.4, 12], [4.4, 1.05], -Math.PI / 2, '#0f1418', '#4fe6ff', '#ff2f2f', 'TAGLIO 12€');
  addMarketStall(builder, -10, 36, '#2a4a6a');
  addMarketStall(builder, 11, 20, '#6a4a2a');
  addCar(builder, -8, 12, 0, '#3a2a2a');
  addCar(builder, 8, 40, Math.PI, '#2a3a2a');
  builder.addPuddle(0, 24, 4.5, 2.4, '#3a5a72', 0.22);
  builder.addPuddle(4, 14, 2.4, 1.6, '#5a3a62', 0.16);
  builder.addStringLights([-19, 4.6, 14], [-19, 4.6, 30], '#ffdf9a', 18, 0.6);
  builder.addStringLights([19, 4.6, 14], [19, 4.6, 34], '#ff7ab0', 20, 0.7);

  // ── Cortile ───────────────────────────────────────────────────────────
  builder.cylinder({ pos: [-41, 0.35, 28], radiusTop: 3.1, radiusBottom: 3.4, height: 0.7, color: '#4a4640', collider: true, segments: 18 });
  builder.cylinder({ pos: [-41, 0.7, 28], radiusTop: 2.7, radiusBottom: 2.7, height: 0.16, material: builder.material('#1d3a44', { roughness: 0.15, metalness: 0.4 }), segments: 18 });
  builder.cylinder({ pos: [-41, 1.9, 28], radiusTop: 0.32, radiusBottom: 0.5, height: 2.5, color: '#595349', collider: true });
  builder.addGlow([-41, 1.2, 28], '#6ab8d8', 3, 0.18);
  for (const [x, z] of [
    [-56, 14],
    [-56, 40],
    [-30, 14],
    [-30, 40],
  ] as const) {
    builder.addTree([x, 0, z], 5.2);
    builder.addBench([x + 2.2, 0, z], x < -41 ? Math.PI / 2 : -Math.PI / 2);
  }
  for (const z of [12, 22, 32, 42]) builder.addPlanter([-24.5, 0, z], 1.5);
  builder.addStringLights([-58, 4.2, 12], [-24, 4.2, 12], '#ffcf7a', 26, 0.9);
  builder.addStringLights([-58, 4.2, 42], [-24, 4.2, 42], '#ff9ad0', 26, 0.9);
  addMarketStall(builder, -50, 30, '#4a3a6a');
  makeSign(builder, 'CORTILE', [-41, 3.5, 9.4], [5.2, 1.1], 0, '#101418', '#ffd400', '#4fe6ff', 'CONDOMINIO 4');
  builder.addPuddle(-46, 20, 3.6, 2.2, '#3a5a62', 0.2);

  // ── Metro access ──────────────────────────────────────────────────────
  builder.box({ pos: [41, 3.9, 26], size: [40, 0.32, 32], material: builder.material('#202328', { roughness: 0.6, metalness: 0.3 }), cast: true });
  for (const x of [26, 34, 42, 50, 58]) {
    for (const z of [12, 22, 32, 40]) {
      builder.cylinder({ pos: [x, 2.1, z], radiusTop: 0.26, radiusBottom: 0.3, height: 4.2, color: '#565c60', collider: false, segments: 8 });
    }
  }
  for (const z of [16, 28, 36]) builder.addLamp([41, 0, z], '#bff4ff', 1.2, 3.8);
  builder.box({ pos: [41, 0.9, 36], size: [26, 0.14, 2.2], material: builder.material('#2a2d32', { roughness: 0.5, metalness: 0.4 }) });
  for (const x of [30, 34, 38, 42, 46, 50]) {
    builder.box({ pos: [x, 1.15, 36], size: [0.18, 0.9, 1.2], material: metal });
  }
  // Decorative train along the north side.
  builder.box({ pos: [41, 1.85, 11], size: [34, 3.1, 2.8], material: builder.material('#9aa0a4', { roughness: 0.4, metalness: 0.5 }), collider: true, cast: true });
  for (let i = 0; i < 9; i++) {
    builder.box({ pos: [26 + i * 3.6, 2.3, 12.42], size: [2.4, 1.15, 0.1], material: builder.material('#ffd98a', { basic: true }) });
  }
  builder.box({ pos: [41, 3.45, 11], size: [34, 0.16, 3], material: neonYellow });
  makeSign(builder, 'METRO', [41, 3.5, 10.6], [7, 1.4], 0, '#0d1016', '#ffd400', '#4fe6ff', 'LINEA GIALLA · M3');
  makeSign(builder, 'USCITA', [23.3, 3.2, 30], [3.6, 0.9], Math.PI / 2, '#0d1416', '#f2ead4', '#ffd400');
  builder.addPuddle(38, 28, 4, 2.2, '#3a5060', 0.25);
  builder.addBin([24, 0, 22]);
  builder.addBin([58, 0, 22]);

  // ── Piazza + Duomo ────────────────────────────────────────────────────
  builder.box({ pos: [0, 7, -50], size: [60, 16, 6], material: builder.material('#5a5449', { roughness: 0.92 }), collider: true, cast: true });
  for (const x of [-22, -11, 0, 11, 22]) {
    builder.box({ pos: [x, 7, -46.8], size: [1.4, 14, 1.2], material: builder.material('#6a6154', { roughness: 0.9 }) });
    builder.box({ pos: [x, 7, -47.3], size: [1.0, 11, 0.8], material: builder.material('#2a2621', { roughness: 0.95 }) });
    builder.box({ pos: [x, 4.4, -46.1], size: [0.18, 6.4, 0.5], material: builder.material('#ffcf82', { basic: true }) });
  }
  builder.box({ pos: [0, 1.5, -43], size: [30, 3, 3], material: builder.material('#4a443c', { roughness: 0.95 }), collider: true });
  builder.box({ pos: [0, 2.0, -45.4], size: [5.6, 4, 0.8], material: builder.material('#171411', { roughness: 0.9 }) });
  builder.addGlow([0, 2.3, -44.6], '#ffcf7a', 4.2, 0.4);
  builder.addPointLight([0, 4, -40], '#ffc98a', 2.2, 30);
  makeSign(builder, 'DUOMO', [0, 9.5, -45.9], [9, 2.2], 0, '#0c0c12', '#ffd400', '#ff3d8a', 'PIAZZA DEL DUOMO');
  builder.addLamp([-26, 0, -10], '#ffd88a', 1.6, 6);
  builder.addLamp([26, 0, -10], '#ffd88a', 1.6, 6);
  builder.addLamp([-26, 0, -32], '#ffd88a', 1.6, 6);
  builder.addLamp([26, 0, -32], '#ffd88a', 1.6, 6);
  for (const [x, z] of [
    [-14, -26],
    [14, -26],
    [-14, -6],
    [14, -6],
  ] as const) {
    builder.addPlanter([x, 0, z], 1.8);
  }
  for (const [x, z] of [
    [-30, -20],
    [30, -20],
    [0, -22],
  ] as const) {
    builder.addBench([x, 0, z], x < 0 ? 0.4 : -0.4);
  }
  builder.addPuddle(-4, -30, 6, 3, '#3a5060', 0.24);
  builder.addPuddle(8, -14, 4, 2.4, '#5a4a6a', 0.18);
  addCar(builder, -32, 2, Math.PI / 2, '#25303a');
  addCar(builder, 32, 2, -Math.PI / 2, '#302525');

  // Extraction pad, disabled until round 20.
  const extractionGroup = new THREE.Group();
  extractionGroup.position.set(0, 0, -36);
  builder.group.add(extractionGroup);
  const ringGeo = new THREE.TorusGeometry(3.4, 0.16, 6, 36);
  builder.geometries.push(ringGeo);
  const ringMat = builder.material('#4fe6ff', { basic: true, transparent: true, opacity: 0.75 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  extractionGroup.add(ring);
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6.5, 8);
  builder.geometries.push(poleGeo);
  const pole = new THREE.Mesh(poleGeo, builder.material('#2a2e33', { roughness: 0.4, metalness: 0.6 }));
  pole.position.set(0, 3.25, 0);
  extractionGroup.add(pole);
  builder.addGlow([0, -36, 6.6], '#4fe6ff', 4.4, 0.4);
  extractionGroup.visible = false;

  // ── Purchases ─────────────────────────────────────────────────────────
  const wallBuy = (id: string, weapon: WeaponId, x: number, z: number, rotY: number): void => {
    const spec = WEAPONS[weapon];
    const chalk = builder.material('#e8e2d0', { basic: true, transparent: true, opacity: 0.5 });
    builder.box({ pos: [x, 2.2, z], size: [2.4, 1.5, 0.05], material: chalk, rotY });
    builder.box({ pos: [x, 1.1, z], size: [2.9, 0.8, 0.6], material: builder.material('#24262a', { roughness: 0.7 }), rotY });
    builder.box({ pos: [x, 1.55, z], size: [2.2, 0.14, 0.5], material: wood, rotY });
    makeSign(builder, spec.name, [x, 3.3, z], [3.6, 0.95], rotY, '#0f1218', '#ffd400', '#ff2f2f', `${spec.price} PUNTI · ${spec.tag}`);
    interactables.push({
      id: `buy-${id}`,
      kind: 'wallbuy',
      label: `COMPRA ${spec.name}`,
      sub: `${spec.tag} · ${spec.price} PUNTI`,
      price: spec.price,
      x,
      z,
      radius: 2.7,
      weapon,
    });
    interactables.push({
      id: `ammo-${id}`,
      kind: 'ammo',
      label: `MUNIZIONI ${spec.name}`,
      sub: `${spec.ammoPrice} PUNTI · CARICATORE PIENO`,
      price: spec.ammoPrice,
      x,
      z: z + 2.4,
      radius: 2.4,
      weapon,
    });
  };
  wallBuy('pistol', 'pistol', -10, 48.2, 0);
  wallBuy('smg', 'smg', -19.2, 20, Math.PI / 2);
  wallBuy('shotgun', 'shotgun', -60.8, 36, Math.PI / 2);
  wallBuy('rifle', 'rifle', 61, 26, -Math.PI / 2);

  const powerX = 58;
  builder.box({ pos: [powerX, 1.6, 12], size: [0.35, 2.4, 2.6], material: metal, rotY: Math.PI / 2, collider: true });
  builder.box({ pos: [powerX - 0.25, 1.8, 12], size: [0.12, 1.2, 1.6], material: builder.material('#3a4a3a', { roughness: 0.5 }) });
  builder.box({ pos: [powerX - 0.34, 1.6, 12], size: [0.12, 0.35, 0.35], material: neonYellow });
  builder.addGlow([powerX - 0.6, 2.2, 12], '#ffd400', 2.4, 0.45);
  makeSign(builder, 'CORRENTE', [powerX - 0.4, 3.4, 12], [3.4, 1], -Math.PI / 2, '#0e1410', '#ffd400', '#4fe6ff', '1000 PUNTI · SBLOCCA IL BANCO');
  interactables.push({
    id: 'power',
    kind: 'power',
    label: 'ATTIVA LA CORRENTE',
    sub: '1000 PUNTI · POTENZIAMENTI E BANCO',
    price: 1000,
    x: powerX - 1.2,
    z: 12,
    radius: 2.8,
  });

  const perk = (id: ZombiePerkId, label: string, sub: string, x: number, z: number, color: string): void => {
    builder.box({ pos: [x, 1.05, z], size: [1.5, 2.1, 1.05], material: builder.material('#22252a', { roughness: 0.5, metalness: 0.3 }), collider: true, cast: true });
    builder.box({ pos: [x, 1.9, z + 0.5], size: [1.2, 0.7, 0.2], material: builder.material(color, { emissive: color, emissiveIntensity: 0.5, basic: true }) });
    builder.addGlow([x, 2.15, z + 0.4], color, 3, 0.45);
    makeSign(builder, label, [x, 2.75, z + 0.55], [2.8, 0.85], 0, '#0f1116', '#ffffff', color, sub);
    interactables.push({
      id: `perk-${id}`,
      kind: 'perk',
      label: `COMPRA ${label}`,
      sub: `2500 PUNTI · ${sub}`,
      price: 2500,
      x,
      z: z + 1.5,
      radius: 2.7,
      perk: id,
    });
  };
  perk('resistenza', 'RESISTENZA', 'PIÙ SALUTE', 8, 51, '#ff6a3a');
  perk('ricarica', 'MANI VELOCI', 'RICARICA RAPIDA', -58, 44, '#4fe6ff');
  perk('mobilita', 'PASSO LUNGO', 'CORRI E SCHIVA MEGLIO', 30, 14, '#9dff6a');

  builder.box({ pos: [24, 0.8, -30], size: [3.6, 0.2, 1.6], material: wood, collider: true });
  for (const dx of [-1.5, 1.5]) {
    builder.box({ pos: [24 + dx, 0.4, -30], size: [0.14, 0.8, 1.4], material: metal });
  }
  builder.box({ pos: [24, 1.15, -30.3], size: [1.2, 0.5, 0.5], material: builder.material('#39404a', { roughness: 0.4, metalness: 0.6 }) });
  makeSign(builder, 'BANCO', [24, 2.2, -31.1], [3.2, 0.9], 0, '#0f1116', '#ffd400', '#4fe6ff', '1500 PUNTI · +35% DANNO');
  interactables.push({
    id: 'bench',
    kind: 'bench',
    label: 'POTENZIA ARMA',
    sub: '1500 PUNTI · +35% DANNO (MAX 3)',
    price: 1500,
    x: 24,
    z: -28.4,
    radius: 2.7,
  });

  interactables.push({
    id: 'extract',
    kind: 'extract',
    label: 'CHIAMA L\'ESTRAZIONE',
    sub: 'SOPRAVVIVI 60 SECONDI',
    price: 0,
    x: 0,
    z: -35,
    radius: 3.6,
  });

  // Sector street signs for orientation.
  makeSign(builder, 'VIA PADOVA', [0, 4.4, 45.4], [5.4, 1.1], 0, '#0d1016', '#f2ead4', '#ffd400', 'MILANO · MUNICIPIO 3');
  makeSign(builder, 'PIAZZA', [0, 4.4, 8.6], [4.6, 1.1], 0, '#0d1016', '#f2ead4', '#4fe6ff', 'DUOMO A 40 M');

  const extraction = { x: 0, z: -36, radius: 3.6, group: extractionGroup };
  const bounds = { minX: -62, maxX: 62, minZ: -46, maxZ: 74 };
  let clock = 0;

  const reachableSectors = (openDoors: ReadonlySet<string>): Set<ZombieSectorId> => {
    const result = new Set<ZombieSectorId>(['atrio']);
    let changed = true;
    while (changed) {
      changed = false;
      for (const door of doors) {
        if (!openDoors.has(door.id)) continue;
        const [a, b] = door.connects;
        if (result.has(a) && !result.has(b)) {
          result.add(b);
          changed = true;
        } else if (result.has(b) && !result.has(a)) {
          result.add(a);
          changed = true;
        }
      }
    }
    return result;
  };

  const sectorAt = (x: number, z: number): ZombieSectorId | null => {
    for (const sector of sectors) {
      if (x >= sector.minX && x <= sector.maxX && z >= sector.minZ && z <= sector.maxZ) return sector.id;
    }
    return null;
  };

  return {
    group: builder.group,
    builder,
    playerStart: new THREE.Vector3(0, 0, 64),
    startYaw: 0,
    bounds,
    sectors,
    doors,
    windows,
    interactables,
    extraction,
    previewPosition: new THREE.Vector3(26, 15, 34),
    previewLookAt: new THREE.Vector3(-2, 2, 4),
    tick(dt: number): void {
      clock += dt;
      builder.tick(dt);
      for (const door of doors) {
        if (!door.open) continue;
        door.openTime = Math.min(1, door.openTime + dt * 1.4);
        door.group.position.y = door.openTime * 3.6;
        if (door.openTime >= 1) door.group.visible = false;
      }
      if (extractionGroup.visible) {
        ring.scale.setScalar(1 + Math.sin(clock * 2.4) * 0.06);
        ringMat.opacity = 0.5 + Math.sin(clock * 2.4) * 0.2;
      }
    },
    followCamera(position: THREE.Vector3): void {
      builder.followCamera(position);
    },
    openDoor(id: string): boolean {
      const door = doors.find((entry) => entry.id === id);
      if (!door || door.open) return false;
      door.open = true;
      door.openTime = 0;
      if (door.collider) {
        physics.removeStaticCollider(door.collider);
        door.collider = null;
      }
      return true;
    },
    damageWindow(id: string, amount: number): boolean {
      const window = windows.find((entry) => entry.id === id);
      if (!window || window.broken) return false;
      window.health = Math.max(0, window.health - amount);
      if (window.health > 0) {
        // Peel planks off as the barricade weakens: damage is readable at a glance.
        const intact = Math.max(1, Math.ceil((window.health / window.maxHealth) * window.planks.length));
        window.planks.forEach((plank, index) => {
          plank.visible = index < intact;
        });
        return false;
      }
      window.broken = true;
      window.group.visible = false;
      if (window.collider) {
        physics.removeStaticCollider(window.collider);
        window.collider = null;
      }
      return true;
    },
    repairWindow(id: string): boolean {
      const window = windows.find((entry) => entry.id === id);
      if (!window || !window.broken) return false;
      window.broken = false;
      window.health = window.maxHealth;
      window.group.visible = true;
      for (const plank of window.planks) plank.visible = true;
      window.collider = physics.addStaticBox(
        { x: window.center.x, y: 0.45, z: window.center.z },
        window.axis === 'x' ? { x: 1.35, y: 0.45, z: 0.2 } : { x: 0.2, y: 0.45, z: 1.35 },
      );
      return true;
    },
    reachableSectors,
    sectorAt,
    dispose(): void {
      builder.dispose();
    },
  };
}
