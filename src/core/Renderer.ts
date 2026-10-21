import * as THREE from 'three';
import type { Quality } from '../systems/SettingsManager';

export interface QualityProfile {
  label: string;
  pixelRatioCap: number;
  renderScale: number;
  shadows: boolean;
  shadowMapSize: number;
  particleDensity: number;
  fov: number;
}

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  low: {
    label: 'MOBILE',
    pixelRatioCap: 1.1,
    renderScale: 0.7,
    shadows: false,
    shadowMapSize: 512,
    particleDensity: 0.45,
    fov: 64,
  },
  medium: {
    label: 'BILANCIATO',
    pixelRatioCap: 1.5,
    renderScale: 0.88,
    shadows: false,
    shadowMapSize: 1024,
    particleDensity: 0.75,
    fov: 62,
  },
  high: {
    label: 'ALTO',
    pixelRatioCap: 2,
    renderScale: 1,
    shadows: true,
    shadowMapSize: 2048,
    particleDensity: 1,
    fov: 60,
  },
};

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private quality: Quality;
  private readonly canvas: HTMLCanvasElement;
  private resizeObserver: ResizeObserver | null = null;
  private readonly onWindowResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.canvas = canvas;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x050507, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050507);

    this.camera = new THREE.PerspectiveCamera(QUALITY_PROFILES[quality].fov, 16 / 9, 0.1, 260);
    this.camera.position.set(0, 4, -8);
    this.camera.lookAt(0, 1.5, 0);

    this.applyQuality(quality);
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas.parentElement ?? canvas);
    }
    window.addEventListener('resize', this.onWindowResize, { passive: true });
    window.addEventListener('orientationchange', this.onWindowResize, { passive: true });
  }

  get profile(): QualityProfile {
    return QUALITY_PROFILES[this.quality];
  }

  get pixelRatio(): number {
    return this.renderer.getPixelRatio();
  }

  applyQuality(quality: Quality): void {
    this.quality = quality;
    const profile = QUALITY_PROFILES[quality];
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.renderer.setPixelRatio(Math.min(dpr, profile.pixelRatioCap) * profile.renderScale);
    this.renderer.shadowMap.enabled = profile.shadows;
    if (profile.shadows) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.camera.fov = profile.fov;
    this.camera.updateProjectionMatrix();
    this.resize();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? window.innerWidth);
    const height = Math.max(1, parent?.clientHeight ?? window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  get triangles(): number {
    return this.renderer.info.render.triangles;
  }

  dispose(): void {
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('orientationchange', this.onWindowResize);
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
