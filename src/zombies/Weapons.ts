/**
 * Arcade shooter weapons for "Notte morta a Milano".
 *
 * Pure, engine-free state so the ammo/reload/switch rules can be unit tested:
 * the renderer and the hit-scan live in ZombiesMode, the numbers live here.
 */

export type WeaponId = 'pistol' | 'smg' | 'shotgun' | 'rifle';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  tag: string;
  /** Full-auto keeps firing while the trigger is held. */
  auto: boolean;
  /** Damage per pellet, before headshot multiplier and tier upgrades. */
  damage: number;
  headshot: number;
  pellets: number;
  spread: number;
  range: number;
  cooldown: number;
  magazine: number;
  reserveStart: number;
  reserveMax: number;
  reload: number;
  recoil: number;
  /** Wall-buy price. 0 = starting weapon. */
  price: number;
  ammoPrice: number;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pistol: {
    id: 'pistol',
    name: 'LA PITTA',
    tag: 'PISTOLA · SEMIAUTO',
    auto: false,
    damage: 34,
    headshot: 2,
    pellets: 1,
    spread: 0.006,
    range: 60,
    cooldown: 0.24,
    magazine: 12,
    reserveStart: 96,
    reserveMax: 144,
    reload: 1.25,
    recoil: 0.9,
    price: 0,
    ammoPrice: 350,
  },
  smg: {
    id: 'smg',
    name: 'IL TRAM',
    tag: 'MITRAGLIETTA · AUTO',
    auto: true,
    damage: 21,
    headshot: 1.8,
    pellets: 1,
    spread: 0.02,
    range: 48,
    cooldown: 0.085,
    magazine: 30,
    reserveStart: 180,
    reserveMax: 300,
    reload: 1.8,
    recoil: 0.55,
    price: 1000,
    ammoPrice: 500,
  },
  shotgun: {
    id: 'shotgun',
    name: 'TIRAPUGNI',
    tag: 'FUCILE A POMPA',
    auto: false,
    damage: 17,
    headshot: 1.5,
    pellets: 8,
    spread: 0.085,
    range: 22,
    cooldown: 0.78,
    magazine: 6,
    reserveStart: 42,
    reserveMax: 72,
    reload: 2.5,
    recoil: 2.4,
    price: 1200,
    ammoPrice: 550,
  },
  rifle: {
    id: 'rifle',
    name: 'GRATTACIELO',
    tag: 'CARABINA · PRECISIONE',
    auto: false,
    damage: 96,
    headshot: 2.5,
    pellets: 1,
    spread: 0.002,
    range: 90,
    cooldown: 0.42,
    magazine: 10,
    reserveStart: 80,
    reserveMax: 120,
    reload: 2.2,
    recoil: 1.7,
    price: 1500,
    ammoPrice: 700,
  },
};

export const WEAPON_IDS: WeaponId[] = ['smg', 'shotgun', 'rifle'];
export const MAX_TIER = 3;

export interface WeaponSlot {
  id: WeaponId;
  mag: number;
  reserve: number;
  tier: number;
}

export interface ReloadResult {
  started: boolean;
  /** Rounds moved from the reserve when the reload completes. */
  moved?: number;
}

/** Damage of one pellet for a slot, including bench upgrades. */
export function slotDamage(slot: WeaponSlot): number {
  return WEAPONS[slot.id].damage * (1 + (slot.tier - 1) * 0.35);
}

function makeSlot(id: WeaponId, reserve = WEAPONS[id].reserveStart): WeaponSlot {
  const spec = WEAPONS[id];
  return { id, mag: spec.magazine, reserve, tier: 1 };
}

/**
 * Two-slot loadout with interrupted reloads. Reload moves rounds only when it
 * finishes, so cancelling never duplicates or invents ammunition.
 */
export class WeaponState {
  readonly slots: Array<WeaponSlot | null> = [null, null];
  active: 0 | 1 = 0;
  reloading = false;
  reloadTimer = 0;
  cooldown = 0;
  /** Serial bumped on every shot, used for viewmodel recoil. */
  shotSerial = 0;

  constructor(startWithPistol = true) {
    if (startWithPistol) this.slots[0] = makeSlot('pistol');
  }

  get current(): WeaponSlot | null {
    return this.slots[this.active];
  }

  get currentSpec(): WeaponSpec | null {
    const slot = this.current;
    return slot ? WEAPONS[slot.id] : null;
  }

  has(id: WeaponId): boolean {
    return this.slots.some((slot) => slot?.id === id);
  }

  slotFor(id: WeaponId): WeaponSlot | null {
    return this.slots.find((slot) => slot?.id === id) ?? null;
  }

  canFire(): boolean {
    return Boolean(this.current && this.current.mag > 0 && !this.reloading && this.cooldown <= 0);
  }

  /** Consumes one round. The caller resolves pellets and damage. */
  consumeShot(): boolean {
    const slot = this.current;
    if (!slot || !this.canFire()) return false;
    slot.mag -= 1;
    this.cooldown = WEAPONS[slot.id].cooldown;
    this.shotSerial += 1;
    return true;
  }

  tick(dt: number): void {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.reloading) return;
    this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    if (this.reloadTimer > 0) return;
    this.reloading = false;
    const slot = this.current;
    if (!slot) return;
    const spec = WEAPONS[slot.id];
    const missing = Math.max(0, spec.magazine - slot.mag);
    const moved = Math.min(missing, slot.reserve);
    slot.mag += moved;
    slot.reserve -= moved;
  }

  /** Starts a reload when there is a magazine to fill and ammo in reserve. */
  startReload(durationScale = 1): ReloadResult {
    const slot = this.current;
    if (!slot || this.reloading) return { started: false };
    const spec = WEAPONS[slot.id];
    if (slot.mag >= spec.magazine || slot.reserve <= 0) return { started: false };
    this.reloading = true;
    this.reloadTimer = spec.reload * Math.max(0.35, durationScale);
    return { started: true };
  }

  cancelReload(): void {
    this.reloading = false;
    this.reloadTimer = 0;
  }

  /** Switching slots cancels an in-flight reload and resets the trigger. */
  switchTo(index: 0 | 1): boolean {
    if (index === this.active || !this.slots[index]) return false;
    this.cancelReload();
    this.active = index;
    this.cooldown = Math.max(this.cooldown, 0.18);
    return true;
  }

  switchWeapon(): boolean {
    return this.switchTo(this.active === 0 ? 1 : 0);
  }

  /**
   * Buys a weapon or refills it. A new weapon always goes into the active slot
   * (unless the other slot is empty, in which case it stays in the loadout).
   */
  acquire(id: WeaponId): 'new' | 'ammo' | 'full' {
    const spec = WEAPONS[id];
    const owned = this.slotFor(id);
    if (owned) {
      if (owned.reserve >= spec.reserveMax && owned.mag >= spec.magazine) return 'full';
      owned.reserve = spec.reserveMax;
      owned.mag = spec.magazine;
      if (this.slots[this.active] !== owned) {
        const other = this.active === 0 ? 1 : 0;
        if (!this.slots[other]) this.active = other as 0 | 1;
      }
      this.cancelReload();
      return 'ammo';
    }
    const empty = this.slots.findIndex((slot) => slot === null);
    const target = empty >= 0 ? empty : this.active;
    this.cancelReload();
    this.slots[target] = makeSlot(id);
    if (target === this.active || empty >= 0) this.active = target as 0 | 1;
    this.cooldown = 0;
    return 'new';
  }

  /** Buys reserve ammo for an owned weapon (not usable for unowned guns). */
  buyAmmo(id: WeaponId, fraction = 1): 'ammo' | 'full' | 'missing' {
    const slot = this.slotFor(id);
    if (!slot) return 'missing';
    const spec = WEAPONS[id];
    if (slot.reserve >= spec.reserveMax) return 'full';
    slot.reserve = Math.min(spec.reserveMax, slot.reserve + Math.round(spec.reserveMax * fraction));
    return 'ammo';
  }

  upgrade(id: WeaponId): boolean {
    const slot = this.slotFor(id);
    if (!slot || slot.tier >= MAX_TIER) return false;
    slot.tier += 1;
    return true;
  }

  /** Serialisable snapshot for the between-round checkpoint. */
  toJSON(): { slots: Array<WeaponSlot | null>; active: 0 | 1 } {
    return {
      slots: this.slots.map((slot) => (slot ? { ...slot } : null)),
      active: this.active,
    };
  }

  restore(data: { slots?: Array<Partial<WeaponSlot> | null>; active?: number } | null): void {
    if (!data || !Array.isArray(data.slots)) return;
    for (let i = 0; i < 2; i++) {
      const raw = data.slots[i];
      if (!raw || typeof raw.id !== 'string' || !(raw.id in WEAPONS)) {
        this.slots[i] = null;
        continue;
      }
      const id = raw.id as WeaponId;
      const spec = WEAPONS[id];
      const mag = Number(raw.mag);
      const reserve = Number(raw.reserve);
      const tier = Number(raw.tier);
      this.slots[i] = {
        id,
        mag: Number.isFinite(mag) ? Math.max(0, Math.min(spec.magazine, Math.floor(mag))) : spec.magazine,
        reserve: Number.isFinite(reserve) ? Math.max(0, Math.min(spec.reserveMax, Math.floor(reserve))) : 0,
        tier: Number.isFinite(tier) ? Math.max(1, Math.min(MAX_TIER, Math.floor(tier))) : 1,
      };
    }
    if (!this.slots[0] && !this.slots[1]) this.slots[0] = makeSlot('pistol');
    const active = data.active === 1 ? 1 : 0;
    this.active = (this.slots[active] ? active : this.slots[0] ? 0 : 1) as 0 | 1;
    this.cancelReload();
    this.cooldown = 0;
  }
}
