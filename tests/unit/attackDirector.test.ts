import { describe, expect, it } from 'vitest';
import { AttackDirector } from '../../src/ai/AttackDirector';

describe('AttackDirector', () => {
  it('limits concurrent attackers', () => {
    const director = new AttackDirector(2);
    expect(director.request(1)).toBe(true);
    expect(director.request(2)).toBe(true);
    expect(director.request(3)).toBe(false);
    expect(director.active).toBe(2);
    director.release(1);
    expect(director.request(3)).toBe(true);
  });

  it('is idempotent for the same holder', () => {
    const director = new AttackDirector(1);
    expect(director.request(7)).toBe(true);
    expect(director.request(7)).toBe(true);
    expect(director.active).toBe(1);
    director.release(7);
    expect(director.has(7)).toBe(false);
  });

  it('releases everyone and adjusts the cap', () => {
    const director = new AttackDirector(3);
    director.request(1);
    director.request(2);
    director.releaseAll();
    expect(director.active).toBe(0);
    director.request(1);
    director.request(2);
    director.setMax(1);
    expect(director.active).toBe(1);
  });
});
