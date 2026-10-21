import { describe, expect, it } from 'vitest';
import {
  lerpPose,
  mergePose,
  poseFor,
  sampleKey,
  type Pose,
} from '../../src/graphics/AnimationSystem';

describe('sampleKey', () => {
  const points: Array<[number, number]> = [
    [0, 0],
    [0.5, 10],
    [1, 0],
  ];

  it('clamps outside the keyframe range', () => {
    expect(sampleKey(-1, points)).toBe(0);
    expect(sampleKey(2, points)).toBe(0);
  });

  it('interpolates linearly between keys', () => {
    expect(sampleKey(0.25, points)).toBeCloseTo(5);
    expect(sampleKey(0.75, points)).toBeCloseTo(5);
    expect(sampleKey(0.5, points)).toBeCloseTo(10);
  });
});

describe('pose math', () => {
  it('merges base pose defaults', () => {
    const base: Pose = { armL: { rz: -0.1 }, elbowL: { rx: -0.2 } };
    const merged = mergePose(base, { armL: { rx: 1 } });
    expect(merged.armL).toEqual({ rz: -0.1, rx: 1 });
    expect(merged.elbowL).toEqual({ rx: -0.2 });
  });

  it('blends poses without NaN', () => {
    const a: Pose = { torso: { rx: 0 }, armR: { rz: 0.5 } };
    const b: Pose = { torso: { rx: 1 }, armR: { rz: -0.5 } };
    const mid = lerpPose(a, b, 0.5);
    expect(mid.torso?.rx).toBeCloseTo(0.5);
    expect(mid.armR?.rz).toBeCloseTo(0);
    const target = lerpPose(a, b, 1);
    expect(target.torso?.rx).toBeCloseTo(1);
  });

  it('produces finite values for every state', () => {
    const states = [
      'idle',
      'walk',
      'run',
      'punch1',
      'punch2',
      'kick',
      'special',
      'dodge',
      'hurt',
      'stun',
      'ko',
      'victory',
      'intro',
      'charge',
      'slam',
      'bag',
      'roar',
    ] as const;
    for (const state of states) {
      const pose = poseFor(state, 0.4, 0.8, {
        progress: 0.4,
        strikeStart: 0.25,
        strikeEnd: 0.45,
      });
      for (const [joint, channel] of Object.entries(pose)) {
        for (const value of Object.values(channel ?? {})) {
          expect(Number.isFinite(value), `${state}.${joint}`).toBe(true);
        }
      }
    }
  });

  it('extends the arm on a punch strike', () => {
    const windup = poseFor('punch1', 0, 1, { progress: 0.2, strikeStart: 0.25, strikeEnd: 0.45 });
    const impact = poseFor('punch1', 0, 1, { progress: 0.32, strikeStart: 0.25, strikeEnd: 0.45 });
    expect(impact.armR?.rx ?? 0).toBeLessThan(windup.armR?.rx ?? 0);
    expect(impact.elbowR?.rx ?? 0).toBeGreaterThan(windup.elbowR?.rx ?? -99);
  });
});
