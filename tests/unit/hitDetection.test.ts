import { describe, expect, it } from 'vitest';
import { isInAttackCone, isInRadius, wrapAngle } from '../../src/combat/HitDetection';

describe('isInAttackCone', () => {
  const origin = { x: 0, z: 0 };
  const forward = { x: 0, z: 1 };

  it('hits a target directly in front within range', () => {
    expect(isInAttackCone(origin, forward, { x: 0, z: 1.5, radius: 0.35 }, 2, 90)).toBe(true);
  });

  it('misses a target behind the attacker', () => {
    expect(isInAttackCone(origin, forward, { x: 0, z: -1.5, radius: 0.35 }, 2, 90)).toBe(false);
  });

  it('misses a target beyond range plus radius', () => {
    expect(isInAttackCone(origin, forward, { x: 0, z: 3, radius: 0.35 }, 2, 120)).toBe(false);
  });

  it('respects the arc angle', () => {
    const diagonal = { x: 1.4, z: 1.4, radius: 0.3 };
    expect(isInAttackCone(origin, forward, diagonal, 2.2, 60)).toBe(false);
    expect(isInAttackCone(origin, forward, diagonal, 2.2, 100)).toBe(true);
  });

  it('always hits at point blank even when facing away', () => {
    expect(isInAttackCone(origin, forward, { x: 0, z: -0.3, radius: 0.35 }, 2, 90)).toBe(true);
  });

  it('normalizes non-normalized forward vectors', () => {
    expect(isInAttackCone(origin, { x: 0, z: 10 }, { x: 0.3, z: 1.2, radius: 0.3 }, 2, 60)).toBe(true);
  });
});

describe('isInRadius', () => {
  it('accounts for target radius', () => {
    expect(isInRadius({ x: 0, z: 0 }, { x: 3.2, z: 0, radius: 0.4 }, 3)).toBe(true);
    expect(isInRadius({ x: 0, z: 0 }, { x: 3.6, z: 0, radius: 0.4 }, 3)).toBe(false);
  });
});

describe('wrapAngle', () => {
  it('wraps angles into [-PI, PI]', () => {
    expect(wrapAngle(Math.PI * 2.5)).toBeCloseTo(Math.PI * 0.5);
    expect(wrapAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(0.4)).toBeCloseTo(0.4);
  });
});
