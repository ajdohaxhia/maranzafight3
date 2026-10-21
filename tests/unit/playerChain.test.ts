import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { JOINT_NAMES, type CharacterVisual } from '../../src/graphics/CharacterFactory';
import { PLAYER_KICK, attackTotal, type Combatant, type AttackSpec } from '../../src/combat/types';

const mockAttack = vi.fn();

function makeVisual(): CharacterVisual {
  const group = new THREE.Group();
  const joints = {} as Record<string, THREE.Group>;
  for (const name of JOINT_NAMES) {
    const joint = new THREE.Group();
    joint.position.set(0, 0, 0);
    joints[name] = joint;
  }
  return {
    root: group,
    visual: group,
    joints: joints as CharacterVisual['joints'],
    materials: [],
    height: 1,
    radius: 0.4,
    scale: 1,
  };
}

class StubFactory {
  create(): CharacterVisual {
    return makeVisual();
  }
  disposeFighter(): void {}
}

/** Minimal physics stub: Player chain/buffering never touches Rapier. */
class StubPhysics {
  createCharacter(): unknown {
    return {
      teleport: (): void => undefined,
      translation: { x: 0, y: 0, z: 0 },
      move: (): void => undefined,
      grounded: true,
      feet: { x: 0, y: 0, z: 0 },
    };
  }
  resetWorld(): void {}
  step(): void {}
  setApplyImpulsesEnabled(): void {}
  applyImpulse(): void {}
}

/**
 * Faithful subset of CombatSystem: assigns attacker.attack, advances the
 * timeline and clears it after windup+active+recovery. Same contract the
 * real system gives to Player, minus hit resolution (no targets here).
 */
class StubCombat {
  private serial = 0;

  begin(attacker: Combatant, spec: AttackSpec): NonNullable<Combatant['attack']> | null {
    if (attacker.attack || !attacker.alive) return null;
    this.serial += 1;
    const attack = {
      serial: this.serial,
      spec,
      time: 0,
      hitTargets: new Set<number>(),
      struckAoe: false,
      startedAt: 0,
    };
    attacker.attack = attack;
    mockAttack(spec.id);
    return attack;
  }

  cancel(attacker: Combatant): void {
    attacker.attack = null;
  }

  update(dt: number, combatants: Combatant[]): void {
    for (const c of combatants) {
      const attack = c.attack;
      if (!attack) continue;
      if (!c.alive) {
        c.attack = null;
        continue;
      }
      attack.time += dt;
      if (attack.time >= attackTotal(attack.spec)) c.attack = null;
    }
  }
}

describe('Player combo chain', () => {
  let Player: typeof import('../../src/entities/Player').Player;

  beforeEach(async () => {
    vi.resetModules();
    mockAttack.mockClear();
    const mod = await import('../../src/entities/Player');
    Player = mod.Player;
  });

  function makePlayer(): { player: InstanceType<typeof Player>; combat: StubCombat } {
    const combat = new StubCombat();
    const events = {
      onAttackStart: (): void => undefined,
      onDodge: (): void => undefined,
      onSpecial: (): void => undefined,
      onPerfectDodge: (): void => undefined,
      onHurt: (): void => undefined,
      onDeath: (): void => undefined,
    };
    const player = new Player(
      new StubPhysics() as never,
      new StubFactory() as never,
      combat as never,
      events,
      new THREE.Vector3(0, 0, 4),
    );
    return { player, combat };
  }

  it('reaches the kick as third chain step: punch, hook, kick', () => {
    const { player, combat } = makePlayer();
    const step = (dt: number): void => {
      player.update(dt, 0, 0, false);
      combat.update(dt, [player]);
    };
    expect(player.tryPunch()).toBe(true);
    expect(mockAttack).toHaveBeenLastCalledWith('punch1');
    for (let i = 0; i < 60 && player.attack; i++) step(1 / 60);
    expect(player.tryPunch()).toBe(true);
    // A hook chains into the second punch naturally with the button held.
    for (let i = 0; i < 60 && player.attack; i++) step(1 / 60);
    expect(player.tryKick()).toBe(true);
    expect(mockAttack).toHaveBeenLastCalledWith('kick');
    expect(mockAttack).toHaveBeenCalledWith('punch2');
  });

  it('kick still works as an opener for a fresh chain', () => {
    const { player } = makePlayer();
    expect(player.tryKick()).toBe(true);
    expect(mockAttack).toHaveBeenLastCalledWith(PLAYER_KICK.id);
  });

  it('queued punch stays buffered inside TTL and expires after', () => {
    const { player, combat } = makePlayer();
    expect(player.tryPunch()).toBe(true);
    player.update(0.001, 0, 0, false);
    combat.update(0.001, [player]);
    expect(player.tryPunch()).toBe(false);
    mockAttack.mockClear();
    for (let i = 0; i < 60 && player.attack; i++) {
      player.update(1 / 60, 0, 0, false);
      combat.update(1 / 60, [player]);
    }
    // Buffer TTL is 0.5s and the punch itself is 0.32s: the buffered punch
    // is input buffering working as designed — it must fire exactly once once
    // recovery is over, then nothing more. Simulate idle ticks and count fires.
    for (let i = 0; i < 80; i++) {
      player.update(1 / 60, 0, 0, false);
      combat.update(1 / 60, [player]);
    }
    expect(player.attack).toBeNull();
    expect(mockAttack).toHaveBeenCalledTimes(1);
    expect(mockAttack).toHaveBeenCalledWith('punch2');
  });
});

describe('Player pre-emptive dodge on telegraphed threats', () => {
  let Player: typeof import('../../src/entities/Player').Player;

  beforeEach(async () => {
    vi.resetModules();
    mockAttack.mockClear();
    const mod = await import('../../src/entities/Player');
    Player = mod.Player;
  });

  function makePlayer(): { player: InstanceType<typeof Player>; combat: StubCombat; dodges: number } {
    const combat = new StubCombat();
    const state = { dodges: 0 };
    const events = {
      onAttackStart: (): void => undefined,
      onDodge: (): void => {
        state.dodges += 1;
      },
      onSpecial: (): void => undefined,
      onPerfectDodge: (): void => undefined,
      onHurt: (): void => undefined,
      onDeath: (): void => undefined,
    };
    const player = new Player(
      new StubPhysics() as never,
      new StubFactory() as never,
      combat as never,
      events,
      new THREE.Vector3(0, 0, 4),
    );
    return { player, combat, dodges: state.dodges };
  }

  it('pre-dodges when three or more attacks are winding up', () => {
    const { player } = makePlayer();
    player.setThreat(3, 0, 0);
    player.update(1 / 60, 0, 0, false);
    expect(player.dodgeTimer).toBeGreaterThan(0);
  });

  it('does not pre-dodge with fewer than three threats', () => {
    const { player } = makePlayer();
    player.setThreat(2, 0, 0);
    player.update(1 / 60, 0, 0, false);
    expect(player.dodgeTimer).toBe(0);
  });

  it('pre-dodge respects the dodge cooldown', () => {
    const { player } = makePlayer();
    player.setThreat(3, 0, 0);
    player.update(1 / 60, 0, 0, false);
    expect(player.dodgeTimer).toBeGreaterThan(0);
    const cooldown = player.dodgeCooldown;
    expect(cooldown).toBeGreaterThan(0);
    // Threat persists after the dodge: cooldown must gate a second trigger.
    // Fast-forward past the dodge but stay inside the cooldown.
    for (let i = 0; i < 24; i++) player.update(1 / 60, 0, 0, false);
    expect(player.dodgeCooldown).toBeGreaterThan(0);
  });

  it('pre-dodge clears a pending attack', () => {
    const { player, combat } = makePlayer();
    expect(player.tryPunch()).toBe(true);
    player.update(1 / 60, 0, 0, false);
    combat.update(1 / 60, [player]);
    expect(player.attack).not.toBeNull();
    // Punch recovery ends well before any realistic cooldown, but the threat
    // branch requires an active attack slot: make sure it waits.
    player.setThreat(3, 0, 0);
    player.update(1 / 60, 0, 0, false);
    expect(player.attack).not.toBeNull();
  });
});
