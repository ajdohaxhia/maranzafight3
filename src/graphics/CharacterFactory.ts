import * as THREE from 'three';

export const JOINT_NAMES = [
  'body',
  'torso',
  'head',
  'armL',
  'elbowL',
  'armR',
  'elbowR',
  'legL',
  'kneeL',
  'legR',
  'kneeR',
] as const;

export type JointName = (typeof JOINT_NAMES)[number];
export type CharacterLook = 'player' | 'base' | 'puffer' | 'turbo' | 'boss';

export interface CharacterVisual {
  /** World transform: position at feet, rotation = facing yaw. */
  root: THREE.Group;
  /** Animated inner group (lean, fall, offsets). */
  visual: THREE.Group;
  joints: Record<JointName, THREE.Group>;
  materials: THREE.MeshStandardMaterial[];
  height: number;
  radius: number;
  scale: number;
}

interface Outfit {
  skin: string;
  hair: string;
  primary: string;
  secondary: string;
  accent: string;
  pants: string;
  shoes: string;
  sole: string;
  bag: string;
  metal: string;
}

interface MeshOptions {
  pos?: [number, number, number];
  scale?: [number, number, number];
  rot?: [number, number, number];
  parent?: THREE.Object3D;
  cast?: boolean;
}

const PLAYER_OUTFIT: Outfit = {
  skin: '#d3a077',
  hair: '#241b17',
  primary: '#f2c400',
  secondary: '#141419',
  accent: '#e8e2d3',
  pants: '#232735',
  shoes: '#f1ece1',
  sole: '#c9302c',
  bag: '#1a1a20',
  metal: '#e7c04a',
};

const BASE_OUTFITS: Outfit[] = [
  {
    skin: '#c99062',
    hair: '#1d1713',
    primary: '#2456e0',
    secondary: '#f0ece0',
    accent: '#ffffff',
    pants: '#1c2338',
    shoes: '#f4f2ea',
    sole: '#d6d2c4',
    bag: '#121317',
    metal: '#e5bf45',
  },
  {
    skin: '#9c6a45',
    hair: '#120f0d',
    primary: '#c62b2b',
    secondary: '#f0ece0',
    accent: '#ffcf3d',
    pants: '#221d22',
    shoes: '#161616',
    sole: '#e7e3d8',
    bag: '#2a2b31',
    metal: '#e5bf45',
  },
  {
    skin: '#e0af83',
    hair: '#3a2a1d',
    primary: '#2f9c63',
    secondary: '#0f1212',
    accent: '#f3f0e6',
    pants: '#3a3f36',
    shoes: '#f3f0e6',
    sole: '#2a2a2a',
    bag: '#1b1f2c',
    metal: '#d9b63a',
  },
];

const PUFFER_OUTFITS: Outfit[] = [
  {
    skin: '#b57a4f',
    hair: '#1a1512',
    primary: '#20394a',
    secondary: '#101418',
    accent: '#e8642b',
    pants: '#191c22',
    shoes: '#101114',
    sole: '#d8d2c2',
    bag: '#15161a',
    metal: '#e5bf45',
  },
  {
    skin: '#e2b286',
    hair: '#2c2018',
    primary: '#5a2c20',
    secondary: '#171512',
    accent: '#d7dfc9',
    pants: '#24211c',
    shoes: '#1c1a18',
    sole: '#e9e4d6',
    bag: '#12110f',
    metal: '#e5bf45',
  },
];

const TURBO_OUTFITS: Outfit[] = [
  {
    skin: '#c78c60',
    hair: '#181310',
    primary: '#f2f0e7',
    secondary: '#212121',
    accent: '#ff3d2e',
    pants: '#2b2b2f',
    shoes: '#f4f2ea',
    sole: '#202020',
    bag: '#15151a',
    metal: '#c9c9c9',
  },
  {
    skin: '#8d5c3b',
    hair: '#0f0d0b',
    primary: '#d8d423',
    secondary: '#171717',
    accent: '#ffffff',
    pants: '#1e2226',
    shoes: '#181818',
    sole: '#e7e3d8',
    bag: '#232330',
    metal: '#d8b73d',
  },
];

/** Indexed by BossProfile.variant: borsello, tetti, buttafuori, trainer, dj, consiglio. */
const BOSS_OUTFITS: Outfit[] = [
  {
    skin: '#b37a4f',
    hair: '#16110d',
    primary: '#f0e8d6',
    secondary: '#191512',
    accent: '#b31515',
    pants: '#20201f',
    shoes: '#111111',
    sole: '#e9c14a',
    bag: '#17120e',
    metal: '#ffcf3d',
  },
  {
    skin: '#8f6444',
    hair: '#120f0c',
    primary: '#2b2140',
    secondary: '#15121c',
    accent: '#8a5cff',
    pants: '#191722',
    shoes: '#0e0d12',
    sole: '#b99b4a',
    bag: '#141019',
    metal: '#ffd76a',
  },
  {
    skin: '#a97850',
    hair: '#1b1510',
    primary: '#1d1e22',
    secondary: '#101114',
    accent: '#c92323',
    pants: '#17181c',
    shoes: '#0d0d0f',
    sole: '#3c3c3c',
    bag: '#121214',
    metal: '#cfd4da',
  },
  {
    skin: '#c28a5d',
    hair: '#241a12',
    primary: '#1f5a4a',
    secondary: '#12251f',
    accent: '#9dff4a',
    pants: '#1a2320',
    shoes: '#e4e4e0',
    sole: '#7a7a72',
    bag: '#15201b',
    metal: '#f0e8d6',
  },
  {
    skin: '#b07a52',
    hair: '#171310',
    primary: '#23202e',
    secondary: '#131118',
    accent: '#4fe6ff',
    pants: '#1c1a24',
    shoes: '#101014',
    sole: '#ff3ea5',
    bag: '#181420',
    metal: '#ffd400',
  },
  {
    skin: '#a06c48',
    hair: '#141110',
    primary: '#26262c',
    secondary: '#15151a',
    accent: '#c9a227',
    pants: '#1d1d22',
    shoes: '#0f0f12',
    sole: '#8a7424',
    bag: '#141419',
    metal: '#ffd35a',
  },
];

function pick<T>(list: T[], variant: number): T {
  return list[Math.abs(variant) % list.length] as T;
}

export class CharacterFactory {
  private readonly geometryCache = new Map<string, THREE.BufferGeometry>();

  private geom(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geo = this.geometryCache.get(key);
    if (!geo) {
      geo = factory();
      this.geometryCache.set(key, geo);
    }
    return geo;
  }

  private sphereGeo(): THREE.BufferGeometry {
    return this.geom('sphere', () => new THREE.SphereGeometry(1, 12, 9));
  }

  private lowSphereGeo(): THREE.BufferGeometry {
    return this.geom('sphere-low', () => new THREE.IcosahedronGeometry(1, 1));
  }

  private boxGeo(): THREE.BufferGeometry {
    return this.geom('box', () => new THREE.BoxGeometry(1, 1, 1));
  }

  private cylinderGeo(): THREE.BufferGeometry {
    return this.geom('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1));
  }

  private taperedGeo(top: number, bottom: number): THREE.BufferGeometry {
    const key = `taper-${top}-${bottom}`;
    return this.geom(key, () => new THREE.CylinderGeometry(top, bottom, 1, 10, 1));
  }

  private capsuleGeo(radius: number, length: number): THREE.BufferGeometry {
    return this.geom(
      `capsule-${radius.toFixed(3)}-${length.toFixed(3)}`,
      () => new THREE.CapsuleGeometry(radius, length, 3, 8),
    );
  }

  private coneGeo(): THREE.BufferGeometry {
    return this.geom('cone', () => new THREE.ConeGeometry(1, 1, 6));
  }

  private torusGeo(): THREE.BufferGeometry {
    return this.geom('torus', () => new THREE.TorusGeometry(1, 0.18, 5, 12));
  }

  private domeGeo(): THREE.BufferGeometry {
    return this.geom(
      'dome',
      () => new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.58),
    );
  }

  private mat(
    materials: THREE.MeshStandardMaterial[],
    color: string,
    opts: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number } = {},
  ): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: opts.roughness ?? 0.72,
      metalness: opts.metalness ?? 0.05,
      flatShading: true,
    });
    if (opts.emissive) {
      material.emissive = new THREE.Color(opts.emissive);
      material.emissiveIntensity = opts.emissiveIntensity ?? 0.4;
    }
    materials.push(material);
    return material;
  }

  private add(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    opts: MeshOptions = {},
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    if (opts.pos) mesh.position.set(...opts.pos);
    if (opts.scale) mesh.scale.set(...opts.scale);
    if (opts.rot) mesh.rotation.set(...opts.rot);
    mesh.castShadow = opts.cast ?? true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private group(parent: THREE.Object3D, pos: [number, number, number]): THREE.Group {
    const g = new THREE.Group();
    g.position.set(...pos);
    parent.add(g);
    return g;
  }

  create(look: CharacterLook, variant = 0): CharacterVisual {
    const materials: THREE.MeshStandardMaterial[] = [];
    const outfit =
      look === 'player'
        ? PLAYER_OUTFIT
        : look === 'boss'
          ? pick(BOSS_OUTFITS, variant)
          : look === 'puffer'
              ? pick(PUFFER_OUTFITS, variant)
              : look === 'turbo'
                ? pick(TURBO_OUTFITS, variant)
                : pick(BASE_OUTFITS, variant);

    const scale = look === 'boss' ? 1.24 : look === 'puffer' ? 1.1 : look === 'turbo' ? 0.96 : 1;

    const root = new THREE.Group();
    root.name = `character-${look}`;
    const visual = new THREE.Group();
    visual.scale.setScalar(scale);
    root.add(visual);

    const skinMat = this.mat(materials, outfit.skin, { roughness: 0.82 });
    const hairMat = this.mat(materials, outfit.hair, { roughness: 0.95 });
    const primaryMat = this.mat(materials, outfit.primary, { roughness: 0.7 });
    const secondaryMat = this.mat(materials, outfit.secondary, { roughness: 0.8 });
    const accentMat = this.mat(materials, outfit.accent, { roughness: 0.65 });
    const pantsMat = this.mat(materials, outfit.pants, { roughness: 0.88 });
    const shoeMat = this.mat(materials, outfit.shoes, { roughness: 0.55 });
    const soleMat = this.mat(materials, outfit.sole, { roughness: 0.6 });
    const bagMat = this.mat(materials, outfit.bag, { roughness: 0.85 });
    const metalMat = this.mat(materials, outfit.metal, { roughness: 0.28, metalness: 0.85 });
    const darkMat = this.mat(materials, '#0c0c0f', { roughness: 0.35 });
    const lensMat = this.mat(materials, '#0a0a0c', {
      roughness: 0.15,
      metalness: 0.4,
      emissive: '#1b2a33',
      emissiveIntensity: 0.5,
    });
    const whiteMat = this.mat(materials, '#f7f4ea', { roughness: 0.5 });

    // ── Body ────────────────────────────────────────────────────────────
    const body = this.group(visual, [0, 0.92, 0]);
    const torso = this.group(body, [0, 0.08, 0]);
    const head = this.group(torso, [0, 0.62, 0]);

    this.add(body, this.sphereGeo(), pantsMat, { scale: [0.19, 0.14, 0.15], pos: [0, -0.01, 0] });

    // Torso silhouette changes with the archetype.
    if (look === 'puffer') {
      this.add(torso, this.sphereGeo(), primaryMat, { scale: [0.35, 0.52, 0.27], pos: [0, 0.25, 0] });
      for (let i = 0; i < 4; i++) {
        this.add(torso, this.torusGeo(), primaryMat, {
          scale: [0.33 - i * 0.012, 0.33 - i * 0.012, 0.16],
          pos: [0, 0.07 + i * 0.12, 0],
          rot: [Math.PI / 2, 0, 0],
        });
      }
      this.add(torso, this.cylinderGeo(), accentMat, {
        scale: [0.155, 0.1, 0.15],
        pos: [0, 0.5, 0],
      });
      this.add(torso, this.boxGeo(), secondaryMat, { scale: [0.045, 0.48, 0.02], pos: [0, 0.24, 0.265] });
    } else if (look === 'boss') {
      this.add(torso, this.sphereGeo(), primaryMat, { scale: [0.34, 0.34, 0.26], pos: [0, 0.26, 0] });
      this.add(torso, this.sphereGeo(), accentMat, { scale: [0.13, 0.28, 0.04], pos: [0, 0.28, 0.245] });
      this.add(torso, this.boxGeo(), secondaryMat, { scale: [0.06, 0.46, 0.02], pos: [0, 0.26, 0.258] });
      this.add(torso, this.cylinderGeo(), secondaryMat, { scale: [0.12, 0.14, 0.12], pos: [0, 0.51, 0] });
      // Fur collar and shoulders.
      const furMat = this.mat(materials, '#d9cbb2', { roughness: 1 });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const radius = 0.3 + (i % 3) * 0.05;
        this.add(torso, this.coneGeo(), furMat, {
          scale: [0.075, 0.22 + (i % 4) * 0.04, 0.075],
          pos: [Math.cos(a) * radius, 0.48 + (i % 2) * 0.035, Math.sin(a) * radius * 0.75],
          rot: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.6],
        });
      }
    } else {
      this.add(torso, this.taperedGeo(0.3, 0.235), primaryMat, { scale: [1, 0.52, 0.86], pos: [0, 0.26, 0] });
      this.add(torso, this.sphereGeo(), primaryMat, { scale: [0.28, 0.14, 0.22], pos: [0, 0.49, 0] });
      this.add(torso, this.boxGeo(), accentMat, { scale: [0.03, 0.46, 0.018], pos: [0, 0.25, 0.235] });
      if (look === 'turbo') {
        // cropped hoodie + visible shirt
        this.add(torso, this.cylinderGeo(), accentMat, { scale: [0.19, 0.14, 0.16], pos: [0, -0.02, 0] });
        this.add(torso, this.torusGeo(), accentMat, {
          scale: [0.11, 0.11, 0.09],
          pos: [0, 0.5, -0.02],
          rot: [Math.PI / 2, 0, 0],
        });
      } else {
        this.add(torso, this.boxGeo(), secondaryMat, { scale: [0.44, 0.075, 0.02], pos: [0, 0.46, 0.242] });
        this.add(torso, this.boxGeo(), secondaryMat, { scale: [0.036, 0.16, 0.022], pos: [0.18, 0.24, 0.235] });
        this.add(torso, this.boxGeo(), secondaryMat, { scale: [0.036, 0.16, 0.022], pos: [-0.18, 0.24, 0.235] });
      }
      if (look === 'player') {
        const scarfMat = this.mat(materials, '#c92727', { roughness: 0.85 });
        this.add(torso, this.torusGeo(), scarfMat, {
          scale: [0.13, 0.13, 0.12],
          pos: [0, 0.55, 0],
          rot: [Math.PI / 2, 0, 0],
        });
        this.add(torso, this.boxGeo(), scarfMat, { scale: [0.09, 0.28, 0.015], pos: [-0.12, 0.4, 0.19], rot: [0, 0, 0.1] });
      }
    }

    // Chest bag / borsello for everyone but the player.
    if (look !== 'player') {
      const bagSize: [number, number, number] =
        look === 'boss' ? [0.32, 0.24, 0.12] : look === 'puffer' ? [0.26, 0.18, 0.1] : [0.23, 0.16, 0.085];
      const bagX = look === 'boss' ? 0.18 : 0.21;
      this.add(torso, this.boxGeo(), bagMat, {
        scale: bagSize,
        pos: [bagX, -0.12, 0.06],
        rot: [0, -0.15, -0.12],
      });
      this.add(torso, this.boxGeo(), bagMat, {
        scale: [bagSize[0] * 1.02, bagSize[1] * 0.45, bagSize[2] * 1.04],
        pos: [bagX, -0.03, 0.065],
        rot: [0.15, -0.15, -0.12],
      });
      this.add(torso, this.boxGeo(), metalMat, {
        scale: [0.04, 0.035, 0.02],
        pos: [bagX, -0.06, bagSize[2] / 2 + 0.09],
      });
      // Cross-body strap.
      this.add(torso, this.boxGeo(), bagMat, {
        scale: [0.045, 0.62, 0.026],
        pos: [0.02, 0.26, 0.245],
        rot: [0.04, 0, 0.47],
      });
      if (look === 'boss' && (variant % BOSS_OUTFITS.length === 0 || variant % BOSS_OUTFITS.length === 1 || variant % BOSS_OUTFITS.length === 5)) {
        // The kings and the council wear the gold chain and medallion.
        this.add(torso, this.torusGeo(), metalMat, {
          scale: [0.19, 0.19, 0.14],
          pos: [0, 0.47, 0.02],
          rot: [Math.PI / 2, 0, 0],
        });
        this.add(torso, this.boxGeo(), metalMat, { scale: [0.1, 0.11, 0.03], pos: [0, 0.33, 0.25], rot: [0, 0, 0.78] });
        // Crown on cap.
        this.add(torso, this.cylinderGeo(), metalMat, { scale: [0.1, 0.05, 0.1], pos: [0, 0.66, -0.01] });
      } else {
        this.add(torso, this.torusGeo(), metalMat, {
          scale: [0.09, 0.09, 0.1],
          pos: [0, 0.51, 0.02],
          rot: [Math.PI / 2, 0, 0],
        });
        this.add(torso, this.boxGeo(), metalMat, { scale: [0.035, 0.04, 0.012], pos: [0, 0.46, 0.15] });
      }
    }

    // ── Head ────────────────────────────────────────────────────────────
    // Cranio + occipite + mandibola su un collo raccordato al torso:
    // niente più testa-"coppolone"; pivots e giunti restano invariati.
    this.add(head, this.sphereGeo(), skinMat, { scale: [0.126, 0.145, 0.128], pos: [0, 0.1, 0] });
    this.add(head, this.sphereGeo(), skinMat, { scale: [0.11, 0.09, 0.13], pos: [0, 0.065, -0.055] });
    this.add(head, this.sphereGeo(), skinMat, { scale: [0.098, 0.06, 0.09], pos: [0, 0.02, 0.035] });
    this.add(head, this.cylinderGeo(), skinMat, { scale: [0.058, 0.1, 0.058], pos: [0, -0.045, 0] });
    this.add(head, this.taperedGeo(0.08, 0.06), skinMat, { scale: [1, 0.08, 0.75], pos: [0, -0.072, 0] });
    // Orecchio.
    this.add(head, this.sphereGeo(), skinMat, { scale: [0.026, 0.038, 0.024], pos: [0.126, 0.09, -0.005] });
    this.add(head, this.sphereGeo(), skinMat, { scale: [0.026, 0.038, 0.024], pos: [-0.126, 0.09, -0.005] });
    // Naso: ponte + punta, non un cono isolato.
    this.add(head, this.boxGeo(), skinMat, { scale: [0.03, 0.045, 0.11], pos: [0, 0.075, 0.08] });
    this.add(head, this.sphereGeo(), skinMat, { scale: [0.026, 0.02, 0.024], pos: [0, 0.082, 0.118] });
    // Bocca.
    this.add(head, this.boxGeo(), this.mat(materials, '#5b3029', { roughness: 0.8 }), {
      scale: [0.05, 0.012, 0.012],
      pos: [0, 0.038, 0.124],
    });
    // Sopracciglia con volume e inclinazione.
    this.add(head, this.boxGeo(), hairMat, { scale: [0.05, 0.014, 0.015], pos: [0.05, 0.142, 0.113], rot: [0, 0, -0.16] });
    this.add(head, this.boxGeo(), hairMat, { scale: [0.05, 0.014, 0.015], pos: [-0.05, 0.142, 0.113], rot: [0, 0, 0.16] });
    // Occhi leggermente incassati nella socket.
    if (look === 'player') {
      this.eye(head, 0.052, 0.112, 0.108, whiteMat, darkMat);
      this.eye(head, -0.052, 0.112, 0.108, whiteMat, darkMat);
    } else {
      this.add(head, this.boxGeo(), lensMat, { scale: [0.062, 0.036, 0.02], pos: [0.052, 0.112, 0.118], rot: [0, -0.1, 0] });
      this.add(head, this.boxGeo(), lensMat, { scale: [0.062, 0.036, 0.02], pos: [-0.052, 0.112, 0.118], rot: [0, 0.1, 0] });
      this.add(head, this.boxGeo(), darkMat, { scale: [0.03, 0.012, 0.015], pos: [0, 0.118, 0.125] });
      this.add(head, this.boxGeo(), darkMat, { scale: [0.012, 0.012, 0.14], pos: [0.118, 0.115, 0.06] });
      this.add(head, this.boxGeo(), darkMat, { scale: [0.012, 0.012, 0.14], pos: [-0.118, 0.115, 0.06] });
    }

    // Hair / headwear.
    if (look === 'puffer') {
      const beanieMat = this.mat(materials, outfit.accent, { roughness: 0.95 });
      this.add(head, this.domeGeo(), beanieMat, { scale: [0.138, 0.14, 0.138], pos: [0, 0.13, 0] });
      this.add(head, this.torusGeo(), beanieMat, {
        scale: [0.128, 0.128, 0.07],
        pos: [0, 0.16, 0],
        rot: [Math.PI / 2, 0, 0],
      });
      // Beard.
      this.add(head, this.sphereGeo(), hairMat, { scale: [0.1, 0.055, 0.055], pos: [0, 0.005, 0.08] });
    } else if (look === 'turbo') {
      this.add(head, this.domeGeo(), hairMat, { scale: [0.132, 0.1, 0.132], pos: [0, 0.13, -0.01] });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        this.add(head, this.lowSphereGeo(), hairMat, {
          scale: [0.05, 0.045, 0.05],
          pos: [Math.cos(a) * 0.09, 0.2, Math.sin(a) * 0.09 - 0.02],
        });
      }
      // Backwards cap.
      this.add(head, this.domeGeo(), accentMat, { scale: [0.14, 0.12, 0.14], pos: [0, 0.14, -0.006] });
      this.add(head, this.boxGeo(), accentMat, { scale: [0.19, 0.02, 0.13], pos: [0, 0.11, -0.15], rot: [0.18, 0, 0] });
    } else if (look === 'boss') {
      const bossVariant = Math.abs(variant) % BOSS_OUTFITS.length;
      this.add(head, this.domeGeo(), hairMat, { scale: [0.136, 0.12, 0.14], pos: [0, 0.13, -0.01] });
      if (bossVariant === 0 || bossVariant === 1) {
        // The two kings: slick hair, gold cap, crown spikes, beard.
        this.add(head, this.domeGeo(), secondaryMat, { scale: [0.142, 0.115, 0.142], pos: [0, 0.145, -0.005] });
        this.add(head, this.boxGeo(), secondaryMat, { scale: [0.2, 0.022, 0.12], pos: [0, 0.12, 0.14] });
        for (let i = 0; i < 5; i++) {
          this.add(head, this.coneGeo(), metalMat, {
            scale: [0.026, 0.09 + (i % 2) * 0.03, 0.026],
            pos: [-0.08 + i * 0.04, 0.255, 0.02],
            rot: [0, 0, 0],
          });
        }
        this.add(head, this.sphereGeo(), hairMat, { scale: [0.108, 0.07, 0.06], pos: [0, -0.005, 0.075] });
        this.add(head, this.boxGeo(), metalMat, { scale: [0.016, 0.014, 0.01], pos: [0.02, 0.038, 0.132] });
      } else if (bossVariant === 2) {
        // Buttafuori: shaved head, sunglasses and coiled earpiece.
        this.add(head, this.lowSphereGeo(), hairMat, { scale: [0.13, 0.035, 0.13], pos: [0, 0.2, 0] });
        this.add(head, this.boxGeo(), this.mat(materials, '#0b0b0d', { roughness: 0.4 }), {
          scale: [0.19, 0.042, 0.03],
          pos: [0, 0.078, 0.12],
          rot: [0, 0, 0.03],
        });
        const coil = this.geom('boss-earpiece', () => new THREE.TorusGeometry(1, 0.18, 6, 14, Math.PI * 1.6));
        this.add(head, coil, metalMat, { scale: [0.03, 0.03, 0.03], pos: [0.128, 0.05, 0], rot: [0, Math.PI / 2, 0] });
      } else if (bossVariant === 3) {
        // Personal trainer: sweatband and whistle.
        this.add(head, this.domeGeo(), accentMat, { scale: [0.139, 0.045, 0.141], pos: [0, 0.175, -0.004] });
        this.add(head, this.torusGeo(), metalMat, { scale: [0.032, 0.032, 0.016], pos: [0.02, -0.1, 0.075], rot: [0, 0, 0] });
      } else if (bossVariant === 4) {
        // DJ: headphones over the ears plus a visor.
        const pad = this.geom('boss-headphone', () => new THREE.CylinderGeometry(1, 1, 0.35, 10));
        this.add(head, pad, secondaryMat, { scale: [0.05, 0.05, 0.05], pos: [0.145, 0.06, 0], rot: [0, 0, Math.PI / 2] });
        this.add(head, pad, secondaryMat, { scale: [0.05, 0.05, 0.05], pos: [-0.145, 0.06, 0], rot: [0, 0, Math.PI / 2] });
        this.add(head, this.torusGeo(), secondaryMat, { scale: [0.145, 0.13, 0.02], pos: [0, 0.1, -0.02], rot: [0, 0, 0] });
        this.add(head, this.boxGeo(), accentMat, { scale: [0.17, 0.03, 0.02], pos: [0, 0.08, 0.132] });
      } else {
        // Consiglio: slicked hair, gold-rimmed glasses and a tie pin.
        this.add(head, this.domeGeo(), secondaryMat, { scale: [0.142, 0.11, 0.142], pos: [0, 0.15, -0.005] });
        const rimMat = metalMat;
        for (const x of [-0.062, 0.062]) {
          this.add(head, this.torusGeo(), rimMat, { scale: [0.045, 0.032, 0.012], pos: [x, 0.09, 0.126], rot: [0, 0, 0] });
        }
        this.add(head, this.boxGeo(), rimMat, { scale: [0.05, 0.008, 0.008], pos: [0, 0.09, 0.13] });
        this.add(head, this.sphereGeo(), hairMat, { scale: [0.1, 0.05, 0.05], pos: [0, -0.005, 0.08] });
      }
    } else {
      this.add(head, this.domeGeo(), hairMat, { scale: [0.132, 0.095, 0.134], pos: [0, 0.13, -0.005] });
      if (look === 'player') {
        // Backwards cap + stubble.
        this.add(head, this.domeGeo(), secondaryMat, { scale: [0.138, 0.105, 0.14], pos: [0, 0.145, -0.004] });
        this.add(head, this.boxGeo(), secondaryMat, {
          scale: [0.2, 0.02, 0.12],
          pos: [0, 0.12, -0.15],
          rot: [0.22, 0, 0],
        });
        this.add(head, this.torusGeo(), metalMat, {
          scale: [0.03, 0.03, 0.02],
          pos: [0.13, 0.06, 0],
          rot: [0, Math.PI / 2, 0],
        });
      } else {
        // Buzz cut and groomed brows, chain earring.
        this.add(head, this.torusGeo(), metalMat, {
          scale: [0.022, 0.022, 0.015],
          pos: [0.128, 0.06, 0],
          rot: [0, Math.PI / 2, 0],
        });
      }
    }

    // ── Arms ────────────────────────────────────────────────────────────
    const armL = this.group(torso, [-0.29, 0.45, 0]);
    const elbowL = this.group(armL, [0, -0.31, 0]);
    const armR = this.group(torso, [0.29, 0.45, 0]);
    const elbowR = this.group(armR, [0, -0.31, 0]);

    const armThickness = look === 'puffer' || look === 'boss' ? 1.35 : look === 'turbo' ? 0.85 : 1;
    const upperLen = 0.26;
    const foreLen = 0.24;
    const sleeveMat = primaryMat;
    // Spalla modellata: massetta deltidea che rammette al torso, non braccio separato.
    this.add(armL, this.sphereGeo(), sleeveMat, { scale: [0.115 * armThickness, 0.1, 0.1], pos: [0.018, -0.02, 0] });
    this.add(armR, this.sphereGeo(), sleeveMat, { scale: [0.115 * armThickness, 0.1, 0.1], pos: [-0.018, -0.02, 0] });
    this.add(armL, this.capsuleGeo(0.085 * armThickness, upperLen), sleeveMat, { pos: [0, -upperLen / 2, 0] });
    this.add(elbowL, this.sphereGeo(), sleeveMat, { scale: [0.09 * armThickness, 0.09 * armThickness, 0.09 * armThickness], pos: [0, 0, 0] });
    this.add(elbowL, this.capsuleGeo(0.072 * armThickness, foreLen), skinMat, { pos: [0, -foreLen / 2, 0] });
    this.hand(elbowL, skinMat, -1, foreLen);

    this.add(armR, this.capsuleGeo(0.085 * armThickness, upperLen), sleeveMat, { pos: [0, -upperLen / 2, 0] });
    this.add(elbowR, this.sphereGeo(), sleeveMat, { scale: [0.09 * armThickness, 0.09 * armThickness, 0.09 * armThickness], pos: [0, 0, 0] });
    this.add(elbowR, this.capsuleGeo(0.072 * armThickness, foreLen), skinMat, { pos: [0, -foreLen / 2, 0] });
    this.hand(elbowR, skinMat, 1, foreLen);

    if (look === 'boss') {
      // Rings.
      for (const anchor of [elbowL, elbowR]) {
        this.add(anchor, this.torusGeo(), metalMat, {
          scale: [0.03, 0.03, 0.016],
          pos: [0, -foreLen - 0.02, 0],
          rot: [Math.PI / 2, 0, 0],
        });
      }
    }

    if (look !== 'player' && look !== 'puffer') {
      // Tracksuit stripes down the sleeves.
      this.add(armL, this.boxGeo(), accentMat, { scale: [0.018, 0.22, 0.018], pos: [-0.085, -0.14, 0.045] });
      this.add(armR, this.boxGeo(), accentMat, { scale: [0.018, 0.22, 0.018], pos: [0.085, -0.14, 0.045] });
    }

    // ── Legs ────────────────────────────────────────────────────────────
    const legL = this.group(body, [-0.125, -0.04, 0]);
    const kneeL = this.group(legL, [0, -0.41, 0]);
    const legR = this.group(body, [0.125, -0.04, 0]);
    const kneeR = this.group(legR, [0, -0.41, 0]);

    const legThickness = look === 'puffer' || look === 'boss' ? 1.3 : look === 'turbo' ? 0.86 : 1;
    for (const [leg, knee] of [
      [legL, kneeL],
      [legR, kneeR],
    ] as const) {
      this.add(leg, this.capsuleGeo(0.105 * legThickness, 0.24), pantsMat, { pos: [0, -0.19, 0] });
      this.add(knee, this.sphereGeo(), pantsMat, { scale: [0.105 * legThickness, 0.105 * legThickness, 0.105 * legThickness], pos: [0, 0, 0] });
      this.add(knee, this.capsuleGeo(0.088 * legThickness, 0.24), pantsMat, { pos: [0, -0.19, 0] });
      if (look === 'turbo') {
        // High socks.
        this.add(knee, this.cylinderGeo(), whiteMat, { scale: [0.086, 0.09, 0.086], pos: [0, -0.3, 0] });
      }
      this.shoe(knee, shoeMat, soleMat, accentMat);
    }

    for (const [leg, side] of [
      [legL, -1],
      [legR, 1],
    ] as const) {
      if (look === 'base' || look === 'turbo') {
        // Tracksuit side stripes.
        this.add(leg, this.boxGeo(), accentMat, {
          scale: [0.014, 0.3, 0.014],
          pos: [side * 0.1, -0.18, 0],
        });
      }
    }

    // Boss shoulder fur sway is part of the torso, no extra rig complexity.
    const height = look === 'boss' ? 2.15 : look === 'puffer' ? 1.9 : 1.82;
    const radius = look === 'boss' ? 0.46 : look === 'puffer' ? 0.42 : 0.36;

    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.frustumCulled = true;
      }
    });

    return {
      root,
      visual,
      joints: {
        body,
        torso,
        head,
        armL,
        elbowL,
        armR,
        elbowR,
        legL,
        kneeL,
        legR,
        kneeR,
      },
      materials,
      height,
      radius,
      scale,
    };
  }

  /** Palmo + pollice corto: a distanza di gioco si legge "mano", non blob. */
  private hand(
    elbow: THREE.Object3D,
    skin: THREE.Material,
    side: 1 | -1,
    foreLen: number,
  ): void {
    const y = -foreLen - 0.045;
    this.add(elbow, this.sphereGeo(), skin, { scale: [0.068, 0.09, 0.055], pos: [0, y, 0.012] });
    this.add(elbow, this.sphereGeo(), skin, {
      scale: [0.028, 0.055, 0.042],
      pos: [side * 0.052, y - 0.012, 0.028],
      rot: [0.35, 0, side * -0.45],
    });
  }

  /** Sneaker: tomaia + punta + suola in contrasto, leggibile come scarpa. */
  private shoe(
    knee: THREE.Object3D,
    shoe: THREE.Material,
    sole: THREE.Material,
    accent: THREE.Material,
  ): void {
    // Tomaia principale.
    this.add(knee, this.boxGeo(), shoe, {
      scale: [0.16, 0.09, 0.26],
      pos: [0, -0.355, 0.045],
    });
    // Raccordo caviglia.
    this.add(knee, this.sphereGeo(), shoe, {
      scale: [0.082, 0.065, 0.08],
      pos: [0, -0.35, 0],
    });
    // Punta / cap toe.
    this.add(knee, this.sphereGeo(), shoe, {
      scale: [0.082, 0.055, 0.075],
      pos: [0, -0.352, 0.2],
    });
    // Suola in contrasto, leggermente più larga e lunga della tomaia.
    this.add(knee, this.boxGeo(), sole, {
      scale: [0.176, 0.032, 0.315],
      pos: [0, -0.405, 0.055],
    });
    // Fascia lingua/vernice sulle laterali.
    this.add(knee, this.boxGeo(), accent, {
      scale: [0.026, 0.05, 0.11],
      pos: [0.085, -0.335, 0.05],
    });
    this.add(knee, this.boxGeo(), accent, {
      scale: [0.026, 0.05, 0.11],
      pos: [-0.085, -0.335, 0.05],
    });
  }

  private eye(
    head: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    white: THREE.Material,
    pupil: THREE.Material,
  ): void {
    this.add(head, this.sphereGeo(), white, { scale: [0.034, 0.022, 0.016], pos: [x, y, z] });
    this.add(head, this.sphereGeo(), pupil, { scale: [0.014, 0.014, 0.01], pos: [x, y, z + 0.012] });
  }

  dispose(): void {
    for (const geometry of this.geometryCache.values()) {
      geometry.dispose();
    }
    this.geometryCache.clear();
  }
}

const flashBase = new WeakMap<
  CharacterVisual,
  Array<{ emissive: THREE.Color; intensity: number }>
>();
const FLASH_COLOR = new THREE.Color('#fff3c4');

/** Pushes a white-hot impact flash through a character's unique materials. */
export function flashCharacter(visual: CharacterVisual, amount: number): void {
  let base = flashBase.get(visual);
  if (!base) {
    base = visual.materials.map((material) => ({
      emissive: material.emissive.clone(),
      intensity: material.emissiveIntensity,
    }));
    flashBase.set(visual, base);
  }
  const a = Math.min(1, Math.max(0, amount));
  visual.materials.forEach((material, index) => {
    const original = base?.[index];
    if (!original) return;
    material.emissive.copy(original.emissive);
    if (a > 0) material.emissive.lerp(FLASH_COLOR, a * 0.85);
    material.emissiveIntensity = original.intensity + a * 1.6;
  });
}

/** Frees unique character materials; shared geometries are kept cached. */
export function disposeCharacter(visual: CharacterVisual): void {
  for (const material of visual.materials) {
    material.dispose();
  }
  visual.materials.length = 0;
  visual.root.removeFromParent();
}
