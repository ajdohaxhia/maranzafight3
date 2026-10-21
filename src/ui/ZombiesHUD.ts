export interface ZombiesPrompt {
  label: string;
  sub: string;
  price: number;
  affordable: boolean;
}

export interface ZombiesHudModel {
  hp: number;
  maxHp: number;
  points: number;
  round: number;
  mode: 'infinite' | 'extraction';
  remaining: number;
  weaponName: string;
  weaponTag: string;
  mag: number;
  reserve: number;
  reloading: boolean;
  reloadRatio: number;
  slotNames: [string, string | null];
  activeSlot: 0 | 1;
  perks: string[];
  powered: boolean;
  prompt: ZombiesPrompt | null;
  extraction: { active: boolean; time: number; hold: number } | null;
  intermission: number | null;
  buff: string | null;
}

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export class ZombiesHUD {
  private readonly root = el<HTMLElement>('zombies-hud');
  private readonly hpFill = el<HTMLElement>('z-hp-fill');
  private readonly hpText = el<HTMLElement>('z-hp-text');
  private readonly points = el<HTMLElement>('z-points');
  private readonly round = el<HTMLElement>('z-round');
  private readonly mode = el<HTMLElement>('z-mode');
  private readonly left = el<HTMLElement>('z-left');
  private readonly weaponName = el<HTMLElement>('z-weapon-name');
  private readonly weaponTag = el<HTMLElement>('z-weapon-tag');
  private readonly mag = el<HTMLElement>('z-ammo-mag');
  private readonly reserve = el<HTMLElement>('z-ammo-reserve');
  private readonly reloadBar = el<HTMLElement>('z-reload-fill');
  private readonly reloadLabel = el<HTMLElement>('z-reload-label');
  private readonly slot0 = el<HTMLElement>('z-slot-0');
  private readonly slot1 = el<HTMLElement>('z-slot-1');
  private readonly perks = el<HTMLElement>('z-perks');
  private readonly power = el<HTMLElement>('z-power');
  private readonly prompt = el<HTMLElement>('z-prompt');
  private readonly promptLabel = el<HTMLElement>('z-prompt-label');
  private readonly promptSub = el<HTMLElement>('z-prompt-sub');
  private readonly extraction = el<HTMLElement>('z-extraction');
  private readonly extractionTime = el<HTMLElement>('z-extraction-time');
  private readonly intermission = el<HTMLElement>('z-intermission');
  private readonly intermissionTime = el<HTMLElement>('z-intermission-time');
  private readonly interactLabel = el<HTMLElement>('touch-interact-label');
  private readonly buff = el<HTMLElement>('z-buff');
  private readonly interactButton = el<HTMLElement>('touch-interact');
  private last: Partial<ZombiesHudModel> = {};

  setVisible(visible: boolean): void {
    this.root?.classList.toggle('is-active', visible);
    document.body.classList.toggle('is-zombies', visible);
    if (!visible) {
      this.root?.classList.remove('is-active');
      this.prompt?.setAttribute('hidden', '');
      this.extraction?.classList.remove('is-active');
      this.intermission?.classList.remove('is-active');
    }
  }

  update(model: ZombiesHudModel): void {
    const ratio = Math.max(0, Math.min(1, model.hp / Math.max(1, model.maxHp)));
    if (this.hpFill) this.hpFill.style.transform = `scaleX(${ratio.toFixed(4)})`;
    if (this.hpText) this.hpText.textContent = String(Math.ceil(model.hp));
    if (this.hpFill?.parentElement) this.hpFill.parentElement.classList.toggle('is-low', ratio <= 0.3);
    if (this.points && model.points !== this.last.points) {
      this.last.points = model.points;
      this.points.textContent = String(model.points).padStart(5, '0');
    }
    if (this.round && model.round !== this.last.round) {
      this.last.round = model.round;
      this.round.textContent = String(model.round).padStart(2, '0');
    }
    if (this.mode && model.mode !== this.last.mode) {
      this.last.mode = model.mode;
      this.mode.textContent = model.mode === 'extraction' ? 'ESTRAZIONE · 20 ROUND' : 'INFINITA · RECORD';
    }
    if (this.left) this.left.textContent = String(Math.max(0, model.remaining));
    if (this.weaponName && model.weaponName !== this.last.weaponName) {
      this.last.weaponName = model.weaponName;
      this.weaponName.textContent = model.weaponName;
    }
    if (this.weaponTag && model.weaponTag !== this.last.weaponTag) {
      this.last.weaponTag = model.weaponTag;
      this.weaponTag.textContent = model.weaponTag;
    }
    if (this.mag) this.mag.textContent = String(model.mag).padStart(2, '0');
    if (this.reserve) this.reserve.textContent = String(model.reserve).padStart(3, '0');
    if (this.reloadBar) this.reloadBar.style.transform = `scaleX(${model.reloading ? Math.max(0, Math.min(1, model.reloadRatio)).toFixed(3) : '0'})`;
    if (this.reloadLabel) this.reloadLabel.textContent = model.reloading ? 'RICARICO' : model.mag === 0 ? 'R — RICARICA' : '';
    if (this.slot0) {
      this.slot0.textContent = model.slotNames[0] ?? 'VUOTO';
      this.slot0.classList.toggle('is-active', model.activeSlot === 0 && Boolean(model.slotNames[0]));
    }
    if (this.slot1) {
      this.slot1.textContent = model.slotNames[1] ?? 'VUOTO';
      this.slot1.classList.toggle('is-active', model.activeSlot === 1 && Boolean(model.slotNames[1]));
    }
    if (this.perks) {
      const key = model.perks.join(',');
      if (key !== this.last.perks?.join(',')) {
        this.perks.innerHTML = model.perks.map((perk) => `<i class="z-perk">${perk}</i>`).join('');
      }
    }
    if (this.power) {
      this.power.textContent = model.powered ? 'CORRENTE ON' : 'CORRENTE OFF';
      this.power.classList.toggle('is-on', model.powered);
    }

    if (this.prompt) {
      const show = model.prompt !== null;
      this.prompt.toggleAttribute('hidden', !show);
      if (model.prompt) {
        if (this.promptLabel) this.promptLabel.textContent = model.prompt.label;
        if (this.promptSub) {
          this.promptSub.textContent =
            model.prompt.price > 0
              ? `${model.prompt.sub} · ${model.prompt.affordable ? 'ACQUISTABILE' : 'PUNTI INSUFFICIENTI'}`
              : model.prompt.sub;
        }
        this.prompt.classList.toggle('is-denied', !model.prompt.affordable);
      }
      if (this.interactLabel) {
        this.interactLabel.textContent = model.prompt
          ? model.prompt.price > 0
            ? `USA · ${model.prompt.price}`
            : 'INTERAGISCI'
          : 'INTERAGISCI';
      }
      this.interactButton?.classList.toggle('is-active', show);
    }

    if (this.extraction) {
      this.extraction.classList.toggle('is-active', Boolean(model.extraction?.active));
      if (model.extraction && this.extractionTime) {
        this.extractionTime.textContent = `${Math.max(0, Math.ceil(model.extraction.time))}s · ZONA ${Math.round(model.extraction.hold * 100)}%`;
      }
    }
    if (this.intermission) {
      this.intermission.classList.toggle('is-active', model.intermission !== null);
      if (model.intermission !== null && this.intermissionTime) {
        this.intermissionTime.textContent = String(Math.max(0, Math.ceil(model.intermission)));
      }
    }
    if (this.buff) {
      this.buff.classList.toggle('is-active', model.buff !== null);
      if (model.buff) this.buff.textContent = model.buff;
    }
  }
}
