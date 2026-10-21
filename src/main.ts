import './styles/main.css';
import { Physics } from './core/Physics';
import { Game } from './core/Game';
import { SaveManager } from './systems/SaveManager';
import { guessDefaultQuality } from './systems/SettingsManager';

function bootUi(progress: number, status: string, hint: string): void {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const bar = document.getElementById('boot-bar');
  const value = document.getElementById('boot-percent');
  const statusEl = document.getElementById('boot-status');
  const hintEl = document.getElementById('boot-hint');
  if (bar) bar.style.width = `${percent}%`;
  if (value) value.textContent = `${percent}%`;
  if (statusEl) statusEl.textContent = status;
  if (hintEl) hintEl.textContent = hint;
}

function fatal(message: string, detail?: string): void {
  const screen = document.getElementById('screen-error');
  const text = document.getElementById('error-message');
  const detailEl = document.getElementById('error-detail');
  const boot = document.getElementById('screen-boot');
  if (text) text.textContent = message;
  if (detailEl) {
    detailEl.textContent = detail ?? '';
    detailEl.toggleAttribute('hidden', !detail);
  }
  screen?.removeAttribute('hidden');
  boot?.classList.remove('is-active');
  document.body.classList.remove('is-playing');
}

function supportsWebGL(canvas: HTMLCanvasElement): boolean {
  try {
    return Boolean(canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }));
  } catch {
    return false;
  }
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPromptEvent | null = null;
let gameRef: Game | null = null;

function installTrigger(): void {
  if (!installPrompt) return;
  installPrompt
    .prompt()
    .then(async () => {
      const choice = await installPrompt?.userChoice;
      if (choice?.outcome === 'accepted') {
        document.getElementById('btn-install')?.setAttribute('hidden', '');
      }
    })
    .catch(() => undefined);
}

async function main(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    fatal('Canvas di gioco non trovato.');
    return;
  }
  if (!supportsWebGL(canvas)) {
    fatal(
      'WebGL 2 non è disponibile su questo browser.',
      'Aggiorna il browser o abilita l’accelerazione hardware. Su iOS è richiesto Safari 15 o successivo.',
    );
    return;
  }

  bootUi(0.06, 'SALVO I TUOI PUNTEGGI', 'Preparo il salvataggio locale');
  const save = SaveManager.create();
  if (save.get().updatedAt === 0) {
    const touch =
      window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    save.updateSettings({ quality: guessDefaultQuality(touch, memory) });
  }

  let physics: Physics;
  try {
    bootUi(0.14, 'CARICO LA FISICA', 'Rapier 3D compilato in WebAssembly');
    await new Promise((resolve) => setTimeout(resolve, 30));
    physics = await Physics.create();
    bootUi(0.26, 'FISICA PRONTA', 'Character controller e collider attivi');
  } catch (error) {
    fatal(
      'Il motore fisico WebAssembly non si è inizializzato.',
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
    return;
  }

  let game: Game;
  try {
    game = new Game(canvas, physics, save);
    gameRef = game;
    const api = {
      version: '1.2.0',
      get snapshot() {
        return game.debugSnapshot();
      },
      spawnEnemy: (kind: string) => game.debugSpawnEnemy(kind as never),
      teleport: (x: number, z: number) => game.debugTeleportPlayer(x, z),
      clearWave: () => game.debugClearWave(),
      jumpToLevel: (level: number) => game.debugJumpToLevel(level),
      hurtPlayer: (amount = 999) => game.debugDamagePlayer(amount),
      face: (yaw: number) => game.debugSetPlayerYaw(yaw),
      showMenu: () => game.returnToMenuPublic(),
      captureLevel: (level: number) => game.captureLevel(level),
      startZombies: (mode: 'infinite' | 'extraction' = 'infinite') => game.debugStartZombies(mode),
      zombiesStartRound: (round: number) => game.debugStartZombiesRound(round),
      zombiesClear: () => game.debugZombiesClear(),
      zombiesCompleteRound: () => game.debugZombiesCompleteRound(),
      zombiesPoints: (amount: number) => game.debugZombiesPoints(amount),
      zombiesOpenDoors: () => game.debugZombiesOpenDoors(),
      zombiesHurt: (amount: number) => game.debugZombiesHurt(amount),
      zombiesTeleport: (x: number, z: number) => game.debugZombiesTeleport(x, z),
      zombiesAim: (x: number, z: number) => game.debugZombiesAim(x, z),
      zombiesBreakWindow: () => game.debugZombiesBreakWindow(),
      zombiesSpawn: (kind: string) => game.debugZombiesSpawn(kind),
      setVisible: (name: string, visible: boolean) => game.debugSetVisible(name, visible),
      sceneInfo: () => game.debugSceneInfo(),
    };
    (window as unknown as { __MARANZA__?: typeof api }).__MARANZA__ = api;
    await game.start();

    // Offline tooling: scripts/capture-previews.mjs loads ?capture=N to render
    // the real arena for the level-select artwork.
    const capture = new URLSearchParams(window.location.search).get('capture');
    if (capture !== null) {
      const index = Number(capture);
      game.captureLevel(Number.isFinite(index) ? Math.max(0, Math.round(index) - 1) : 0);
      return;
    }

    if (installPrompt) game.setInstallTrigger(installTrigger);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fatal('MARANZA FIGHT 3 non riesce ad avviarsi.', message);
    return;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    gameRef?.setInstallTrigger(installTrigger);
  });

  setupServiceWorker();
}

function setupServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  const swUrl = new URL('sw.js', document.baseURI).href;
  navigator.serviceWorker
    .register(swUrl, { scope: './' })
    .then((registration) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('maranza:update-ready'));
          }
        });
      });
    })
    .catch(() => undefined);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
  });

  window.addEventListener('maranza:update-ready', () => {
    const toast = document.getElementById('toast');
    const kicker = document.getElementById('toast-kicker');
    const text = document.getElementById('toast-text');
    if (toast && kicker && text) {
      kicker.textContent = 'AGGIORNAMENTO';
      text.textContent = 'RICARICA PER LA NUOVA VERSIONE';
      toast.classList.add('is-active');
    }
  });
}

window.addEventListener('contextmenu', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest('#app')) event.preventDefault();
});

document.addEventListener('gesturestart', (event) => {
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

main().catch((error) => {
  fatal(
    'Errore imprevisto durante l’avvio.',
    error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error),
  );
});
