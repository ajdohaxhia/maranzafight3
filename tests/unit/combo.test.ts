import { describe, expect, it } from 'vitest';
import {
  ComboTracker,
  MAX_COMBO_MULTIPLIER,
  multiplierForCombo,
  scoreForHit,
} from '../../src/combat/ComboSystem';

describe('multiplierForCombo', () => {
  it('starts at 1x and grows every three hits', () => {
    expect(multiplierForCombo(0)).toBe(1);
    expect(multiplierForCombo(1)).toBe(1);
    expect(multiplierForCombo(3)).toBe(1);
    expect(multiplierForCombo(4)).toBe(1.25);
    expect(multiplierForCombo(7)).toBe(1.5);
  });

  it('is capped', () => {
    expect(multiplierForCombo(999)).toBe(MAX_COMBO_MULTIPLIER);
  });
});

describe('scoreForHit', () => {
  it('scales with damage and multiplier', () => {
    expect(scoreForHit(10, 1)).toBe(100);
    expect(scoreForHit(10, 2)).toBe(200);
    expect(scoreForHit(10, 1.25, true)).toBe(275);
  });
});

describe('ComboTracker', () => {
  it('counts hits and tracks the best combo', () => {
    const combo = new ComboTracker(2);
    combo.registerHit();
    expect(combo.count).toBe(1);
    expect(combo.active).toBe(false);
    combo.registerHit();
    combo.registerHit();
    combo.registerHit();
    expect(combo.count).toBe(4);
    expect(combo.best).toBe(4);
    expect(combo.multiplier).toBe(1.25);
    expect(combo.active).toBe(true);
  });

  it('expires after the window and resets', () => {
    const combo = new ComboTracker(1);
    combo.registerHit();
    combo.registerHit();
    expect(combo.update(0.6)).toBe(false);
    expect(combo.count).toBe(2);
    expect(combo.update(0.5)).toBe(true);
    expect(combo.count).toBe(0);
    expect(combo.best).toBe(2);
  });

  it('resets manually', () => {
    const combo = new ComboTracker();
    combo.registerHit();
    combo.registerHit();
    combo.reset();
    expect(combo.count).toBe(0);
    expect(combo.timer).toBe(0);
  });
});
