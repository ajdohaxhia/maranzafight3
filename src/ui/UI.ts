import * as THREE from 'three';
import type { SaveManager } from '../systems/SaveManager';
import type { Settings } from '../systems/SettingsManager';
import { CHAPTERS, LEVELS } from '../world/LevelManager';
import { HUD, type HudModel } from './HUD';
import type { ZombieSave, ZombiesRunMode } from '../zombies/ZombieSave';
import type { ZombiesResult } from '../zombies/ZombiesMode';

export type ScreenKey =
  | 'boot'
  | 'menu'
  | 'levels'
  | 'help'
  | 'settings'
  | 'credits'
  | 'pause'
  | 'levelComplete'
  | 'gameOver'
  | 'victory'
  | 'zombies'
  | 'zombiesResult';

export interface UICallbacks {
  onNewGame(): void;
  onContinue(level: number): void;
  onSelectLevel(level: number): void;
  onSettingsChanged(settings: Settings): void;
  onWipeSave(): void;
  onResume(): void;
  onRestartLevel(): void;
  onQuit(): void;
  onPause(): void;
  onNextLevel(): void;
  onRetry(): void;
  onMenu(): void;
  onNewGamePlus(): void;
  onZombies(mode: ZombiesRunMode): void;
  onZombiesResume(): void;
  onZombiesRetry(): void;
  onZombiesMenu(): void;
  onInstall(): void;
  onUiSound(): void;
}

export interface LevelResult {
  levelNumber: number;
  levelName: string;
  score: number;
  bestCombo: number;
  kos: number;
  timeSeconds: number;
  stars: number;
  note: string;
  newBest: boolean;
}

const SCREEN_IDS: Record<ScreenKey, string> = {
  boot: 'screen-boot',
  menu: 'screen-menu',
  levels: 'screen-levels',
  help: 'screen-help',
  settings: 'screen-settings',
  credits: 'screen-credits',
  pause: 'screen-pause',
  levelComplete: 'screen-level-complete',
  gameOver: 'screen-gameover',
  victory: 'screen-victory',
  zombies: 'screen-zombies',
  zombiesResult: 'screen-zombies-result',
};

const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

function pad(value: number, length: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(length, '0');
}

const ROMAN = ['I', 'II', 'III', 'IV'];

function roman(value: number): string {
  return ROMAN[value - 1] ?? String(value);
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${pad(s, 2)}`;
}

export class UI {
  readonly hud = new HUD();
  private readonly callbacks: UICallbacks;
  private readonly save: SaveManager;
  private readonly zombieSave: ZombieSave | null;
  private zombiesNewPending = false;
  private zombiesNewTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly screens = new Map<ScreenKey, HTMLElement>();
  private currentScreen: ScreenKey | null = 'boot';
  private panelOrigin: ScreenKey = 'menu';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private damagePool: HTMLElement[] = [];
  private damageIndex = 0;
  private damageTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  private wipePending = false;
  private wipeTimer: ReturnType<typeof setTimeout> | null = null;
  private installDeferred: (() => void) | null = null;

  constructor(save: SaveManager, callbacks: UICallbacks, zombieSave: ZombieSave | null = null) {
    this.save = save;
    this.callbacks = callbacks;
    this.zombieSave = zombieSave;
    for (const [key, id] of Object.entries(SCREEN_IDS) as Array<[ScreenKey, string]>) {
      const element = byId(id);
      if (element) this.screens.set(key, element);
    }
    this.bindMenu();
    this.buildLevelCards();
    this.bindPanels();
    this.bindSettings();
    this.bindResults();
    this.bindZombies();
    this.bindSystem();
    this.createDamagePool();
    this.syncSettingsUI(save.getSettings());
  }

  // ── Screens ─────────────────────────────────────────────────────────
  private activate(key: ScreenKey | null): void {
    for (const [name, element] of this.screens) {
      element.classList.toggle('is-active', name === key);
    }
    this.currentScreen = key;
  }

  showBoot(): void {
    this.activate('boot');
    this.hud.setVisible(false);
    document.body.classList.remove('is-playing');
  }

  setBoot(progress: number, status: string, hint: string): void {
    const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
    const bar = byId<HTMLElement>('boot-bar');
    const value = byId<HTMLElement>('boot-percent');
    const statusEl = byId<HTMLElement>('boot-status');
    const hintEl = byId<HTMLElement>('boot-hint');
    if (bar) bar.style.width = `${percent}%`;
    if (value) value.textContent = `${percent}%`;
    if (statusEl) statusEl.textContent = status;
    if (hintEl) hintEl.textContent = hint;
  }

  showMenu(): void {
    this.activate('menu');
    this.hud.setVisible(false);
    document.body.classList.remove('is-playing');
    this.refreshMenu();
  }

  refreshMenu(continueLabel?: string): void {
    const data = this.save.get();
    const best = byId<HTMLElement>('menu-best');
    const progress = byId<HTMLElement>('menu-progress');
    const continueBtn = byId<HTMLElement>('btn-continue');
    const continueText = byId<HTMLElement>('continue-label');
    if (best) best.textContent = pad(data.bestScore, 4);
    if (progress) progress.textContent = `${this.save.unlockedCount} / ${LEVELS.length}`;
    if (continueBtn) continueBtn.toggleAttribute('hidden', !this.save.hasProgress());
    if (continueText) continueText.textContent = continueLabel ?? `LIVELLO ${this.save.nextLevelIndex() + 1}`;
    const build = byId<HTMLElement>('menu-build');
    if (build) build.textContent = data.completed ? 'COMPLETATO' : 'BUILD 1.2';
    this.refreshLevels();
  }

  showLevels(): void {
    this.refreshLevels();
    this.activate('levels');
    this.hud.setVisible(false);
    document.body.classList.remove('is-playing');
  }

  enterGame(): void {
    this.activate(null);
    this.hud.setVisible(true);
    document.body.classList.add('is-playing');
  }

  enterZombies(): void {
    this.activate(null);
    this.hud.setVisible(false);
    document.body.classList.add('is-playing');
    document.body.classList.add('is-zombies');
  }

  showZombies(): void {
    this.refreshZombies();
    this.activate('zombies');
    this.hud.setVisible(false);
    document.body.classList.remove('is-playing');
    document.body.classList.remove('is-zombies');
  }

  refreshZombies(): void {
    const records = this.zombieSave?.records;
    const active = this.zombieSave?.active ?? null;
    this.setText('z-best-round', String(records?.bestRound ?? 0));
    this.setText('z-best-kills', String(records?.bestKills ?? 0));
    this.setText('z-extractions', String(records?.extractions ?? 0));
    this.setText('z-runs', String(records?.runs ?? 0));
    const resume = byId<HTMLElement>('z-btn-resume');
    if (resume) resume.toggleAttribute('hidden', !active);
    const label = byId<HTMLElement>('z-resume-label');
    if (label) {
      label.textContent = active
        ? `ROUND ${active.nextRound} · ${active.mode === 'extraction' ? 'ESTRAZIONE' : 'INFINITA'} · ${active.points} PUNTI`
        : '';
    }
    const note = byId<HTMLElement>('z-new-note');
    if (note) {
      note.textContent = active
        ? 'Una run è in pausa: riprendila o scarta il checkpoint per iniziarne una nuova.'
        : 'Nessuna run in pausa. Il checkpoint viene salvato tra un round e l’altro.';
    }
    this.resetZombiesConfirm();
  }

  showZombiesResult(result: ZombiesResult, victory: boolean): void {
    this.hud.setVisible(false);
    document.body.classList.remove('is-playing');
    document.body.classList.remove('is-zombies');
    this.activate('zombiesResult');
    this.setText('zr-kicker', victory ? 'ESTRAZIONE COMPLETATA' : 'RUN TERMINATA');
    this.setText('zr-title', victory ? 'FUORI DA MILANO' : 'NOTTE MORTA');
    this.setText('zr-reason', result.reason);
    this.setText('zr-round', String(result.round));
    this.setText('zr-kills', String(result.kills));
    this.setText('zr-headshots', String(result.headshots));
    this.setText('zr-points', pad(result.points, 5));
    this.setText('zr-time', formatTime(result.time));
    this.setText('zr-best', result.newRecord ? `NUOVO RECORD: ROUND ${result.round}` : `RECORD: ROUND ${result.bestRound}`);
    const retry = byId<HTMLElement>('btn-zr-retry');
    if (retry) retry.textContent = victory ? 'NUOVA RUN' : 'RIPROVA';
  }

  /** Rewrites only the label span so a button keeps its index/sub markup. */
  private setZombieButtonLabel(button: HTMLElement, text: string): void {
    const label = button.querySelector<HTMLElement>('.btn__label');
    if (label) label.textContent = text;
    else button.textContent = text;
  }

  private resetZombiesConfirm(): void {
    this.zombiesNewPending = false;
    if (this.zombiesNewTimer) clearTimeout(this.zombiesNewTimer);
    this.zombiesNewTimer = null;
    for (const button of document.querySelectorAll<HTMLElement>('[data-zmode]')) {
      const mode = button.dataset.zmode === 'extraction' ? 'ESTRAZIONE' : 'INFINITA';
      this.setZombieButtonLabel(button, mode);
    }
  }

  showPause(): void {
    this.activate('pause');
    document.body.classList.remove('is-playing');
  }

  hidePause(): void {
    this.activate(null);
    document.body.classList.add('is-playing');
  }

  setControlsActive(active: boolean): void {
    document.body.classList.toggle('is-playing', active);
  }

  showLevelComplete(result: LevelResult): void {
    this.hud.setVisible(false);
    document.body.classList.remove('is-playing');
    this.activate('levelComplete');
    const kicker = byId<HTMLElement>('lc-kicker');
    const title = byId<HTMLElement>('lc-title');
    if (kicker) kicker.textContent = `LIVELLO ${result.levelNumber} COMPLETATO`;
    if (title) title.textContent = result.levelName;
    this.setStars('lc-stars', result.stars);
    this.setText('lc-score', pad(result.score, 6));
    this.setText('lc-combo', `x${result.bestCombo}`);
    this.setText('lc-kos', String(result.kos));
    this.setText('lc-time', formatTime(result.timeSeconds));
    this.setText('lc-note', result.newBest ? `NUOVO RECORD: ${pad(result.score, 6)} · ${result.note}` : result.note);
    const next = byId<HTMLElement>('btn-next-level');
    if (next) next.textContent = 'PROSSIMO LIVELLO';
    this.refreshLevels();
  }

  showGameOver(result: { score: number; wave: number; newBest: boolean }): void {
    this.hud.setVisible(false);
    document.body.classList.remove('is-playing');
    this.activate('gameOver');
    const quotes = [
      '"Te l\'avevo detto, fra\'."',
      '"Il borsello non si tocca."',
      '"Torna quando hai la tuta giusta."',
      '"Milano non perdona."',
    ];
    this.setText('go-quote', quotes[Math.floor(Math.random() * quotes.length)] ?? quotes[0] ?? '');
    this.setText('go-score', pad(result.score, 6));
    this.setText('go-wave', String(result.wave));
    this.refreshLevels();
    const button = byId<HTMLElement>('btn-retry');
    if (button) button.textContent = result.newBest ? 'NUOVO RECORD · RIPROVA' : 'RIPROVA';
  }

  showVictory(result: {
    score: number;
    bestCombo: number;
    kos: number;
    timeSeconds: number;
    newBest: boolean;
  }): void {
    this.hud.setVisible(false);
    document.body.classList.remove('is-playing');
    this.activate('victory');
    this.setText('vi-score', pad(result.score, 6));
    this.setText('vi-combo', `x${result.bestCombo}`);
    this.setText('vi-kos', String(result.kos));
    this.setText('vi-time', formatTime(result.timeSeconds));
  }

  // ── Boot / errors ───────────────────────────────────────────────────
  hideBoot(): void {
    const boot = this.screens.get('boot');
    boot?.classList.remove('is-active');
    this.currentScreen = null;
  }

  showError(message: string, detail?: string): void {
    const screen = byId<HTMLElement>('screen-error');
    const text = byId<HTMLElement>('error-message');
    const detailEl = byId<HTMLElement>('error-detail');
    if (text) text.textContent = message;
    if (detailEl) {
      detailEl.textContent = detail ?? '';
      detailEl.toggleAttribute('hidden', !detail);
    }
    screen?.removeAttribute('hidden');
    this.hud.setVisible(false);
    document.body.classList.remove('is-playing');
  }

  hideError(): void {
    byId<HTMLElement>('screen-error')?.setAttribute('hidden', '');
  }

  // ── In-game feedback ────────────────────────────────────────────────
  updateHud(model: HudModel): void {
    this.hud.update(model);
  }

  setPickupPrompt(visible: boolean): void {
    this.hud.setPickupPrompt(visible);
  }

  toast(kicker: string, text: string, duration = 1700): void {
    const toast = byId<HTMLElement>('toast');
    const k = byId<HTMLElement>('toast-kicker');
    const t = byId<HTMLElement>('toast-text');
    if (!toast) return;
    if (k) k.textContent = kicker;
    if (t) t.textContent = text;
    toast.classList.add('is-active');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('is-active'), duration);
  }

  bossIntro(show: boolean): void {
    byId<HTMLElement>('boss-intro')?.classList.toggle('is-active', show);
  }

  spawnDamage(
    world: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    amount: number | string,
    kind: 'enemy' | 'player' | 'crit' | 'heal' = 'enemy',
  ): void {
    if (this.damagePool.length === 0) return;
    const projected = world.clone().project(camera);
    if (projected.z > 1 || projected.z < -1) return;
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    if (x < -60 || x > window.innerWidth + 60 || y < -60 || y > window.innerHeight + 60) return;
    const div = this.damagePool[this.damageIndex % this.damagePool.length];
    if (!div) return;
    this.damageIndex += 1;
    div.className = `dmg${kind === 'player' ? ' dmg--player' : kind === 'crit' ? ' dmg--crit' : kind === 'heal' ? ' dmg--heal' : ''}`;
    div.textContent = typeof amount === 'number' ? String(Math.round(amount)) : amount;
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.style.animation = 'none';
    void div.offsetWidth;
    div.style.animation = '';
    const previous = this.damageTimers.get(div);
    if (previous) clearTimeout(previous);
    this.damageTimers.set(
      div,
      setTimeout(() => {
        div.textContent = '';
      }, 760),
    );
  }

  setInstallAvailable(available: boolean, trigger?: () => void): void {
    const button = byId<HTMLButtonElement>('btn-install');
    this.installDeferred = trigger ?? null;
    button?.toggleAttribute('hidden', !available);
  }

  setSaveStatus(text: string): void {
    this.setText('save-status', text);
  }

  /** Full-screen colour flash used by heavy hits, specials and the boss. */
  flash(kind: 'hit' | 'hurt' | 'special' | 'boss'): void {
    const element = byId<HTMLElement>('screen-flash');
    if (!element) return;
    element.className = 'screen-flash';
    void element.offsetWidth;
    element.classList.add(`is-${kind}`);
    window.setTimeout(() => element.classList.remove(`is-${kind}`), 760);
  }

  // ── Bindings ────────────────────────────────────────────────────────
  private bindMenu(): void {
    this.on('btn-play', () => this.callbacks.onNewGame());
    this.on('btn-continue', () => this.callbacks.onContinue(this.save.nextLevelIndex() + 1));
    this.on('btn-levels', () => this.showLevels());
    this.on('btn-zombies', () => this.showZombies());
    this.on('btn-help', () => this.openPanel('help'));
    this.on('btn-settings', () => this.openPanel('settings'));
    this.on('btn-credits', () => this.openPanel('credits'));
  }

  private bindPanels(): void {
    for (const back of document.querySelectorAll<HTMLElement>('[data-back]')) {
      back.addEventListener('click', () => {
        this.callbacks.onUiSound();
        if (this.panelOrigin === 'pause') {
          this.activate('pause');
        } else {
          this.showMenu();
        }
      });
    }
    this.on('btn-resume', () => this.callbacks.onResume());
    this.on('btn-pause-settings', () => this.openPanel('settings', 'pause'));
    this.on('btn-restart-level', () => this.callbacks.onRestartLevel());
    this.on('btn-quit', () => this.callbacks.onQuit());
  }

  private bindSettings(): void {
    const qualities = document.querySelectorAll<HTMLButtonElement>('[data-quality]');
    for (const button of qualities) {
      button.addEventListener('click', () => {
        const quality = button.dataset.quality as Settings['quality'] | undefined;
        if (!quality) return;
        this.callbacks.onUiSound();
        this.callbacks.onSettingsChanged(this.save.updateSettings({ quality }));
        this.syncSettingsUI(this.save.getSettings());
      });
    }

    const ranges: Array<[string, keyof Settings, string]> = [
      ['set-master', 'master', 'val-master'],
      ['set-music', 'music', 'val-music'],
      ['set-sfx', 'sfx', 'val-sfx'],
      ['set-sens', 'sensitivity', 'val-sens'],
      ['set-dead', 'deadzone', 'val-dead'],
    ];
    for (const [id, key, labelId] of ranges) {
      const input = byId<HTMLInputElement>(id);
      input?.addEventListener('input', () => {
        const value = Number(input.value);
        const settings = this.save.updateSettings({ [key]: value } as Partial<Settings>);
        const label = byId<HTMLElement>(labelId);
        if (label) label.textContent = String(value);
        this.callbacks.onSettingsChanged(settings);
        this.callbacks.onUiSound();
      });
    }

    const toggles: Array<[string, keyof Settings]> = [
      ['set-mute', 'mute'],
      ['set-shake', 'shake'],
      ['set-invert', 'invertY'],
    ];
    for (const [id, key] of toggles) {
      const input = byId<HTMLInputElement>(id);
      input?.addEventListener('change', () => {
        const settings = this.save.updateSettings({ [key]: input.checked } as Partial<Settings>);
        this.callbacks.onSettingsChanged(settings);
        this.callbacks.onUiSound();
      });
    }

    const wipe = byId<HTMLButtonElement>('btn-wipe');
    wipe?.addEventListener('click', () => {
      this.callbacks.onUiSound();
      if (!this.wipePending) {
        this.wipePending = true;
        wipe.textContent = 'SICURO? TOCCA DI NUOVO';
        wipe.classList.add('is-confirming');
        if (this.wipeTimer) clearTimeout(this.wipeTimer);
        this.wipeTimer = setTimeout(() => {
          this.wipePending = false;
          wipe.textContent = 'CANCELLA TUTTI I SALVATAGGI';
          wipe.classList.remove('is-confirming');
        }, 3500);
        return;
      }
      this.wipePending = false;
      if (this.wipeTimer) clearTimeout(this.wipeTimer);
      wipe.textContent = 'CANCELLA TUTTI I SALVATAGGI';
      wipe.classList.remove('is-confirming');
      this.callbacks.onWipeSave();
      this.refreshMenu();
    });
  }

  private bindResults(): void {
    this.on('btn-next-level', () => this.callbacks.onNextLevel());
    this.on('btn-lc-menu', () => this.callbacks.onMenu());
    this.on('btn-retry', () => this.callbacks.onRetry());
    this.on('btn-go-menu', () => this.callbacks.onMenu());
    this.on('btn-victory-menu', () => this.callbacks.onMenu());
    this.on('btn-newgame-plus', () => this.callbacks.onNewGamePlus());
  }

  private bindZombies(): void {
    this.on('z-btn-resume', () => this.callbacks.onZombiesResume());
    this.on('btn-zr-retry', () => this.callbacks.onZombiesRetry());
    this.on('btn-zr-menu', () => this.callbacks.onZombiesMenu());
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-zmode]')) {
      const mode = button.dataset.zmode === 'extraction' ? 'extraction' : 'infinite';
      button.addEventListener('click', () => {
        this.callbacks.onUiSound();
        const hasActive = Boolean(this.zombieSave?.active);
        if (hasActive && !this.zombiesNewPending) {
          this.zombiesNewPending = true;
          this.setZombieButtonLabel(button, 'SCARTA CHECKPOINT E GIOCA?');
          if (this.zombiesNewTimer) clearTimeout(this.zombiesNewTimer);
          this.zombiesNewTimer = setTimeout(() => this.resetZombiesConfirm(), 4000);
          return;
        }
        this.resetZombiesConfirm();
        this.callbacks.onZombies(mode);
      });
    }
  }

  /** Builds the nine level cards once; refreshLevels() only updates their state. */
  private buildLevelCards(): void {
    const grid = byId<HTMLElement>('level-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const level of LEVELS) {
      const chapter = CHAPTERS[level.chapter - 1];
      const tag = chapter ? `CAP ${roman(chapter.number)} · ${chapter.tag}` : '';
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card';
      card.dataset.level = String(level.number);
      card.dataset.id = level.id;
      card.innerHTML = `
        <span class="level-card__art">
          <img src="./previews/level-${level.number}.jpg" alt="Anteprima di ${level.name}" loading="lazy" decoding="async" />
          <span class="level-card__scan"></span>
        </span>
        <span class="level-card__top">
          <span class="level-card__index">${pad(level.number, 2)}</span>
          <span class="level-card__boss${level.boss ? '' : ' is-chapter'}">${level.boss ? 'BOSS FIGHT' : tag}</span>
        </span>
        <span class="level-card__body">
          <span class="level-card__sub">${level.subtitle}</span>
          <span class="level-card__name">${level.name}</span>
          <span class="level-card__meta">
            <span class="level-card__score">RECORD <b data-score>—</b></span>
            <span class="level-card__stars" data-stars aria-label="Stelle"></span>
          </span>
        </span>
        <span class="level-card__lock"><b>BLOCCATO</b><span>Completa il livello precedente</span></span>
      `;
      const button = card;
      button.addEventListener('click', () => {
        if (button.classList.contains('is-locked')) return;
        this.callbacks.onUiSound();
        this.callbacks.onSelectLevel(level.number);
      });
      grid.appendChild(card);
    }
  }

  private refreshLevels(): void {
    const grid = byId<HTMLElement>('level-grid');
    if (!grid) return;
    if (!grid.querySelector('.level-card')) this.buildLevelCards();
    let done = 0;
    let totalStars = 0;
    for (const card of grid.querySelectorAll<HTMLElement>('.level-card')) {
      const index = Number(card.dataset.level ?? 0) - 1;
      const level = LEVELS[index];
      if (!level) continue;
      const progress = this.save.getProgress(level.id);
      const locked = !this.save.isLevelUnlocked(index);
      card.classList.toggle('is-locked', locked);
      card.classList.toggle('is-cleared', progress.cleared);
      card.setAttribute('aria-disabled', String(locked));
      const score = card.querySelector<HTMLElement>('[data-score]');
      if (score) score.textContent = progress.score > 0 ? pad(progress.score, 6) : '—';
      const stars = card.querySelector<HTMLElement>('[data-stars]');
      if (stars) {
        stars.innerHTML = [0, 1, 2]
          .map((star) => `<i class="${star < progress.stars ? 'is-on' : ''}"></i>`)
          .join('');
      }
      if (progress.cleared) done += 1;
      totalStars += progress.stars;
    }
    const progress = byId<HTMLElement>('levels-progress');
    if (progress) {
      progress.textContent = `${done} / ${LEVELS.length} LIVELLI · ${totalStars} / ${LEVELS.length * 3} STELLE`;
    }
    const menuProgress = byId<HTMLElement>('menu-progress');
    if (menuProgress) menuProgress.textContent = `${this.save.unlockedCount} / ${LEVELS.length}`;
  }

  private bindSystem(): void {
    this.on('btn-hud-pause', () => this.callbacks.onPause());
    this.on('btn-install', () => this.installDeferred?.());
    this.on('btn-error-retry', () => window.location.reload());
    this.on('btn-error-menu', () => window.location.reload());
    document.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button) return;
      if (button.closest('.touch')) return;
      this.callbacks.onUiSound();
    });
  }

  private openPanel(screen: ScreenKey, origin: ScreenKey = 'menu'): void {
    this.panelOrigin = origin;
    this.activate(screen);
    this.syncSettingsUI(this.save.getSettings());
    this.setSaveStatus(this.save.lastError ?? 'Salvataggio locale attivo.');
  }

  private syncSettingsUI(settings: Settings): void {
    const setValue = (id: string, value: string | number): void => {
      const input = byId<HTMLInputElement>(id);
      if (input) input.value = String(value);
    };
    const setLabel = (id: string, value: string): void => this.setText(id, value);
    setValue('set-master', settings.master);
    setValue('set-music', settings.music);
    setValue('set-sfx', settings.sfx);
    setValue('set-sens', settings.sensitivity);
    setValue('set-dead', settings.deadzone);
    setLabel('val-master', String(settings.master));
    setLabel('val-music', String(settings.music));
    setLabel('val-sfx', String(settings.sfx));
    setLabel('val-sens', String(settings.sensitivity));
    setLabel('val-dead', String(settings.deadzone));
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-quality]')) {
      button.classList.toggle('is-active', button.dataset.quality === settings.quality);
    }
    const mute = byId<HTMLInputElement>('set-mute');
    if (mute) mute.checked = settings.mute;
    const shake = byId<HTMLInputElement>('set-shake');
    if (shake) shake.checked = settings.shake;
    const invert = byId<HTMLInputElement>('set-invert');
    if (invert) invert.checked = settings.invertY;
    const note = byId<HTMLElement>('quality-note');
    if (note) {
      note.textContent =
        settings.quality === 'low'
          ? 'Bassa: nessuna ombra, risoluzione ridotta, perfetta per telefoni datati.'
          : settings.quality === 'medium'
            ? 'Media: buon compromesso, nessuna ombra in tempo reale e più particelle.'
            : 'Alta: ombre reali, risoluzione piena ed effetti completi. Consigliata su desktop.';
    }
  }

  private setStars(id: string, count: number): void {
    const container = byId<HTMLElement>(id);
    if (!container) return;
    const stars = [...container.querySelectorAll('i')];
    stars.forEach((star, index) => star.classList.toggle('is-on', index < count));
  }

  private setText(id: string, text: string): void {
    const element = byId<HTMLElement>(id);
    if (element) element.textContent = text;
  }

  private on(id: string, handler: () => void): void {
    const element = byId<HTMLButtonElement>(id);
    element?.addEventListener('click', (event) => {
      event.preventDefault();
      handler();
    });
  }

  private createDamagePool(): void {
    const layer = byId<HTMLElement>('damage-layer');
    if (!layer) return;
    for (let i = 0; i < 18; i++) {
      const div = document.createElement('div');
      div.className = 'dmg';
      layer.appendChild(div);
      this.damagePool.push(div);
    }
  }

  get current(): ScreenKey | null {
    return this.currentScreen;
  }
}
