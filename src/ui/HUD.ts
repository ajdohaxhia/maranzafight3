export interface HudModel {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  score: number;
  best: number;
  levelName: string;
  waveNumber: number;
  waveTotal: number;
  enemiesRemaining: number;
  waveProgress: number;
  comboCount: number;
  comboMultiplier: number;
  comboActive: boolean;
  specialReady: boolean;
  dodgeRatio: number;
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  bossName: string;
  bossPhaseLabel: string;
}

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export class HUD {
  private readonly hpFill = el<HTMLElement>('hud-hp-fill');
  private readonly hpGhost = el<HTMLElement>('hud-hp-ghost');
  private readonly hpText = el<HTMLElement>('hud-hp-text');
  private readonly hpBar = el<HTMLElement>('hud-hp-fill')?.parentElement ?? null;
  private readonly energyFill = el<HTMLElement>('hud-energy-fill');
  private readonly energyBar = el<HTMLElement>('hud-energy-fill')?.parentElement ?? null;
  private readonly specialState = el<HTMLElement>('hud-special-state');
  private readonly scoreValue = el<HTMLElement>('hud-score');
  private readonly bestValue = el<HTMLElement>('hud-best');
  private readonly levelName = el<HTMLElement>('hud-level');
  private readonly waveValue = el<HTMLElement>('hud-wave');
  private readonly enemiesValue = el<HTMLElement>('hud-enemies');
  private readonly waveFill = el<HTMLElement>('hud-wave-fill');
  private readonly combo = el<HTMLElement>('hud-combo');
  private readonly comboCount = el<HTMLElement>('hud-combo-count');
  private readonly comboMult = el<HTMLElement>('hud-combo-mult');
  private readonly dodgeFill = el<HTMLElement>('dodge-fill');
  private readonly bossHud = el<HTMLElement>('boss-hud');
  private readonly bossFill = el<HTMLElement>('boss-hp-fill');
  private readonly bossText = el<HTMLElement>('boss-hp-text');
  private readonly bossName = el<HTMLElement>('boss-name');
  private readonly bossPhase = el<HTMLElement>('boss-phase');
  private readonly hint = el<HTMLElement>('hud-hint');
  private readonly root = el<HTMLElement>('hud');
  private readonly pickupPrompt = el<HTMLElement>('pickup-prompt');
  private readonly interactButton = el<HTMLElement>('touch-interact');

  private lastHp = -1;
  private lastEnergy = -1;
  private lastScore = -1;
  private lastBest = -1;
  private lastWave = -1;
  private lastEnemies = -1;
  private lastCombo = -1;
  private lastBossHp = -1;
  private lastPhase = '';
  private lastBossName = '';
  private lastLevel = '';
  private popTimer: ReturnType<typeof setTimeout> | null = null;

  setVisible(visible: boolean): void {
    this.root?.classList.toggle('is-active', visible);
    if (!visible) {
      this.root?.classList.remove('is-paused');
    }
  }

  update(model: HudModel): void {
    const hpRatio = Math.max(0, Math.min(1, model.hp / Math.max(1, model.maxHp)));
    if (this.hpFill) this.hpFill.style.transform = `scaleX(${hpRatio.toFixed(4)})`;
    if (this.hpGhost) this.hpGhost.style.transform = `scaleX(${hpRatio.toFixed(4)})`;
    if (this.hpBar) this.hpBar.classList.toggle('is-low', hpRatio <= 0.3);
    const hpRound = Math.ceil(model.hp);
    if (hpRound !== this.lastHp) {
      this.lastHp = hpRound;
      if (this.hpText) this.hpText.textContent = String(hpRound);
    }

    const energyRatio = Math.max(0, Math.min(1, model.energy / Math.max(1, model.maxEnergy)));
    if (this.energyFill) this.energyFill.style.transform = `scaleX(${energyRatio.toFixed(4)})`;
    if (this.energyBar) this.energyBar.classList.toggle('is-full', model.specialReady);
    if (this.specialState) {
      this.specialState.textContent = model.specialReady ? 'SPECIALE PRONTO' : `ENERGIA ${Math.floor(energyRatio * 100)}%`;
    }
    if (this.lastEnergy !== Math.floor(energyRatio * 100)) {
      this.lastEnergy = Math.floor(energyRatio * 100);
    }

    if (this.scoreValue && model.score !== this.lastScore) {
      this.lastScore = model.score;
      this.scoreValue.textContent = String(model.score).padStart(6, '0');
    }
    if (this.bestValue && model.best !== this.lastBest) {
      this.lastBest = model.best;
      this.bestValue.textContent = String(model.best).padStart(4, '0');
    }
    if (this.levelName && model.levelName !== this.lastLevel) {
      this.lastLevel = model.levelName;
      this.levelName.textContent = model.levelName;
    }
    if (this.waveValue && model.waveNumber !== this.lastWave) {
      this.lastWave = model.waveNumber;
      this.waveValue.textContent = `${model.waveNumber} / ${model.waveTotal}`;
    }
    const enemies = Math.max(0, model.enemiesRemaining);
    if (this.enemiesValue && enemies !== this.lastEnemies) {
      this.lastEnemies = enemies;
      this.enemiesValue.textContent = String(enemies);
    }
    if (this.waveFill) {
      this.waveFill.style.width = `${Math.round(Math.max(0, Math.min(1, model.waveProgress)) * 100)}%`;
    }

    if (this.combo) {
      const active = model.comboActive && model.comboCount > 1;
      this.combo.classList.toggle('is-active', active);
      if (active && model.comboCount !== this.lastCombo) {
        if (this.comboCount) this.comboCount.textContent = `x${model.comboCount}`;
        if (this.comboMult) this.comboMult.textContent = `x${model.comboMultiplier.toFixed(1)}`;
        this.combo.classList.remove('is-pop');
        void this.combo.offsetWidth;
        this.combo.classList.add('is-pop');
        if (this.popTimer) clearTimeout(this.popTimer);
        this.popTimer = setTimeout(() => this.combo?.classList.remove('is-pop'), 240);
      }
      this.lastCombo = model.comboCount;
    }
    if (this.dodgeFill) {
      this.dodgeFill.style.transform = `scaleX(${Math.max(0, Math.min(1, model.dodgeRatio)).toFixed(3)})`;
    }

    if (this.bossHud) {
      this.bossHud.classList.toggle('is-active', model.bossActive);
      if (model.bossActive) {
        const bossRound = Math.ceil(model.bossHp);
        if (bossRound !== this.lastBossHp) {
          this.lastBossHp = bossRound;
          const ratio = Math.max(0, model.bossHp / Math.max(1, model.bossMaxHp));
          if (this.bossFill) this.bossFill.style.transform = `scaleX(${ratio.toFixed(4)})`;
          if (this.bossText) this.bossText.textContent = `${Math.ceil(ratio * 100)}%`;
        }
        if (this.bossName && model.bossName !== this.lastBossName) {
          this.lastBossName = model.bossName;
          this.bossName.textContent = model.bossName;
        }
        if (this.bossPhase && model.bossPhaseLabel !== this.lastPhase) {
          this.lastPhase = model.bossPhaseLabel;
          this.bossPhase.textContent = model.bossPhaseLabel;
        }
      }
    }

    if (this.hint) {
      this.hint.textContent = model.specialReady ? 'SPECIALE PRONTO — SCATENA LA RIVOLTA' : 'SCHIVA SUL LAMPO ROSSO';
      this.hint.classList.toggle('is-perfect', model.specialReady);
    }
  }

  setPickupPrompt(visible: boolean): void {
    this.pickupPrompt?.toggleAttribute('hidden', !visible);
    this.interactButton?.classList.toggle('is-active', visible);
  }
}
