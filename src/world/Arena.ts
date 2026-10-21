import * as THREE from 'three';
import type { Physics } from '../core/Physics';
import type { Quality } from '../systems/SettingsManager';
import {
  LevelBuilder,
  makeCobbleTexture,
  makeDirtTexture,
  makeDuomoTexture,
  makeGrassTexture,
  makeMetroTexture,
  makePlazaTexture,
  makeRoofTexture,
  makeWaterTexture,
} from './Environment';

export interface ArenaPreview {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export interface ArenaBuild {
  group: THREE.Group;
  builder: LevelBuilder;
  spawnPoints: THREE.Vector3[];
  playerStart: THREE.Vector3;
  /** Initial camera yaw so each level opens on its best angle. */
  startYaw?: number;
  bossSpawn: THREE.Vector3;
  preview: ArenaPreview;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

function glowPlane(
  builder: LevelBuilder,
  pos: [number, number, number],
  size: [number, number],
  color: string,
  rotationY = 0,
  opacity = 1,
): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size[0], size[1]);
  builder.geometries.push(geometry);
  const material = builder.material(color, { basic: true, transparent: opacity < 1, opacity });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...pos);
  mesh.rotation.y = rotationY;
  builder.group.add(mesh);
  return mesh;
}

function archWindow(
  builder: LevelBuilder,
  x: number,
  z: number,
  y: number,
  width: number,
  height: number,
  warm: boolean,
): void {
  const glass = warm ? '#ffcf82' : '#9db5c9';
  const frame = builder.material('#211f1c', { roughness: 0.75 });
  builder.box({ pos: [x, y + height / 2, z], size: [width, height, 0.22], material: frame });
  glowPlane(builder, [x, y + height / 2, z + 0.13], [width - 0.35, height - 0.35], glass);
  builder.box({ pos: [x, y + height / 2, z + 0.16], size: [0.1, height - 0.4, 0.05], color: '#1c1a18' });
  builder.box({ pos: [x, y + height * 0.58, z + 0.16], size: [width - 0.4, 0.08, 0.05], color: '#1c1a18' });
  const archGeometry = new THREE.CircleGeometry(width / 2 - 0.02, 18, 0, Math.PI);
  builder.geometries.push(archGeometry);
  const archMesh = new THREE.Mesh(archGeometry, builder.material(glass, { basic: true }));
  archMesh.position.set(x, y + height, z + 0.13);
  builder.group.add(archMesh);
  const archFrameGeo = new THREE.TorusGeometry(width / 2, 0.09, 5, 18, Math.PI);
  builder.geometries.push(archFrameGeo);
  const archFrame = new THREE.Mesh(archFrameGeo, frame);
  archFrame.position.set(x, y + height, z + 0.15);
  builder.group.add(archFrame);
}

export function buildStation(physics: Physics, quality: Quality): ArenaBuild {
  const builder = new LevelBuilder(physics, quality);
  const bounds = { minX: -20, maxX: 20, minZ: -16, maxZ: 16 };
  builder.addSky('#05060d', '#2b2a33');
  builder.addStars(420);
  builder.addSkyline(66, 58, -2, [10, 28]);
  builder.ground(46, 38, makePlazaTexture());

  builder.addLights({
    hemiSky: '#5f6c93',
    hemiGround: '#2a2018',
    hemiIntensity: 1.15,
    moonColor: '#b9c6f2',
    moonIntensity: 2.8,
    moonPosition: [14, 26, 12],
    rimColor: '#ff9a5c',
    rimIntensity: 0.6,
    rimPosition: [-16, 9, -20],
    shadows: true,
  });

  // ── Stazione Centrale facade ─────────────────────────────────────────
  const stone = builder.material('#443f36', { roughness: 0.92 });
  const stoneDark = builder.material('#2b2824', { roughness: 0.9 });
  const stoneLight = builder.material('#554d40', { roughness: 0.88 });
  builder.box({ pos: [0, 7.5, -25], size: [52, 15, 8], material: stone, receive: true });
  builder.box({ pos: [0, 15.4, -25], size: [53, 1.2, 8.6], material: stoneLight });
  builder.box({ pos: [0, 2.1, -20.5], size: [46, 4.2, 1.4], material: stoneDark, collider: true });
  builder.box({ pos: [0, 4.6, -20.2], size: [48, 0.8, 1.2], material: stoneLight });
  for (const x of [-18, -9, 0, 9, 18]) {
    // Nichia: spessore della facciata percepibile, non un collage piatto.
    builder.box({ pos: [x, 8, -20.9], size: [1.5, 12.4, 1.0], material: stoneLight });
    builder.box({ pos: [x, 8, -21.4], size: [1.5, 12.4, 1.0], color: '#1c1915' });
    builder.box({ pos: [x, 8, -20.9], size: [0.55, 12.4, 0.65], material: stoneLight });
    archWindow(builder, x, -20.9, 5.6, x === 0 ? 4.2 : 3.4, 5.4, x === 0);
  }
  // Central portal.
  builder.box({ pos: [0, 2.3, -20.3], size: [5.6, 4.6, 0.8], color: '#171411' });
  glowPlane(builder, [0, 2.4, -19.9], [4.6, 4.2], '#ffd48c', 0, 1);
  builder.box({ pos: [0, 5, -19.75], size: [6.4, 0.5, 0.4], material: stoneLight });

  // Entrance canopy and columns.
  builder.box({ pos: [0, 6.6, -16.4], size: [22, 0.5, 6.4], color: '#202126', cast: true });
  builder.box({ pos: [0, 6.25, -16.4], size: [22.2, 0.28, 6.6], color: '#3a3b41' });
  for (const x of [-8.6, -4.3, 0, 4.3, 8.6]) {
    for (const z of [-19, -13.8]) {
      builder.cylinder({
        pos: [x, 3.1, z],
        radiusTop: 0.34,
        radiusBottom: 0.42,
        height: 6.2,
        color: '#4b463d',
        collider: true,
      });
    }
  }
  // Warm light pools at the entrance.
  builder.addPointLight([0, 4.4, -17.5], '#ffc776', 60, 24);
  builder.addPointLight([-13, 4.2, -14], '#ffdda0', 32, 18);
  builder.addPointLight([13, 4.2, -14], '#ffdda0', 32, 18);

  // Side hedges + fences marking the arena.
  builder.addHedge([-21, -15], [-21, 15], 1.25);
  builder.addHedge([21, -15], [21, 15], 1.25);
  builder.addHedge([-21, 16.2], [-9, 16.2], 1.1);
  builder.addHedge([9, 16.2], [21, 16.2], 1.1);
  builder.addFence([-20, -15.2], [-6, -15.2], 1.3);
  builder.addFence([6, -15.2], [20, -15.2], 1.3);
  builder.boundary(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);

  // Benches, planters, bins.
  builder.addBench([-14, 0, -5], Math.PI / 2);
  builder.addBench([14, 0, -2], -Math.PI / 2);
  builder.addBench([-9, 0, 9], 0);
  builder.addPlanter([-16, 0, 8], 2);
  builder.addPlanter([16, 0, 10], 2);
  builder.addPlanter([-16, 0, -11], 1.6);
  builder.addPlanter([16, 0, -11], 1.6);
  builder.addBin([-12, 0, 6]);
  builder.addBin([12, 0, 4]);

  // Bus stop on the east side.
  builder.box({ pos: [17.2, 3.1, 3], size: [0.2, 0.24, 6], color: '#24262b' });
  builder.box({ pos: [17.2, 3.25, 3], size: [3.1, 0.12, 6], color: '#2f3238' });
  for (const z of [0.2, 5.8]) {
    builder.cylinder({ pos: [16, 1.5, z], radiusTop: 0.08, radiusBottom: 0.08, height: 3, color: '#3b3f45' });
  }
  glowPlane(builder, [16.0, 2.2, 3], [5.4, 1.9], '#9fb6c9', Math.PI / 2, 0.14);
  builder.sign('MARANZA\nAIRLINES', {
    pos: [17.05, 3.05, 3],
    size: [3.4, 1.4],
    rotY: -Math.PI / 2,
    fg: '#ffd400',
    accent: '#ff2f2f',
    sub: 'VOLI LOW COST, ZERO BAGAGLI',
  });

  // Poster walls / ad boards.
  builder.sign('TRENI\n+12 MIN', {
    pos: [-11, 2.5, -14.6],
    size: [3.2, 1.7],
    fg: '#f3efe3',
    accent: '#ff2f2f',
    sub: 'RITARDO CON STILE',
  });
  builder.sign('PANINO\nMILANESE', {
    pos: [6.8, 2.6, 15.4],
    size: [3.4, 1.6],
    fg: '#ffd400',
    accent: '#ff2f2f',
    sub: 'OLIO, SALE, CORAGGIO',
    rotY: Math.PI,
  });

  // Lamps.
  builder.addLamp([-11, 0, -2], '#ffcf8a', 42, 5.6);
  builder.addLamp([11, 0, -2], '#ffcf8a', 42, 5.6);
  builder.addLamp([-6, 0, 12], '#ffe2ad', 28, 5.4);
  builder.addLamp([6, 0, 12], '#ffe2ad', 28, 5.4);

  // Disegno a terra: linea gialla di sicurezza.
  builder.box({ pos: [0, 0.012, -13.6], size: [30, 0.02, 0.22], color: '#8f7a1b' });
  builder.box({ pos: [-18.5, 0.012, 0], size: [0.18, 0.02, 28], color: '#8f7a1b' });

  // Yellow tram silhouette beyond the south hedge.
  builder.box({ pos: [-4, 1.8, 19.5], size: [17, 3.1, 2.6], color: '#c9a51b' });
  builder.box({ pos: [-4, 3.42, 19.5], size: [17.2, 0.24, 2.8], color: '#7e6a14' });
  for (let i = 0; i < 6; i++) {
    glowPlane(builder, [-10.4 + i * 2.5, 2.1, 18.15], [1.5, 0.95], '#ffe7a8', Math.PI, 0.9);
  }
  builder.box({ pos: [-4, 0.5, 19.5], size: [15.5, 0.5, 2.4], color: '#1b1c1f' });

  return {
    group: builder.group,
    builder,
    spawnPoints: [
      new THREE.Vector3(-14, 0, -10),
      new THREE.Vector3(14, 0, -10),
      new THREE.Vector3(-16, 0, 6),
      new THREE.Vector3(16, 0, 6),
      new THREE.Vector3(-8, 0, -12),
      new THREE.Vector3(8, 0, -12),
      new THREE.Vector3(-10, 0, 12),
      new THREE.Vector3(10, 0, 12),
    ],
    playerStart: new THREE.Vector3(0, 0, 8),
    bossSpawn: new THREE.Vector3(0, 0, -8),
    preview: { position: new THREE.Vector3(-15, 7.5, 20), lookAt: new THREE.Vector3(1, 3.4, -5) },
    bounds,
  };
}

export function buildMetro(physics: Physics, quality: Quality): ArenaBuild {
  const builder = new LevelBuilder(physics, quality);
  const bounds = { minX: -11, maxX: 11, minZ: -19, maxZ: 19 };
  builder.addSky('#050607', '#111417');
  builder.ground(24, 40, makeMetroTexture());

  builder.addLights({
    hemiSky: '#6c8ea0',
    hemiGround: '#1c2624',
    hemiIntensity: 0.95,
    moonColor: '#cfeaf5',
    moonIntensity: 1.1,
    moonPosition: [5, 14, 3],
    shadows: true,
  });

  const wallMat = builder.material('#2a3134', { roughness: 0.9 });
  const tileTrim = builder.material('#7d8a7a', { roughness: 0.8 });
  const steel = builder.material('#343a40', { roughness: 0.55, metalness: 0.5 });

  // Walls and ceiling.
  for (const side of [-1, 1]) {
    builder.box({
      pos: [side * 11.4, 3.1, 0],
      size: [0.6, 6.2, 40],
      material: wallMat,
      receive: true,
    });
    builder.box({
      pos: [side * 11.05, 1.25, 0],
      size: [0.08, 2.5, 40],
      material: tileTrim,
      receive: true,
    });
    glowPlane(builder, [side * 11.02, 3.4, 0], [38, 0.18], side === 1 ? '#ffd400' : '#74b6c9', Math.PI / 2, 0.65);
  }
  builder.boundary(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, 3.4);
  builder.box({ pos: [0, 6.1, 0], size: [24, 0.4, 40], color: '#15191b', receive: true });
  for (let z = -18; z <= 18; z += 4.5) {
    builder.box({ pos: [0, 5.86, z], size: [22, 0.24, 0.3], color: '#262c2f' });
    builder.box({
      pos: [0, 5.78, z],
      size: [9, 0.08, 0.34],
      material: builder.material('#e8f5ff', { basic: true }),
    });
  }
  builder.addPointLight([0, 4.6, -8], '#cfe9ff', 38, 22);
  builder.addPointLight([0, 4.6, 8], '#ffd9a0', 34, 22);
  builder.addPointLight([0, 3.4, 0], '#a8d3e8', 22, 18);

  // Support columns.
  for (const x of [-4.2, 4.2]) {
    for (let z = -14; z <= 14; z += 7) {
      builder.cylinder({
        pos: [x, 3.05, z],
        radiusTop: 0.38,
        radiusBottom: 0.44,
        height: 6.1,
        color: '#3a4144',
        collider: true,
      });
      builder.box({ pos: [x, 0.16, z], size: [1.35, 0.32, 1.35], color: '#22282a' });
      builder.box({ pos: [x, 6, z], size: [1.2, 0.2, 1.2], color: '#22282a' });
      glowPlane(builder, [x + 0.42, 3.2, z], [1.2, 0.12], '#ffd400', Math.PI / 2, 0.5);
    }
  }

  // Platform edge / rails on the east side.
  builder.addFence([8.3, -18], [8.3, 18], 1.2);
  builder.box({ pos: [8.15, 0.012, 0], size: [0.22, 0.02, 38], color: '#b99a1f' });
  for (const x of [9.7, 10.5]) {
    builder.box({ pos: [x, 0.05, 0], size: [0.12, 0.1, 38], color: '#5d6166' });
  }
  // Decorative train.
  builder.box({ pos: [12.1, 1.9, 0], size: [3.6, 3.3, 33], color: '#b9b3a4' });
  builder.box({ pos: [12.1, 3.65, 0], size: [3.8, 0.32, 33.2], color: '#6c6a63' });
  builder.box({ pos: [12.1, 0.42, 0], size: [3.3, 0.7, 32], color: '#23262a' });
  for (let z = -14; z <= 14; z += 4.2) {
    glowPlane(builder, [10.24, 2.2, z], [2.4, 1.15], '#cfe9ff', -Math.PI / 2, 0.5);
    builder.box({ pos: [10.3, 3.2, z], size: [0.08, 0.1, 2.5], color: '#7c7a73' });
  }
  builder.sign('M3\nDUOMO', {
    pos: [-10.9, 3.4, -6],
    size: [3.4, 1.6],
    rotY: Math.PI / 2,
    bg: '#12222a',
    fg: '#f3efe3',
    accent: '#ff2f2f',
    sub: 'LINEA GIALLA',
  });
  builder.sign('ATTENZIONE\nMARANZA', {
    pos: [10.9, 3.2, 8],
    size: [3.6, 1.7],
    rotY: -Math.PI / 2,
    bg: '#1a1410',
    fg: '#ffd400',
    accent: '#ff2f2f',
    sub: 'ZONA CONTROLLATA',
  });
  builder.sign('USCITA →', {
    pos: [0, 4.1, -18.4],
    size: [4.2, 1.2],
    fg: '#f3efe3',
    accent: '#ffd400',
    sub: 'SCALE / PIAZZA',
    rotY: 0,
  });

  // Stairs at the south end, blocked by a gate.
  for (let i = 0; i < 4; i++) {
    builder.box({ pos: [0, 0.12 + i * 0.24, -20.2 + i * 0.9], size: [10, 0.24 + i * 0.48, 0.95], color: '#3a3e40' });
  }
  builder.box({ pos: [0, 1.4, -17.2], size: [10.4, 2.8, 0.4], material: steel, collider: true });
  builder.sign('VIETATO\nUSCIRE', {
    pos: [0, 2.5, -17.0],
    size: [2.8, 1.2],
    fg: '#f3efe3',
    accent: '#ff2f2f',
    sub: 'IL MARANZA NON MOLLA',
  });

  // Ticket machines and benches.
  builder.box({ pos: [-8.2, 0.8, -10], size: [1.1, 1.6, 0.8], material: steel, collider: true });
  glowPlane(builder, [-8.2, 1.05, -9.58], [0.8, 0.55], '#8fd4ff', 0, 0.85);
  builder.box({ pos: [8.2, 0.8, -12], size: [1.1, 1.6, 0.8], material: steel, collider: true });
  builder.addBench([-6.7, 0, 1], Math.PI / 2);
  builder.addBench([6.7, 0, 9], -Math.PI / 2);
  builder.addBin([-7.2, 0, -2]);
  builder.addBin([7.2, 0, 4]);
  builder.addPlanter([-9.2, 0, 14], 1.4);
  builder.addPlanter([9.2, 0, 16], 1.4);

  return {
    group: builder.group,
    builder,
    spawnPoints: [
      new THREE.Vector3(-7, 0, -15),
      new THREE.Vector3(7, 0, -15),
      new THREE.Vector3(-7, 0, -8),
      new THREE.Vector3(7, 0, -8),
      new THREE.Vector3(-7, 0, 5),
      new THREE.Vector3(7, 0, 5),
      new THREE.Vector3(-7, 0, 15),
      new THREE.Vector3(7, 0, 15),
    ],
    playerStart: new THREE.Vector3(0, 0, 13),
    bossSpawn: new THREE.Vector3(0, 0, -10),
    preview: { position: new THREE.Vector3(-8.5, 4.4, 16), lookAt: new THREE.Vector3(1, 2.6, -6) },
    bounds,
  };
}

export function buildDuomo(physics: Physics, quality: Quality): ArenaBuild {
  const builder = new LevelBuilder(physics, quality);
  const bounds = { minX: -22, maxX: 22, minZ: -19, maxZ: 19 };
  builder.addSky('#04050c', '#241f2c');
  builder.addStars(520);
  builder.addSkyline(72, 62, -2, [13, 32]);
  builder.ground(48, 42, makeDuomoTexture());

  builder.addLights({
    hemiSky: '#8a8fc8',
    hemiGround: '#231e18',
    hemiIntensity: 1.1,
    moonColor: '#ecdcff',
    moonIntensity: 2.8,
    moonPosition: [-12, 28, 8],
    rimColor: '#ffd9a0',
    rimIntensity: 0.5,
    rimPosition: [14, 10, -16],
    shadows: true,
  });

  const marble = builder.material('#cfc5ae', { roughness: 0.78 });
  const marbleDark = builder.material('#a99e88', { roughness: 0.82 });
  const stoneDark = builder.material('#2b2831', { roughness: 0.9 });
  const gold = builder.material('#c9a64d', { roughness: 0.3, metalness: 0.7 });

  // ── Cathedral silhouette ─────────────────────────────────────────────
  builder.box({ pos: [0, 5.6, -28], size: [34, 11.2, 10], material: marble, receive: true });
  builder.box({ pos: [0, 12.2, -25.4], size: [22, 3.4, 5], material: marbleDark });
  builder.box({ pos: [0, 14.4, -25.4], size: [12, 2.8, 4], material: marble });
  builder.box({ pos: [0, 17.2, -27.2], size: [4.2, 5.8, 4.2], material: marble });
  builder.box({ pos: [0, 20.3, -27.2], size: [4.6, 0.6, 4.6], material: marbleDark });
  // Central spire.
  const spire = new THREE.ConeGeometry(1.4, 5.2, 8);
  builder.geometries.push(spire);
  const spireMesh = new THREE.Mesh(spire, marble);
  spireMesh.position.set(0, 24.6, -27.2);
  builder.group.add(spireMesh);

  // Rose window.
  const roseGeo = new THREE.CircleGeometry(2.5, 28);
  builder.geometries.push(roseGeo);
  const roseMat = builder.material('#ffd77a', { basic: true });
  const rose = new THREE.Mesh(roseGeo, roseMat);
  rose.position.set(0, 11.8, -20.6);
  builder.group.add(rose);
  const roseRingGeo = new THREE.TorusGeometry(2.7, 0.14, 6, 28);
  builder.geometries.push(roseRingGeo);
  const roseRing = new THREE.Mesh(roseRingGeo, marbleDark);
  roseRing.position.set(0, 11.8, -20.35);
  builder.group.add(roseRing);
  for (let i = 0; i < 8; i++) {
    const spokeGeo = new THREE.BoxGeometry(0.1, 4.6, 0.06);
    builder.geometries.push(spokeGeo);
    const spoke = new THREE.Mesh(spokeGeo, stoneDark);
    spoke.position.set(0, 11.8, -20.5);
    spoke.rotation.z = (i / 8) * Math.PI;
    builder.group.add(spoke);
  }

  // Facade spires.
  for (let i = 0; i < 7; i++) {
    const x = -10.5 + i * 3.5;
    const h = 7 + (i % 2) * 2.5 + (i === 3 ? 4 : 0);
    const g = new THREE.ConeGeometry(0.55, h, 6);
    builder.geometries.push(g);
    const mesh = new THREE.Mesh(g, marbleDark);
    mesh.position.set(x, 14 + h / 2, -22.5);
    builder.group.add(mesh);
  }
  // Arched windows and doors on the facade.
  for (let i = 0; i < 5; i++) {
    archWindow(builder, -8 + i * 4, -22.4, 5.4, 2.4, 4.2, i === 2);
  }
  builder.box({ pos: [0, 1.9, -22.2], size: [4.6, 3.8, 0.6], color: '#1b1713' });
  glowPlane(builder, [0, 1.95, -21.85], [3.6, 3.2], '#ffca7a', 0, 0.95);
  builder.box({ pos: [0, 4, -21.7], size: [5.2, 0.4, 0.4], material: gold });

  // Cathedral steps (real, climbable one step at a time).
  for (let i = 0; i < 3; i++) {
    builder.box({
      pos: [0, 0.14 + i * 0.28, -19.4 + i * 0.85],
      size: [22 - i * 1.5, 0.28 + i * 0.56, 0.9],
      material: marbleDark,
      receive: true,
    });
  }
  builder.addFence([-11, -17.2], [-2, -17.2], 1.1);
  builder.addFence([2, -17.2], [11, -17.2], 1.1);
  builder.box({ pos: [0, 0.6, -17.2], size: [3, 1.2, 0.7], material: gold, collider: true });
  glowPlane(builder, [0, 0.8, -16.82], [2.2, 0.5], '#ffd400', 0, 0.9);

  // Boundary architecture.
  builder.addHedge([-23, -17], [-23, 17], 1.3);
  builder.addHedge([23, -17], [23, 17], 1.3);
  builder.addHedge([-23, 18], [-10, 18], 1.2);
  builder.addHedge([10, 18], [23, 18], 1.2);
  builder.boundary(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, 2.4);

  // Palazzi flanking the piazza.
  builder.box({ pos: [-28, 8, -8], size: [8, 16, 24], color: '#191a22' });
  builder.box({ pos: [28, 9, -6], size: [8, 18, 22], color: '#1a1b24' });
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      glowPlane(builder, [-23.8, 4 + j * 3.2, -17 + i * 4.5], [1.1, 1.5], i % 2 === j % 2 ? '#ffd28a' : '#9fc8e0', Math.PI / 2, 0.55);
      glowPlane(builder, [23.8, 4 + j * 3.4, -15 + i * 4.5], [1.1, 1.5], i % 2 === j % 2 ? '#ffd28a' : '#9fc8e0', -Math.PI / 2, 0.55);
    }
  }

  // Piazza props.
  builder.addLamp([-12, 0, 4], '#ffdca0', 1.6, 5.8);
  builder.addLamp([12, 0, 4], '#ffdca0', 1.6, 5.8);
  builder.addLamp([8, 0, 15], '#ffe6b5', 1.4, 5.2);
  builder.addBench([-15, 0, 7], Math.PI / 2);
  builder.addBench([15, 0, 7], -Math.PI / 2);
  builder.addBench([-8, 0, 14], 0);
  builder.addPlanter([-18, 0, -12], 2.2);
  builder.addPlanter([18, 0, -12], 2.2);
  builder.addBin([10, 0, 10]);
  builder.addBin([-10, 0, 10]);

  // Stage trusses with colored lights for the boss showdown.
  for (const [x, color] of [
    [-16, '#ff3b3b'],
    [16, '#ff3b3b'],
    [-6, '#ffd400'],
    [6, '#ffd400'],
  ] as Array<[number, string]>) {
    builder.box({ pos: [x, 4.6, -6], size: [0.16, 9.2, 0.16], color: '#1b1c21' });
    builder.box({ pos: [x, 9.1, -6], size: [1.6, 0.2, 0.6], color: '#292b31' });
    builder.box({
      pos: [x, 8.9, -6],
      size: [1.1, 0.25, 0.4],
      material: builder.material(color, { basic: true }),
    });
    builder.addPointLight([x, 7.8, -6], color, 22, 16);
  }
  builder.addPointLight([0, 5, -10], '#ffcf8a', 38, 24);

  // Pigeons, because a Milan piazza without pigeons is a parking lot.
  const pigeonBody = builder.material('#9aa0aa', { roughness: 0.9 });
  const pigeonHead = builder.material('#565b64', { roughness: 0.9 });
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + 0.6;
    const radius = 4.4 + (i % 4) * 2.1;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.82;
    builder.sphere([x, 0.12, z], [0.14, 0.11, 0.2], pigeonBody);
    builder.sphere([x, 0.24, z + 0.13], [0.075, 0.085, 0.075], pigeonHead);
  }

  // Coffee kiosk on the west side of the piazza.
  const kioskWall = builder.material('#332a22', { roughness: 0.85 });
  const kioskAwning = builder.material('#a3282a', { roughness: 0.8 });
  builder.box({ pos: [-16.5, 1.15, 1], size: [3.1, 2.3, 2.1], material: kioskWall, collider: true });
  builder.box({ pos: [-16.5, 2.44, 1], size: [3.6, 0.16, 2.6], material: kioskAwning });
  builder.box({ pos: [-16.5, 1.6, 2.11], size: [2.4, 0.9, 0.06], material: builder.material('#0f1114', { roughness: 0.4 }) });
  builder.sign('CAFFÈ', {
    pos: [-16.5, 2.06, 2.16],
    size: [1.9, 0.46],
    bg: '#0b0b0e',
    fg: '#ffd400',
    sub: 'APERTO FINO ALLE 3',
  });
  builder.addPointLight([-16.5, 2.2, 2.6], '#ffd28a', 16, 10);

  // Traffic cones near the stage, because Milan never finishes its works.
  const cone = builder.material('#ff6a1e', { roughness: 0.7 });
  for (const [x, z] of [
    [-19, -2],
    [19.5, -3.5],
    [-11, 12],
  ] as Array<[number, number]>) {
    builder.cylinder({ pos: [x, 0.28, z], radiusTop: 0.06, radiusBottom: 0.26, height: 0.56, material: cone });
    builder.box({ pos: [x, 0.03, z], size: [0.62, 0.06, 0.62], color: '#141416' });
  }

  // Central emblem.
  const ringGeo = new THREE.RingGeometry(3.2, 3.5, 40);
  builder.geometries.push(ringGeo);
  const ring = new THREE.Mesh(ringGeo, builder.material('#6b5b25', { basic: true }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  builder.group.add(ring);

  return {
    group: builder.group,
    builder,
    spawnPoints: [
      new THREE.Vector3(-14, 0, -10),
      new THREE.Vector3(14, 0, -10),
      new THREE.Vector3(-18, 0, 4),
      new THREE.Vector3(18, 0, 4),
      new THREE.Vector3(-8, 0, -14),
      new THREE.Vector3(8, 0, -14),
      new THREE.Vector3(-10, 0, 15),
      new THREE.Vector3(10, 0, 15),
    ],
    playerStart: new THREE.Vector3(0, 0, 10),
    bossSpawn: new THREE.Vector3(0, 0, -8),
    preview: { position: new THREE.Vector3(-16, 8.5, 21), lookAt: new THREE.Vector3(1, 6, -9) },
    bounds,
  };
}

/**
 * LEVEL 3 — NAVIGLI. Wet cobbles, a canal, moored boats, neon aperitivo bars
 * and string lights strung between the houses. The camera looks along the
 * quay so the water is always in frame.
 */
export function buildNavigli(physics: Physics, quality: Quality): ArenaBuild {
  const builder = new LevelBuilder(physics, quality);
  const bounds = { minX: -19, maxX: 19, minZ: -14, maxZ: 14 };
  builder.addSky('#050512', '#2c1f38');
  builder.addStars(380);
  builder.addSkyline(90, 50, -6, [14, 38]);
  builder.ground(46, 36, makeCobbleTexture(), 0, 4.5);

  builder.addLights({
    hemiSky: '#9fa2dd',
    hemiGround: '#2c2230',
    hemiIntensity: 1.35,
    moonColor: '#e2e6ff',
    moonIntensity: 2.8,
    moonPosition: [-16, 26, 12],
    shadows: true,
    rimColor: '#ff4f9c',
    rimIntensity: 0.9,
    rimPosition: [20, 9, -14],
  });

  // ── Canal ───────────────────────────────────────────────────────────
  const waterBase = builder.material('#0d2433', {
    roughness: 0.12,
    metalness: 0.9,
    flat: false,
    emissive: '#0a2230',
    emissiveIntensity: 0.55,
  });
  const waterGeo = new THREE.PlaneGeometry(26, 80);
  builder.geometries.push(waterGeo);
  const water = new THREE.Mesh(waterGeo, waterBase);
  water.rotation.x = -Math.PI / 2;
  water.position.set(32, -0.62, 0);
  builder.group.add(water);

  const rippleTexture = builder.texture(makeWaterTexture());
  const rippleMaterial = new THREE.MeshBasicMaterial({
    map: rippleTexture,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  builder.materials.push(rippleMaterial);
  const rippleGeo = new THREE.PlaneGeometry(26, 80);
  builder.geometries.push(rippleGeo);
  const ripples = new THREE.Mesh(rippleGeo, rippleMaterial);
  ripples.rotation.x = -Math.PI / 2;
  ripples.position.set(32, -0.55, 0);
  builder.group.add(ripples);
  builder.animations.push((time) => {
    rippleTexture.offset.set(time * 0.012, time * 0.045);
    water.position.y = -0.62 + Math.sin(time * 0.6) * 0.02;
  });

  // Quay wall and kerb.
  builder.box({ pos: [20.4, 0.3, 0], size: [1.1, 0.6, 38], color: '#3a352f', receive: true });
  builder.box({ pos: [20.4, 0.62, 0], size: [1.2, 0.08, 38], color: '#55504a' });
  builder.box({ pos: [20.4, 0.012, 0], size: [0.3, 0.02, 38], color: '#b99a1f' });
  builder.boundary(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, 1.6);
  builder.addFence([19.4, -14], [19.4, -4.6], 1.05);
  builder.addFence([19.4, 4.6], [19.4, 14], 1.05);

  // Colored canal-side houses on the west bank.
  const houses: Array<[number, number, number, string]> = [
    [-9, 10, 11.5, '#8c3b2f'],
    [0, 10, 13, '#2f5a72'],
    [9, 9.5, 10.5, '#7a6a2a'],
    [17, 8, 12.5, '#4a3358'],
  ];
  for (const [z, depth, height, color] of houses) {
    const x = -25.5;
    builder.box({ pos: [x, height / 2, z], size: [11, height, depth], color, receive: true });
    builder.box({ pos: [x, height + 0.18, z], size: [11.6, 0.36, depth + 0.6], color: '#221c1c' });
    builder.box({ pos: [x + 5.4, height * 0.42, z], size: [0.5, 0.28, depth - 1.2], color: '#f0e6d2' });
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if ((row + col + Math.round(z)) % 4 === 0) continue;
        const py = 2.4 + row * 3.1;
        const pz = z - depth / 2 + 1.8 + col * ((depth - 3.4) / 2);
        glowPlane(
          builder,
          [x + 5.56, py, pz],
          [1.15, 1.7],
          (row + col) % 3 === 0 ? '#ffcf82' : '#a7c4d8',
          Math.PI / 2,
          0.92,
        );
        builder.box({ pos: [x + 5.6, py - 0.95, pz], size: [0.16, 0.12, 1.45], color: '#17140f' });
        builder.box({ pos: [x + 5.7, py - 0.2, pz], size: [0.4, 0.1, 1.5], color: '#2b2622' });
      }
    }
    // Roof terrace railing.
    builder.addFence([x - 5, z - depth / 2], [x - 5, z + depth / 2], 0.9);
  }

  // Bars on the west side, facing the canal.
  const barSigns: Array<[number, string, string, string]> = [
    [-6, '#ff3ea5', 'SPRITZ', '5€ · GHIACCIO FINO'],
    [4, '#ffd400', 'APERITIVO', 'DALLE 18 ALLE 4'],
    [12, '#4fd7ff', 'NAVIGLI', 'RIPA DI PORTA'],
  ];
  for (const [z, color, text, sub] of barSigns) {
    builder.box({ pos: [-19.9, 2.2, z], size: [0.5, 4.4, 6.4], color: '#1d1a1c' });
    builder.addAwning([-18.8, 3.05, z], 5.4, 2.2, color === '#ff3ea5' ? '#8c2a52' : '#3a4a5c', Math.PI / 2);
    builder.sign(text, {
      pos: [-19.55, 3.6, z],
      size: [4.4, 1.5],
      rotY: Math.PI / 2,
      bg: '#0d0b10',
      fg: color,
      accent: '#ffffff',
      sub,
    });
    builder.addGlow([-19.4, 3.6, z], color, 5.4, 0.4);
    builder.addLightCone([-18.6, 0.1, z], color, 4, 2.2, 0.05);
    builder.addPointLight([-17.8, 3.2, z], color, 26, 16);
    builder.addPuddle(-15.5, z + 1.2, 3.1, 1.7, color, 0.09);
  }

  // Tables under umbrellas.
  for (const [x, z, color] of [
    [-14.4, -7.5, '#c8452e'],
    [-14.4, -1.5, '#2f6a72'],
    [-14.4, 6.5, '#c8452e'],
  ] as Array<[number, number, string]>) {
    builder.cylinder({ pos: [x, 0.38, z], radiusTop: 0.32, radiusBottom: 0.26, height: 0.76, color: '#26282c' });
    builder.cylinder({ pos: [x, 0.78, z], radiusTop: 0.72, radiusBottom: 0.72, height: 0.08, color: '#4a3a2a', collider: true });
    builder.addUmbrella([x, 0, z], color);
    builder.addBench([x - 1.35, 0, z], Math.PI / 2);
    builder.addBench([x + 1.35, 0, z], -Math.PI / 2);
  }

  // Neon reflections on the wet quay.
  builder.addPuddle(-3, -4, 4.6, 2.1, '#ff3ea5', 0.08);
  builder.addPuddle(6, 5, 5.2, 2.4, '#4fd7ff', 0.07);
  builder.addPuddle(-11, 10, 3.6, 1.7, '#ffd400', 0.07);

  // String lights overhead.
  builder.addStringLights([-18, 5.6, -6], [18, 5.2, -6], '#ffe6a8', 18, 0.9);
  builder.addStringLights([-18, 5.2, 6], [18, 5.6, 6], '#ffd6a0', 18, 0.9);
  builder.addStringLights([-18, 5.4, -6], [-18, 5.4, 6], '#ffe6a8', 8, 0.5);

  // Lamps along the quay and the back of the square.
  builder.addLamp([-15, 0, 2], '#ffcf8a', 34, 5.2);
  builder.addLamp([15, 0, 2], '#ffcf8a', 34, 5.2);
  builder.addLamp([8, 0, 11], '#ffdca0', 24, 4.8, false);
  builder.addLamp([18, 0, -8], '#ffdca0', 26, 5, false);
  builder.addLamp([-8, 0, -12], '#ffd6a0', 24, 5, false);
  builder.addPointLight([0, 4.2, 0], '#ffd2a0', 26, 22);
  builder.addPointLight([10, 3.4, -3], '#ff9ad2', 16, 14);

  // Neon glow bleeding onto the water.
  for (const [gx, gz, color, size] of [
    [25.5, -4, '#ff3ea5', 7],
    [25.5, 4, '#4fd7ff', 7],
    [25.5, 10, '#ffd400', 6],
    [28, -10, '#ffcf8a', 6],
  ] as Array<[number, number, string, number]>) {
    builder.addGlow([gx, 0.1, gz], color, size, 0.22);
  }

  // Trees and bins.
  builder.addTree([-17.5, 0, -11], 4.6);
  builder.addTree([16.5, 0, -11], 4.2);
  builder.addTree([-17.5, 0, 12], 4.4);
  builder.addBin([-12, 0, 11]);
  builder.addBin([12.5, 0, -2]);

  // Bridges over the canal.
  const bridgeZ = -11;
  builder.box({ pos: [29, 1.1, bridgeZ], size: [24, 0.42, 5.4], color: '#4a443c' });
  builder.box({ pos: [29, 1.34, bridgeZ - 2.6], size: [24, 0.4, 0.18], color: '#2a2620' });
  builder.box({ pos: [29, 1.34, bridgeZ + 2.6], size: [24, 0.4, 0.18], color: '#2a2620' });
  for (const x of [21, 27, 33, 38]) {
    builder.cylinder({ pos: [x, 0.55, bridgeZ], radiusTop: 0.28, radiusBottom: 0.34, height: 1.5, color: '#3d3831' });
  }
  for (const x of [19.2, 24.5, 30, 35.5, 39]) {
    builder.addLamp([x, 1.5, bridgeZ - 2.9], '#ffd28a', 0, 2.2, false);
  }
  builder.sign('PONTE', {
    pos: [22.5, 2.6, bridgeZ - 3.1],
    size: [1.8, 0.8],
    bg: '#101014',
    fg: '#ffd400',
    accent: '#ff3ea5',
    sub: 'NIENTE TUFFI',
  });

  // Houses on the far bank, lit from below.
  for (let i = 0; i < 4; i++) {
    const z = -15 + i * 10;
    const h = 9 + (i % 3) * 2.5;
    builder.box({ pos: [43, h / 2 - 0.6, z], size: [12, h, 9], color: ['#5a3a44', '#2e4450', '#4a4030', '#3a3050'][i] });
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        glowPlane(builder, [36.9, 2.6 + row * 3.2, z - 3 + col * 3], [1.2, 1.6], (i + row + col) % 3 === 0 ? '#ffd28a' : '#9fc8e0', -Math.PI / 2, 0.85);
      }
    }
  }

  // Moored boats, gently bobbing.
  const boats: THREE.Object3D[] = [];
  for (const [bx, bz, tilt] of [
    [26.2, 2.5, 0.04],
    [26.6, 10.5, -0.03],
    [26.4, -6.5, 0.05],
  ] as Array<[number, number, number]>) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(builder.boxGeo, builder.material('#1b2026', { roughness: 0.6 }));
    hull.scale.set(1.55, 0.62, 5.4);
    boat.add(hull);
    const deck = new THREE.Mesh(builder.boxGeo, builder.material('#4a3b2c', { roughness: 0.9 }));
    deck.scale.set(1.3, 0.07, 5);
    deck.position.y = 0.3;
    boat.add(deck);
    for (const side of [-1, 1]) {
      const gunwale = new THREE.Mesh(builder.boxGeo, builder.material('#8e8574', { roughness: 0.7 }));
      gunwale.scale.set(0.1, 0.1, 5.3);
      gunwale.position.set(side * 0.76, 0.32, 0);
      boat.add(gunwale);
    }
    const cabin = new THREE.Mesh(builder.boxGeo, builder.material('#2f3c41', { roughness: 0.55 }));
    cabin.scale.set(0.95, 0.55, 1.35);
    cabin.position.set(0, 0.56, -1.4);
    boat.add(cabin);
    const tarp = new THREE.Mesh(builder.boxGeo, builder.material('#5a2f28', { roughness: 0.9 }));
    tarp.scale.set(1.05, 0.22, 1.7);
    tarp.position.set(0, 0.42, 1.5);
    boat.add(tarp);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.8, 6), builder.material('#6f6a5c', { roughness: 0.6 }));
    builder.geometries.push(mast.geometry);
    mast.position.set(0, 1.2, -2.1);
    boat.add(mast);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), builder.material('#ffdf9a', { basic: true }));
    builder.geometries.push(lantern.geometry);
    lantern.position.set(0, 1.95, -2.1);
    boat.add(lantern);
    builder.addGlow([bx, 1.55, bz - 2.1], '#ffcf8a', 1.9, 0.32);
    boat.position.set(bx, -0.3, bz);
    boat.rotation.z = tilt;
    builder.group.add(boat);
    boats.push(boat);
  }
  builder.animations.push((time) => {
    boats.forEach((boat, index) => {
      boat.position.y = -0.3 + Math.sin(time * 0.9 + index * 1.7) * 0.06;
      boat.rotation.z = Math.sin(time * 0.7 + index) * 0.022;
    });
  });

  return {
    group: builder.group,
    builder,
    spawnPoints: [
      new THREE.Vector3(-15, 0, -9),
      new THREE.Vector3(15, 0, -9),
      new THREE.Vector3(-15, 0, 9),
      new THREE.Vector3(15, 0, 9),
      new THREE.Vector3(-7, 0, -11),
      new THREE.Vector3(7, 0, -11),
      new THREE.Vector3(-8, 0, 12),
      new THREE.Vector3(12, 0, 11),
    ],
    playerStart: new THREE.Vector3(2, 0, 9),
    startYaw: -1.05,
    bossSpawn: new THREE.Vector3(0, 0, -9),
    preview: { position: new THREE.Vector3(33, 8.2, 24), lookAt: new THREE.Vector3(-4, 0.6, -5) },
    bounds,
  };
}

/**
 * LEVEL 4 — BOSCO VERTICALE. A rooftop terrace above Milan: glass parapets,
 * a helipad, a sky bar, AC units and two green towers disappearing into the fog.
 */
export function buildTowers(physics: Physics, quality: Quality): ArenaBuild {
  const builder = new LevelBuilder(physics, quality);
  const bounds = { minX: -17, maxX: 17, minZ: -13, maxZ: 13 };
  builder.addSky('#03040c', '#2b1b3d');
  builder.addStars(640);
  builder.addSkyline(105, 64, -55, [34, 88]);
  builder.ground(42, 34, makeRoofTexture(), 0, 6);

  builder.addLights({
    hemiSky: '#9aa4e2',
    hemiGround: '#221b2c',
    hemiIntensity: 1.4,
    moonColor: '#e6eaff',
    moonIntensity: 2.7,
    moonPosition: [-18, 32, -10],
    shadows: true,
    rimColor: '#ff4f7a',
    rimIntensity: 1.0,
    rimPosition: [18, 7, 14],
  });

  // Moon.
  builder.addGlow([-58, 42, -72], '#dfe6ff', 34, 0.45);
  builder.addGlow([-58, 42, -72], '#ffffff', 9, 0.85);

  // Glass parapet around the terrace.
  const glass = builder.material('#a9d8e8', {
    basic: true,
    transparent: true,
    opacity: 0.16,
  });
  const rail = builder.material('#2a2e34', { roughness: 0.45, metalness: 0.6 });
  const sides: Array<[number, number, number, number, number]> = [
    [0, -13.4, 35, 0.06, 1.15],
    [0, 13.4, 35, 0.06, 1.15],
    [-17.4, 0, 0.06, 27, 1.15],
    [17.4, 0, 0.06, 27, 1.15],
  ];
  for (const [x, z, sx, sz, height] of sides) {
    const panel = new THREE.Mesh(builder.boxGeo, glass);
    panel.position.set(x, height / 2 + 0.1, z);
    panel.scale.set(sx, height, sz);
    builder.group.add(panel);
    builder.box({ pos: [x, height + 0.14, z], size: [sx + 0.08, 0.09, sz + 0.08], material: rail });
    builder.box({ pos: [x, 0.2, z], size: [sx, 0.4, sz], color: '#33373d' });
  }
  builder.boundary(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, 1.3);

  // Helipad.
  const padRing = new THREE.RingGeometry(3.3, 3.55, 44);
  builder.geometries.push(padRing);
  const padMark = new THREE.Mesh(padRing, builder.material('#ffd400', { basic: true }));
  padMark.rotation.x = -Math.PI / 2;
  padMark.position.set(-1, 0.03, -6);
  builder.group.add(padMark);
  const padFill = new THREE.CircleGeometry(3.3, 40);
  builder.geometries.push(padFill);
  const padFloor = new THREE.Mesh(padFill, builder.material('#24262b', { roughness: 0.9 }));
  padFloor.rotation.x = -Math.PI / 2;
  padFloor.position.set(-1, 0.02, -6);
  builder.group.add(padFloor);
  for (const [dx, dz, w, d] of [
    [-0.85, 0, 0.26, 1.7],
    [0.85, 0, 0.26, 1.7],
    [0, 0, 1.95, 0.28],
  ] as Array<[number, number, number, number]>) {
    builder.box({ pos: [-1 + dx, 0.035, -6 + dz], size: [w, 0.02, d], color: '#e9e3d3' });
  }
  builder.addPointLight([-1, 1.2, -6], '#7fd4ff', 22, 14);

  // Sky bar under a pergola.
  const pergola = builder.material('#2a2b31', { roughness: 0.6, metalness: 0.4 });
  for (const [px, pz] of [
    [-15.5, -3.5],
    [-8.5, -3.5],
    [-15.5, -9.5],
    [-8.5, -9.5],
  ] as Array<[number, number]>) {
    builder.box({ pos: [px, 1.75, pz], size: [0.16, 3.5, 0.16], material: pergola });
  }
  builder.box({ pos: [-12, 3.5, -6.5], size: [7.6, 0.14, 6.4], material: pergola });
  for (let i = 0; i < 6; i++) {
    builder.box({ pos: [-15.4 + i * 1.35, 3.42, -6.5], size: [0.09, 0.12, 6.2], color: '#3b3d44' });
  }
  builder.addStringLights([-15.4, 3.3, -3.6], [-8.6, 3.3, -9.4], '#ffdfa0', 12, 0.5);
  builder.addStringLights([-15.4, 3.3, -9.4], [-8.6, 3.3, -3.6], '#ffdfa0', 12, 0.5);
  builder.box({ pos: [-12, 0.55, -10.5], size: [6.4, 1.1, 0.9], color: '#2b2a2d', collider: true });
  builder.box({ pos: [-12, 1.14, -10.5], size: [6.7, 0.1, 1.15], material: builder.material('#6b4a2f', { roughness: 0.5 }) });
  builder.sign('SKY BAR', {
    pos: [-12, 2.75, -3.2],
    size: [4.2, 1.2],
    fg: '#ffd400',
    accent: '#ff3ea5',
    sub: 'APERITIVO A 90 METRI',
    rotY: Math.PI,
  });
  builder.addGlow([-12, 2.8, -3.1], '#ffd400', 4.6, 0.35);
  builder.addPointLight([-12, 2.6, -6], '#ffcf8a', 24, 14);
  for (const z of [-9.4, -8, -6.6]) {
    builder.cylinder({ pos: [-8.1, 0.38, z], radiusTop: 0.26, radiusBottom: 0.22, height: 0.76, color: '#39322c' });
  }

  // Rooftop machinery: AC units, ducts, water tank, antenna.
  const metal = builder.material('#4b5057', { roughness: 0.55, metalness: 0.55 });
  const panel = builder.material('#3a3f45', { roughness: 0.7, metalness: 0.3 });
  for (const [x, z, rot] of [
    [12.5, 6.5, 0.12],
    [14.4, 2.2, -0.08],
    [6.5, 10.5, 0.3],
  ] as Array<[number, number, number]>) {
    builder.box({ pos: [x, 0.72, z], size: [2.2, 1.44, 1.66], material: metal, rotY: rot, collider: true, cast: true });
    builder.box({ pos: [x, 1.46, z], size: [2.3, 0.1, 1.76], material: panel, rotY: rot });
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 20), panel);
    builder.geometries.push(fan.geometry);
    fan.position.set(x, 1.52, z);
    fan.rotation.x = Math.PI / 2;
    fan.rotation.z = rot;
    builder.group.add(fan);
    builder.addPointLight([x, 2.4, z], '#8fd8ff', 6, 6);
    builder.addGlow([x, 1.55, z], '#8fd8ff', 1.6, 0.18);
  }
  builder.cylinder({ pos: [11, 2.6, -8.5], radiusTop: 1.55, radiusBottom: 1.55, height: 2.4, material: metal, collider: true });
  builder.cylinder({ pos: [11, 3.82, -8.5], radiusTop: 1.62, radiusBottom: 1.62, height: 0.16, color: '#22262b' });
  for (const [ox, oz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as Array<[number, number]>) {
    builder.box({ pos: [11 + ox, 0.7, -8.5 + oz], size: [0.16, 1.4, 0.16], material: metal });
  }
  builder.box({ pos: [11, 0.05, -8.5], size: [3.1, 0.06, 3.1], color: '#1b1d21' });
  builder.sign('ACQUA', {
    pos: [11, 2.5, -6.9],
    size: [1.7, 0.7],
    bg: '#12161a',
    fg: '#9fc8e0',
    accent: '#4fd7ff',
    sub: 'NON BERE',
  });

  // Antenna with a blinking aircraft light.
  builder.cylinder({ pos: [-14.5, 4.2, 9], radiusTop: 0.06, radiusBottom: 0.13, height: 8.4, material: metal, collider: true });
  for (let i = 0; i < 3; i++) {
    builder.box({ pos: [-14.5, 3 + i * 1.9, 9], size: [1.1 - i * 0.22, 0.07, 0.07], material: metal, rotY: i * 0.6 });
  }
  const beacon = builder.addGlow([-14.5, 8.6, 9], '#ff2f2f', 2.2, 0.8);
  builder.animations.push((time) => {
    const blink = Math.sin(time * 3.4) > 0.55 ? 0.85 : 0.06;
    (beacon.material as THREE.SpriteMaterial).opacity = blink;
  });

  // Rooftop lamps and the lights of the skyline across the terrace.
  for (const [lx, lz] of [
    [-16, 2],
    [16, -2],
    [0, 12],
    [-6, -12],
  ] as Array<[number, number]>) {
    builder.addLamp([lx, 0, lz], '#ffdca8', 22, 3.4, false);
  }
  builder.addStringLights([-16, 4.4, 10], [16, 4.4, 10], '#ffe2b0', 22, 1.1);
  builder.addStringLights([-16, 4.2, -12], [16, 4.2, -12], '#ffe2b0', 22, 1.1);
  builder.addPointLight([0, 5, 2], '#ffd2a8', 34, 26);

  // Greenery in planters + trees.
  builder.addPlanter([-16, 0, 11], 2.4);
  builder.addPlanter([16, 0, 11], 2.4);
  builder.addPlanter([16, 0, -11], 2.2);
  builder.addTree([-16, 0, 11], 5.4, '#21452a');
  builder.addTree([16, 0, 11], 4.8, '#1e3f26');
  builder.addTree([16, 0, -11], 4.4, '#21452a');
  builder.addBench([2, 0, 11], Math.PI);
  builder.addBench([-4, 0, 11], Math.PI);
  builder.addBin([8, 0, 9]);

  // Puddles after the storm.
  builder.addPuddle(-6, 3, 3.4, 1.6, '#8fd8ff', 0.07);
  builder.addPuddle(6, -2, 2.8, 1.3, '#ff4f9a', 0.06);

  // Painted rooftop markings: safety line along the parapet and a landing lane.
  for (const side of [-1, 1]) {
    builder.box({ pos: [0, 0.012, side * 12.2], size: [33, 0.02, 0.16], color: '#b99a1f' });
    builder.box({ pos: [side * 16.2, 0.012, 0], size: [0.16, 0.02, 23], color: '#b99a1f' });
  }
  for (let i = 0; i < 7; i++) {
    builder.box({ pos: [-7 + i * 1.4, 0.012, 8.5], size: [0.8, 0.02, 0.18], color: '#6d6a5e' });
  }
  builder.box({ pos: [0, 0.012, 6.2], size: [10, 0.02, 0.12], color: '#6d6a5e' });

  // Two green towers: the Bosco Verticale silhouette.
  const towerBody = builder.material('#1a1d22', { roughness: 0.9, flat: false });
  for (const [tx, tz, th] of [
    [-32, -18, 68],
    [30, -24, 58],
  ] as Array<[number, number, number]>) {
    builder.box({ pos: [tx, -30 + th / 2, tz], size: [13, th, 13], material: towerBody });
    for (let level = 0; level < 9; level++) {
      const y = -30 + 8 + level * (th / 11);
      builder.box({ pos: [tx, y, tz], size: [14.2, 0.28, 14.2], color: '#2b4a2a' });
      for (let col = 0; col < 3; col++) {
        glowPlane(
          builder,
          [tx - 4.2 + col * 4.2, y + 2.1, tz + 6.6],
          [1.5, 1.6],
          col === 1 ? '#ffd28a' : '#a8d8ff',
          0,
          0.5,
        );
      }
      for (const [ox, oz, w, d] of [
        [7.4, -4.5, 2.2, 2.6],
        [-7.4, 3.5, 2.4, 2.2],
        [4.2, 7.4, 2.6, 2.2],
      ] as Array<[number, number, number, number]>) {
        builder.box({ pos: [tx + ox, y + 0.5, tz + oz], size: [w, 0.7, d], color: '#2c4a2c' });
        builder.box({ pos: [tx + ox, y + 1.05, tz + oz], size: [w * 0.8, 0.8, d * 0.8], color: '#37603a' });
      }
    }
    builder.addGlow([tx, -30 + th * 0.72, tz], '#6cff9e', 6, 0.16);
  }

  return {
    group: builder.group,
    builder,
    spawnPoints: [
      new THREE.Vector3(-13, 0, -11),
      new THREE.Vector3(13, 0, -11),
      new THREE.Vector3(-14, 0, 4),
      new THREE.Vector3(14, 0, 4),
      new THREE.Vector3(-6, 0, -12),
      new THREE.Vector3(6, 0, -12),
      new THREE.Vector3(-8, 0, 9),
      new THREE.Vector3(9, 0, 9),
    ],
    playerStart: new THREE.Vector3(1, 0, 8),
    startYaw: -0.45,
    bossSpawn: new THREE.Vector3(0, 0, -6),
    preview: { position: new THREE.Vector3(10.5, 7.8, 15), lookAt: new THREE.Vector3(-6, 1.6, -7) },
    bounds,
  };
}

/**
 * CHAPTER 2 — PORTA VENEZIA. A wide corso framed by real porticoes: walk under
 * the arches, use the columns as cover, dodge the decorative tram.
 */
export function buildPortaVenezia(physics: Physics, quality: Quality): ArenaBuild {
  const builder = new LevelBuilder(physics, quality);
  const bounds = { minX: -20, maxX: 20, minZ: -13, maxZ: 13 };
  builder.addSky('#05060f', '#2b2430');
  builder.addStars(360);
  builder.addSkyline(88, 46, -8, [12, 34]);
  builder.ground(48, 36, makePlazaTexture(), 0, 6);

  builder.addLights({
    hemiSky: '#9a9fd8',
    hemiGround: '#2a2026',
    hemiIntensity: 1.15,
    moonColor: '#dfe3ff',
    moonIntensity: 2.4,
    moonPosition: [-12, 26, 10],
    shadows: true,
    rimColor: '#ffb35c',
    rimIntensity: 0.75,
    rimPosition: [16, 8, -12],
  });

  const stone = builder.material('#4a4238', { roughness: 0.92 });
  const stoneLight = builder.material('#6b6153', { roughness: 0.88 });
  const shopColors = ['#ff3ea5', '#ffd400', '#4fd7ff', '#ff8a3d'];

  for (const side of [-1, 1]) {
    const x = side * 18.5;
    // Portico roof and back wall with shop windows.
    builder.box({ pos: [x, 4.9, 0], size: [7.5, 0.45, 27], material: stone, receive: true });
    builder.box({ pos: [x + side * 2.9, 2.55, 0], size: [1.6, 5.1, 27], color: '#2b2522', receive: true });
    builder.box({ pos: [x + side * 0.6, 5.4, 0], size: [8.4, 0.5, 27.4], material: stoneLight });
    for (let z = -12; z <= 12; z += 4.8) {
      builder.cylinder({
        pos: [x - side * 2.7, 2.35, z],
        radiusTop: 0.32,
        radiusBottom: 0.4,
        height: 4.7,
        material: stoneLight,
        collider: true,
      });
      builder.box({ pos: [x - side * 2.7, 0.16, z], size: [1.1, 0.32, 1.1], color: '#332e28' });
    }
    for (let i = 0; i < 5; i++) {
      const z = -9.6 + i * 4.8;
      const color = shopColors[(i + (side === 1 ? 1 : 0)) % shopColors.length]!;
      glowPlane(builder, [x - side * 2.6, 2.35, z], [3.2, 2.1], color, side === 1 ? Math.PI / 2 : -Math.PI / 2, 0.42);
      builder.box({
        pos: [x - side * 2.55, 2.35, z],
        size: [0.06, 2.2, 3.3],
        material: builder.material('#1b1916', { roughness: 0.4 }),
      });
      builder.sign(['BOUTIQUE', 'TRAM', 'GELATERIA', 'LIBRI', 'CAFFÈ'][i]!, {
        pos: [x - side * 2.5, 3.9, z],
        size: [2.8, 0.8],
        rotY: side === 1 ? Math.PI / 2 : -Math.PI / 2,
        bg: '#0c0b0e',
        fg: color,
        accent: '#f3efe3',
        sub: 'PORTA VENEZIA',
      });
      builder.addPointLight([x - side * 3.4, 2.6, z], color, 12, 10);
    }
    builder.addLamp([x - side * 4.5, 0, -10], '#ffd28a', 18, 4.6, false);
    builder.addLamp([x - side * 4.5, 0, 8], '#ffd28a', 18, 4.6, false);
  }

  // Tram track and zebra crossing.
  for (const x of [-2.2, -1.5, 1.5, 2.2]) {
    builder.box({ pos: [x, 0.012, 0], size: [0.14, 0.02, 34], color: '#8d8a80' });
  }
  for (let i = 0; i < 6; i++) {
    builder.box({ pos: [-6 + i * 2.4, 0.014, 2], size: [1.4, 0.02, 5.5], color: '#d9d4c6' });
  }
  // Decorative yellow tram beyond the north side.
  builder.box({ pos: [0, 1.75, -17.5], size: [22, 3.2, 2.8], color: '#c9a51b' });
  builder.box({ pos: [0, 3.5, -17.5], size: [22.2, 0.28, 3], color: '#7e6a14' });
  builder.box({ pos: [0, 0.42, -17.5], size: [21, 0.6, 2.6], color: '#1b1c1f' });
  for (let i = 0; i < 7; i++) {
    glowPlane(builder, [-10 + i * 3.2, 2.2, -16.05], [2.2, 1.1], '#ffe7a8', Math.PI, 0.85);
  }
  builder.addGlow([0, 2.4, -15.8], '#ffd28a', 7, 0.3);

  // Kiosks, benches, planters, bins.
  builder.addAwning([8, 3.2, 7], 5.4, 2.6, '#8c2a52');
  builder.box({ pos: [8, 1.3, 8.6], size: [4.6, 2.6, 2.2], color: '#2a2320', collider: true });
  builder.sign('EDICOLA', {
    pos: [8, 2.55, 9.72],
    size: [3.2, 1.1],
    bg: '#101014',
    fg: '#ffd400',
    accent: '#ff3ea5',
    sub: 'GIORNALI E GRATTA',
  });
  builder.addPointLight([8, 2.7, 8], '#ffd28a', 18, 12);
  builder.addBench([-10, 0, 8], 0);
  builder.addBench([10, 0, -8], Math.PI);
  builder.addPlanter([-11, 0, -4], 1.8);
  builder.addPlanter([11, 0, 4], 1.8);
  builder.addBin([-9, 0, 2]);
  builder.addBin([9, 0, 2]);
  builder.addPuddle(-6, -3, 3.4, 1.5, '#4fd7ff', 0.07);
  builder.addPuddle(7, 6, 3, 1.4, '#ff3ea5', 0.06);
  builder.addStringLights([-13, 5.2, -6], [13, 5.2, -6], '#ffe6b0', 18, 1.2);
  builder.addStringLights([-13, 5.2, 6], [13, 5.2, 6], '#ffe6b0', 18, 1.2);
  builder.boundary(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, 1.5);

  return {
    group: builder.group,
    builder,
    spawnPoints: [
      new THREE.Vector3(-15, 0, -9),
      new THREE.Vector3(15, 0, -9),
      new THREE.Vector3(-15, 0, 9),
      new THREE.Vector3(15, 0, 9),
      new THREE.Vector3(-6, 0, -11),
      new THREE.Vector3(6, 0, -11),
      new THREE.Vector3(-8, 0, 11),
      new THREE.Vector3(8, 0, 11),
    ],
    playerStart: new THREE.Vector3(0, 0, 9),
    bossSpawn: new THREE.Vector3(0, 0, -9),
    preview: { position: new THREE.Vector3(0, 6.6, 23), lookAt: new THREE.Vector3(0, 2.4, -8) },
    bounds,
  };
}

/**
 * CHAPTER 2 — PARCO SEMPIONE. Open grass, low hedges, a sport court and the
 * Castello silhouette in the fog. The central clearing is the fight stage.
 */
export function buildSempione(physics: Physics, quality: Quality): ArenaBuild {
  const builder = new LevelBuilder(physics, quality);
  const bounds = { minX: -21, maxX: 21, minZ: -14, maxZ: 14 };
  builder.addSky('#050612', '#202a2a');
  builder.addStars(520);
  builder.addSkyline(95, 44, -10, [10, 30]);
  builder.ground(50, 38, makeGrassTexture(), 0, 7);

  builder.addLights({
    hemiSky: '#8fa4d8',
    hemiGround: '#1d2418',
    hemiIntensity: 1.3,
    moonColor: '#e2e8ff',
    moonIntensity: 2.6,
    moonPosition: [16, 28, 12],
    shadows: true,
    rimColor: '#6cff9e',
    rimIntensity: 0.55,
    rimPosition: [-18, 7, -14],
  });

  // Gravel paths crossing the park.
  const path = builder.material('#5b4a37', { roughness: 0.95 });
  builder.box({ pos: [0, 0.012, 0], size: [6.4, 0.02, 38], material: path });
  builder.box({ pos: [0, 0.014, 0], size: [44, 0.02, 6], material: path });
  builder.box({ pos: [0, 0.016, 0], size: [4.2, 0.025, 4.2], material: builder.material('#6b5843', { roughness: 0.9 }) });

  // Castello Sforzesco silhouette.
  const brick = builder.material('#5a3a32', { roughness: 0.95 });
  const brickDark = builder.material('#422a26', { roughness: 0.95 });
  builder.box({ pos: [0, 7, -27], size: [40, 14, 9], material: brick, receive: true });
  builder.box({ pos: [0, 14.4, -27], size: [41, 1.6, 9.6], material: brickDark });
  for (const x of [-18, -6, 6, 18]) {
    builder.box({ pos: [x, 9.5, -25.6], size: [6, 19, 7], material: brick });
    builder.box({ pos: [x, 19.4, -25.6], size: [6.6, 0.8, 7.6], material: brickDark });
    for (let i = 0; i < 4; i++) {
      builder.box({ pos: [x - 2.2 + i * 1.5, 20.1, -22.2], size: [0.8, 1.2, 0.8], material: brickDark });
    }
    for (let row = 0; row < 2; row++) {
      glowPlane(builder, [x, 11 + row * 4.4, -22.4], [1.2, 1.8], '#ffd28a', 0, 0.5);
    }
  }
  builder.addGlow([0, 12, -22], '#ffd6a0', 16, 0.18);

  // Trees around the clearing (instanced geometry would be next, these are cheap).
  const treeSpots: Array<[number, number, number]> = [
    [-18, -10, 5.4], [-14, 6, 4.8], [-19, 11, 5.8], [16, -11, 5.2], [19, 9, 5.6],
    [8, 12, 4.4], [-7, 12, 4.2], [13, 4, 4.6], [-12, -4, 3.6], [5, -11, 4.8],
  ];
  for (const [x, z, height] of treeSpots) builder.addTree([x, 0, z], height);

  // Low hedges as readable obstacles.
  builder.addHedge([-11, -7], [-5, -7], 0.9);
  builder.addHedge([5, 7], [11, 7], 0.9);
  builder.addHedge([14, -4], [14, 2], 0.85);
  builder.addHedge([-14, 2], [-14, -2], 0.85);

  // Sport court with painted lines and two goals.
  const court = builder.material('#3b4a3b', { roughness: 0.92 });
  builder.box({ pos: [-11, 0.01, 9], size: [13, 0.02, 8.5], material: court });
  for (const [x, z, w, d] of [
    [-11, 9, 12, 0.12],
    [-11, 5.2, 12, 0.12],
    [-17, 9, 0.12, 7.7],
    [-5, 9, 0.12, 7.7],
    [-11, 7.1, 12, 0.1],
  ] as Array<[number, number, number, number]>) {
    builder.box({ pos: [x, 0.025, z], size: [w, 0.02, d], color: '#d9d4c6' });
  }
  for (const x of [-16.2, -5.8]) {
    builder.cylinder({ pos: [x, 1.1, 5.2], radiusTop: 0.08, radiusBottom: 0.08, height: 2.2, color: '#e8e2d2' });
    builder.cylinder({ pos: [x, 1.1, 12.8], radiusTop: 0.08, radiusBottom: 0.08, height: 2.2, color: '#e8e2d2' });
    builder.box({ pos: [x, 2.2, 9], size: [0.1, 0.1, 7.6], color: '#e8e2d2' });
  }

  // Kiosk / bar at the north-west corner.
  builder.box({ pos: [-16, 1.2, -8], size: [4.6, 2.4, 2.6], color: '#2b2a24', collider: true });
  builder.addAwning([-16, 2.6, -8], 5.2, 3, '#2f6a52');
  builder.sign('CHIOSCO', {
    pos: [-16, 2.05, -6.65],
    size: [3, 1],
    bg: '#101014',
    fg: '#ffd400',
    accent: '#6cff9e',
    sub: 'PANINI E PANCHINE',
  });
  builder.addPointLight([-16, 2.4, -6.4], '#ffd28a', 20, 12);
  builder.addStringLights([-18, 4.6, -3], [18, 4.6, -3], '#ffe2b0', 20, 1.3);

  builder.addBench([-3, 0, 3.6], 0);
  builder.addBench([3, 0, -3.6], Math.PI);
  builder.addBench([-18, 0, 0], Math.PI / 2);
  builder.addBench([18, 0, -2], -Math.PI / 2);
  builder.addPlanter([12, 0, -8], 2);
  builder.addPlanter([-8, 0, 9], 2);
  builder.addBin([-6, 0, 4]);
  builder.addBin([6, 0, -4]);
  builder.addPuddle(-8, 6, 3.2, 1.5, '#6cff9e', 0.06);
  builder.addPuddle(9, -5, 3.4, 1.6, '#ffd400', 0.05);
  builder.boundary(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, 1.4);

  return {
    group: builder.group,
    builder,
    spawnPoints: [
      new THREE.Vector3(-16, 0, -11),
      new THREE.Vector3(16, 0, -11),
      new THREE.Vector3(-17, 0, 6),
      new THREE.Vector3(17, 0, 6),
      new THREE.Vector3(-8, 0, -12),
      new THREE.Vector3(8, 0, -12),
      new THREE.Vector3(-10, 0, 11),
      new THREE.Vector3(10, 0, 11),
    ],
    playerStart: new THREE.Vector3(0, 0, 10),
    bossSpawn: new THREE.Vector3(0, 0, -10),
    preview: { position: new THREE.Vector3(-17, 9.5, 21), lookAt: new THREE.Vector3(2, 2.2, -10) },
    bounds,
  };
}

/**
 * CHAPTER 2 — ISOLA. A construction site under the new towers: containers,
 * scaffolding, a crane silhouette and one continuous, flat fight floor.
 */
export function buildIsola(physics: Physics, quality: Quality): ArenaBuild {
  const builder = new LevelBuilder(physics, quality);
  const bounds = { minX: -18, maxX: 18, minZ: -13, maxZ: 13 };
  builder.addSky('#04050d', '#221d2c');
  builder.addStars(340);
  builder.addSkyline(82, 48, -14, [18, 46]);
  builder.ground(44, 34, makeDirtTexture(), 0, 5);

  builder.addLights({
    hemiSky: '#8b92cf',
    hemiGround: '#2a2119',
    hemiIntensity: 1.15,
    moonColor: '#d9e0ff',
    moonIntensity: 2.2,
    moonPosition: [-14, 24, 10],
    shadows: true,
    rimColor: '#ffb347',
    rimIntensity: 1.0,
    rimPosition: [14, 6, 12],
  });

  // Contemporary towers behind the site, lit windows.
  const tower = builder.material('#1c1f26', { roughness: 0.9 });
  for (const [tx, tz, w, h] of [
    [-26, -24, 16, 46],
    [-4, -28, 13, 58],
    [18, -26, 15, 40],
  ] as Array<[number, number, number, number]>) {
    builder.box({ pos: [tx, h / 2, tz], size: [w, h, 12], material: tower });
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 4; col++) {
        if ((row + col) % 3 === 0) continue;
        glowPlane(
          builder,
          [tx - w / 2 + 1.6 + col * ((w - 3.2) / 3), 4 + row * (h / 9), tz + 6.05],
          [1.3, 1.8],
          col % 2 === 0 ? '#ffd28a' : '#9fc8e0',
          0,
          0.45,
        );
      }
    }
  }

  // Scaffolding frames along both sides.
  const scaffold = builder.material('#6b6f76', { roughness: 0.5, metalness: 0.5 });
  for (const side of [-1, 1]) {
    const x = side * 16;
    for (let z = -12; z <= 12; z += 4) {
      builder.cylinder({ pos: [x, 2.6, z], radiusTop: 0.07, radiusBottom: 0.07, height: 5.2, material: scaffold });
      builder.box({ pos: [x, 2.4, z], size: [2.6, 0.1, 0.1], material: scaffold });
      builder.box({ pos: [x, 4.4, z], size: [2.6, 0.1, 0.1], material: scaffold });
    }
    builder.box({ pos: [x, 5.2, 0], size: [1.2, 0.12, 26], material: builder.material('#8a7a5c', { roughness: 0.9 }) });
    builder.addPointLight([x - side * 1.2, 3.4, 0], '#ffb45c', 14, 12);
  }

  // Containers as solid cover.
  const containers: Array<[number, number, number, string]> = [
    [-12, -9, 0.1, '#2f5a72'],
    [-11.6, -7, -0.1, '#8c3b2f'],
    [12, 8, Math.PI / 2, '#7a6a2a'],
  ];
  for (const [x, z, rot, color] of containers) {
    builder.box({ pos: [x, 1.3, z], size: [6, 2.6, 2.6], color, rotY: rot, collider: true, cast: true });
    builder.box({ pos: [x, 2.66, z], size: [6.2, 0.12, 2.8], color: '#22262b', rotY: rot });
    for (let i = 0; i < 6; i++) {
      builder.box({ pos: [x - 2.5 + i, 1.3, z + 1.34], size: [0.06, 2.2, 0.04], color: '#1c2024', rotY: rot });
    }
  }

  // Crane silhouette beyond the fence.
  builder.cylinder({ pos: [-20, 12, -18], radiusTop: 0.3, radiusBottom: 0.5, height: 24, color: '#4d4a3e' });
  builder.box({ pos: [-12, 23.6, -18], size: [18, 0.5, 0.7], color: '#4d4a3e' });
  builder.box({ pos: [-20, 23.9, -18], size: [1.4, 1.4, 1.4], color: '#3a3830' });
  builder.box({ pos: [-4.5, 22.2, -18], size: [0.08, 2.4, 0.08], color: '#6b6758' });
  builder.addGlow([-4.5, 20.6, -18], '#ff2f2f', 1.8, 0.7);

  // Barriers, cones, pallets.
  const barrier = builder.material('#d9d4c6', { roughness: 0.8 });
  for (const [x, z, rot] of [
    [-6, 6, 0.2],
    [4, -6, -0.15],
    [10, 3, 0.4],
  ] as Array<[number, number, number]>) {
    builder.box({ pos: [x, 0.55, z], size: [3.4, 0.24, 0.9], material: barrier, rotY: rot });
    builder.box({ pos: [x, 0.55, z], size: [3.4, 0.25, 0.9], color: '#c8452e', rotY: rot });
    for (const ox of [-1.4, 1.4]) {
      builder.box({ pos: [x + ox, 0.28, z], size: [0.1, 0.56, 0.8], color: '#c8452e', rotY: rot });
    }
  }
  const cone = builder.material('#ff6a1e', { roughness: 0.7 });
  for (const [x, z] of [[-2, 8], [7, -9], [-14, 3], [14, -4]] as Array<[number, number]>) {
    builder.cylinder({ pos: [x, 0.28, z], radiusTop: 0.06, radiusBottom: 0.26, height: 0.56, material: cone });
  }
  builder.addStringLights([-14, 4.4, 10], [14, 4.4, 10], '#ffe0a8', 16, 1.1);
  builder.addStringLights([-14, 4.2, -10], [14, 4.2, -10], '#ffe0a8', 16, 1.1);
  builder.addLamp([-8, 0, 11], '#ffcf8a', 22, 5, false);
  builder.addLamp([9, 0, 11], '#ffcf8a', 22, 5, false);
  builder.addPuddle(-3, 4, 3.2, 1.6, '#ffb347', 0.06);
  builder.addPuddle(5, 5, 2.8, 1.4, '#9fc8e0', 0.05);
  builder.boundary(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, 1.5);

  return {
    group: builder.group,
    builder,
    spawnPoints: [
      new THREE.Vector3(-15, 0, -11),
      new THREE.Vector3(15, 0, -11),
      new THREE.Vector3(-15, 0, 6),
      new THREE.Vector3(15, 0, 6),
      new THREE.Vector3(-6, 0, -12),
      new THREE.Vector3(6, 0, -12),
      new THREE.Vector3(-8, 0, 11),
      new THREE.Vector3(9, 0, 11),
    ],
    playerStart: new THREE.Vector3(0, 0, 9),
    startYaw: -0.4,
    bossSpawn: new THREE.Vector3(0, 0, -9),
    preview: { position: new THREE.Vector3(17, 7.8, 19), lookAt: new THREE.Vector3(-3, 2.4, -8) },
    bounds,
  };
}

/**
 * CHAPTER 2 — DARSENA. Open waterfront with a lighthouse tower, market stalls,
 * warm lights and water beyond a solid quay.
 */
export function buildDarsena(physics: Physics, quality: Quality): ArenaBuild {
  const builder = new LevelBuilder(physics, quality);
  const bounds = { minX: -20, maxX: 20, minZ: -13, maxZ: 13 };
  builder.addSky('#04060f', '#241d30');
  builder.addStars(420);
  builder.addSkyline(86, 44, -8, [12, 36]);
  builder.ground(46, 36, makeCobbleTexture(), 0, 4.5);

  builder.addLights({
    hemiSky: '#94a0d8',
    hemiGround: '#241d24',
    hemiIntensity: 1.2,
    moonColor: '#dfe6ff',
    moonIntensity: 2.4,
    moonPosition: [14, 26, 12],
    shadows: true,
    rimColor: '#4fd7ff',
    rimIntensity: 0.9,
    rimPosition: [-18, 8, 12],
  });

  // Water basin beyond the south quay.
  const waterGeo = new THREE.PlaneGeometry(54, 26);
  builder.geometries.push(waterGeo);
  const water = new THREE.Mesh(waterGeo, builder.material('#0b1a24', { roughness: 0.15, metalness: 0.9, flat: false }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.55, 28);
  builder.group.add(water);
  const rippleTex = builder.texture(makeWaterTexture());
  const rippleMat = new THREE.MeshBasicMaterial({
    map: rippleTex,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  builder.materials.push(rippleMat);
  const rippleGeo = new THREE.PlaneGeometry(54, 26);
  builder.geometries.push(rippleGeo);
  const ripples = new THREE.Mesh(rippleGeo, rippleMat);
  ripples.rotation.x = -Math.PI / 2;
  ripples.position.set(0, -0.48, 28);
  builder.group.add(ripples);
  builder.animations.push((time) => {
    rippleTex.offset.set(time * 0.01, time * 0.04);
  });
  builder.box({ pos: [0, 0.3, 15.4], size: [44, 0.6, 1], color: '#3a352f' });
  builder.box({ pos: [0, 0.62, 15.4], size: [44.2, 0.08, 1.1], color: '#55504a' });
  builder.addFence([-19, 14.4], [-1, 14.4], 1.05);
  builder.addFence([3, 14.4], [19, 14.4], 1.05);

  // Lighthouse tower landmark.
  const towerMat = builder.material('#4a3a32', { roughness: 0.9 });
  builder.cylinder({ pos: [-13, 4.2, -7], radiusTop: 1.5, radiusBottom: 2.1, height: 8.4, material: towerMat, collider: true, segments: 10 });
  builder.cylinder({ pos: [-13, 8.6, -7], radiusTop: 1.7, radiusBottom: 1.7, height: 0.5, color: '#2b2622' });
  builder.cylinder({ pos: [-13, 9.7, -7], radiusTop: 0.9, radiusBottom: 1.2, height: 1.8, color: '#ffdf9a', segments: 8 });
  builder.addGlow([-13, 9.8, -7], '#ffe6a8', 8, 0.55);
  builder.addLightCone([-13, 8.8, -7], '#ffe6a8', 5.5, 2.4, 0.07);
  builder.sign('DARSENA', {
    pos: [-13, 4.4, -4.82],
    size: [2.6, 1],
    bg: '#0c0d10',
    fg: '#ffd400',
    accent: '#4fd7ff',
    sub: 'NAVIGLIO GRANDE',
  });

  // Market stalls under striped awnings.
  for (const [x, color, label] of [
    [-15, '#c8452e', 'PESCE'],
    [-5, '#2f6a72', 'FRUTTA'],
    [5, '#7a6a2a', 'PANINI'],
    [15, '#4a3358', 'VINILE'],
  ] as Array<[number, string, string]>) {
    const z = -10.5;
    builder.box({ pos: [x, 0.55, z], size: [5, 1.1, 2.2], color: '#2b2a26', collider: true });
    builder.addAwning([x, 2.9, z], 5.6, 3, color);
    for (const ox of [-2.2, 2.2]) {
      builder.box({ pos: [x + ox, 1.45, z], size: [0.1, 2.9, 0.1], color: '#3a3730' });
    }
    builder.sign(label, {
      pos: [x, 2.1, z + 1.16],
      size: [2.4, 0.7],
      bg: '#101014',
      fg: '#ffd400',
      accent: color,
      sub: 'APERTO',
    });
    builder.addPointLight([x, 2.6, z + 1.2], '#ffd28a', 16, 12);
  }

  // Café tables and benches along the quay.
  for (const [x, z] of [[-8, 7], [8, 7], [-16, 5]] as Array<[number, number]>) {
    builder.cylinder({ pos: [x, 0.38, z], radiusTop: 0.3, radiusBottom: 0.24, height: 0.76, color: '#26282c' });
    builder.cylinder({ pos: [x, 0.78, z], radiusTop: 0.7, radiusBottom: 0.7, height: 0.08, color: '#4a3a2a', collider: true });
    builder.addUmbrella([x, 0, z], x < 0 ? '#c8452e' : '#2f6a72');
  }
  builder.addBench([-18, 0, 11], Math.PI / 2);
  builder.addBench([18, 0, 11], -Math.PI / 2);
  builder.addBin([-4, 0, 3]);
  builder.addBin([6, 0, -3]);
  builder.addStringLights([-18, 5, 2], [18, 5, 2], '#ffe6a8', 20, 1.2);
  builder.addStringLights([-18, 5, -5], [18, 5, -5], '#ffd6a0', 20, 1.2);
  builder.addLamp([-17, 0, 10], '#ffcf8a', 24, 5, false);
  builder.addLamp([17, 0, 10], '#ffcf8a', 24, 5, false);
  builder.addPuddle(-3, 8, 4.4, 1.9, '#4fd7ff', 0.06);
  builder.addPuddle(9, 4, 3.4, 1.6, '#ff3ea5', 0.06);

  // Moored boats on the basin.
  for (const [bx, bz] of [[-12, 20], [4, 21], [14, 19]] as Array<[number, number]>) {
    builder.box({ pos: [bx, 0.05, bz], size: [1.6, 0.5, 5], color: '#1b2026' });
    builder.box({ pos: [bx, 0.32, bz], size: [1.3, 0.08, 4.6], color: '#4a3b2c' });
    builder.addGlow([bx, 0.6, bz], '#ffcf8a', 2, 0.22);
  }

  builder.boundary(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, 1.5);

  return {
    group: builder.group,
    builder,
    spawnPoints: [
      new THREE.Vector3(-15, 0, -9),
      new THREE.Vector3(15, 0, -9),
      new THREE.Vector3(-15, 0, 6),
      new THREE.Vector3(15, 0, 6),
      new THREE.Vector3(-6, 0, 11),
      new THREE.Vector3(6, 0, 11),
      new THREE.Vector3(-9, 0, 2),
      new THREE.Vector3(9, 0, 2),
    ],
    playerStart: new THREE.Vector3(2, 0, 8),
    startYaw: -0.5,
    bossSpawn: new THREE.Vector3(0, 0, -8),
    preview: { position: new THREE.Vector3(23, 8.4, 19), lookAt: new THREE.Vector3(-4, 2.2, -7) },
    bounds,
  };
}
