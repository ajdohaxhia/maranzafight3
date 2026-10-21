import { describe, expect, it } from 'vitest';
import { WEAPONS, WeaponState, slotDamage } from '../../src/zombies/Weapons';

describe('WeaponState', () => {
  it('starts with a loaded pistol', () => {
    const state = new WeaponState();
    expect(state.current?.id).toBe('pistol');
    expect(state.current?.mag).toBe(WEAPONS.pistol.magazine);
    expect(state.canFire()).toBe(true);
  });

  it('consumes one round per shot and respects the fire cooldown', () => {
    const state = new WeaponState();
    expect(state.consumeShot()).toBe(true);
    expect(state.current?.mag).toBe(WEAPONS.pistol.magazine - 1);
    expect(state.canFire()).toBe(false);
    state.tick(WEAPONS.pistol.cooldown);
    expect(state.canFire()).toBe(true);
  });

  it('moves rounds from reserve only when the reload finishes', () => {
    const state = new WeaponState();
    const pistol = state.current!;
    pistol.mag = 3;
    expect(state.startReload().started).toBe(true);
    expect(pistol.reserve).toBe(WEAPONS.pistol.reserveStart);
    state.tick(WEAPONS.pistol.reload - 0.05);
    expect(pistol.mag).toBe(3);
    expect(state.reloading).toBe(true);
    state.tick(0.1);
    expect(pistol.mag).toBe(WEAPONS.pistol.magazine);
    expect(pistol.reserve).toBe(WEAPONS.pistol.reserveStart - (WEAPONS.pistol.magazine - 3));
    expect(state.reloading).toBe(false);
  });

  it('never invents ammo when a reload is cancelled or the reserve is empty', () => {
    const state = new WeaponState();
    const pistol = state.current!;
    pistol.mag = 2;
    pistol.reserve = 4;
    state.startReload();
    state.cancelReload();
    expect(pistol.mag).toBe(2);
    expect(pistol.reserve).toBe(4);
    state.tick(10);
    expect(pistol.mag).toBe(2);
    expect(state.startReload().started).toBe(true);
    state.tick(WEAPONS.pistol.reload + 0.01);
    expect(pistol.mag).toBe(6);
    expect(pistol.reserve).toBe(0);
    expect(state.startReload().started).toBe(false);
  });

  it('does not reload a full magazine', () => {
    const state = new WeaponState();
    expect(state.startReload().started).toBe(false);
  });

  it('switches slots, cancelling a reload', () => {
    const state = new WeaponState();
    state.acquire('smg');
    expect(state.slots.filter(Boolean)).toHaveLength(2);
    const active = state.active;
    state.current!.mag = 5;
    state.startReload();
    expect(state.switchWeapon()).toBe(true);
    expect(state.active).not.toBe(active);
    expect(state.reloading).toBe(false);
  });

  it('fills both slots then replaces the active one', () => {
    const state = new WeaponState();
    state.acquire('smg');
    state.acquire('shotgun');
    expect(state.slots[0]?.id).toBe('pistol');
    expect(state.slots[1]?.id).toBe('shotgun');
    state.switchTo(0);
    state.acquire('rifle');
    expect(state.slots[0]?.id).toBe('rifle');
    expect(state.slots[1]?.id).toBe('shotgun');
  });

  it('treats re-buying an owned weapon as an ammo refill', () => {
    const state = new WeaponState();
    state.acquire('smg');
    const smg = state.slotFor('smg')!;
    smg.mag = 3;
    smg.reserve = 10;
    expect(state.acquire('smg')).toBe('ammo');
    expect(smg.mag).toBe(WEAPONS.smg.magazine);
    expect(smg.reserve).toBe(WEAPONS.smg.reserveMax);
    expect(state.acquire('smg')).toBe('full');
  });

  it('buys ammo without touching an unowned weapon', () => {
    const state = new WeaponState();
    expect(state.buyAmmo('rifle')).toBe('missing');
    expect(state.slotFor('rifle')).toBeNull();
  });

  it('upgrades damage up to the cap', () => {
    const state = new WeaponState();
    const slot = state.current!;
    const base = slotDamage(slot);
    expect(state.upgrade('pistol')).toBe(true);
    expect(slotDamage(slot)).toBeGreaterThan(base);
    expect(state.upgrade('pistol')).toBe(true);
    expect(state.upgrade('pistol')).toBe(false);
    expect(slotDamage(slot)).toBeCloseTo(base * 1.7, 5);
  });

  it('restores a validated snapshot without exceeding spec limits', () => {
    const state = new WeaponState();
    state.restore({
      active: 1,
      slots: [
        { id: 'rifle', mag: 999, reserve: 9999, tier: 9 },
        { id: 'smg', mag: -4, reserve: 20, tier: 1 },
      ],
    });
    expect(state.slots[0]?.mag).toBe(WEAPONS.rifle.magazine);
    expect(state.slots[0]?.reserve).toBe(WEAPONS.rifle.reserveMax);
    expect(state.slots[0]?.tier).toBe(3);
    expect(state.slots[1]?.mag).toBe(0);
    expect(state.active).toBe(1);
  });

  it('falls back to the pistol when a snapshot is empty', () => {
    const state = new WeaponState();
    state.restore({ slots: [null, { id: 'not-a-gun' as never }] });
    expect(state.current?.id).toBe('pistol');
  });
});
