import { describe, expect, it } from 'vitest';
import { CHAPTERS, LEVELS } from '../../src/world/LevelManager';
import { LEVEL_COUNT, LEVEL_IDS } from '../../src/systems/levelIds';

describe('level catalog', () => {
  it('has nine levels whose ids match the save system', () => {
    expect(LEVEL_COUNT).toBe(9);
    expect(LEVELS.length).toBe(LEVEL_COUNT);
    expect(LEVELS.map((level) => level.id)).toEqual([...LEVEL_IDS]);
  });

  it('numbers the levels in order and gives each one its own name', () => {
    expect(LEVELS.map((level) => level.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const names = new Set(LEVELS.map((level) => level.name));
    expect(names.size).toBe(LEVELS.length);
    for (const level of LEVELS) {
      expect(level.subtitle.length).toBeGreaterThan(0);
      expect(level.shortName.length).toBeGreaterThan(0);
      expect(level.waves.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('groups the campaign into three chapters of three levels', () => {
    expect(CHAPTERS).toHaveLength(3);
    for (const [index, level] of LEVELS.entries()) {
      expect(level.chapter).toBe(Math.floor(index / 3) + 1);
    }
  });

  it('flags bosses with boss music and never puts one in the opening level', () => {
    const bosses = LEVELS.filter((level) => level.boss);
    expect(bosses.length).toBeGreaterThanOrEqual(2);
    expect(LEVELS[0]?.boss).toBe(false);
    for (const level of LEVELS) {
      const hasBossWave = level.waves.some((wave) => wave.spawns.some((spawn) => spawn.kind === 'boss'));
      expect(hasBossWave, `${level.id} boss wave`).toBe(level.boss);
      if (level.boss) {
        expect(level.bossMusic).toBe('boss');
        expect(level.bossName?.length).toBeGreaterThan(0);
      }
    }
    expect(LEVELS[LEVELS.length - 1]?.boss).toBe(true);
  });

  it('escalates difficulty across the campaign', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const previous = LEVELS[i - 1]!;
      const current = LEVELS[i]!;
      expect(current.hpScale).toBeGreaterThan(previous.hpScale);
      expect(current.damageScale).toBeGreaterThan(previous.damageScale);
    }
  });
});
