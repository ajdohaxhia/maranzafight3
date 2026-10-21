import * as THREE from 'three';
import { JOINT_NAMES, type CharacterVisual, type JointName } from './CharacterFactory';

export type AnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'punch1'
  | 'punch2'
  | 'kick'
  | 'special'
  | 'dodge'
  | 'hurt'
  | 'stun'
  | 'ko'
  | 'victory'
  | 'intro'
  | 'charge'
  | 'slam'
  | 'bag'
  | 'roar';

export interface PoseChannel {
  rx?: number;
  ry?: number;
  rz?: number;
  px?: number;
  py?: number;
  pz?: number;
}

export type Pose = Partial<Record<JointName, PoseChannel>> & { root?: PoseChannel };

export interface AttackTiming {
  progress: number;
  strikeStart: number;
  strikeEnd: number;
}

export const BASE_POSE: Pose = {
  armL: { rz: -0.08, rx: 0.04 },
  armR: { rz: 0.08, rx: 0.04 },
  elbowL: { rx: -0.22 },
  elbowR: { rx: -0.22 },
  kneeL: { rx: 0.04 },
  kneeR: { rx: 0.04 },
};

const ONE_SHOT_STATES = new Set<AnimState>(['punch1', 'punch2', 'kick', 'special', 'dodge', 'hurt', 'ko']);

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function easeOutCubic(t: number): number {
  const p = clamp01(t);
  return 1 - Math.pow(1 - p, 3);
}

function smoothstep(t: number): number {
  const p = clamp01(t);
  return p * p * (3 - 2 * p);
}

/** Piecewise linear keyframe sampler. Points must be sorted by time. */
export function sampleKey(t: number, points: Array<[number, number]>): number {
  if (points.length === 0) return 0;
  if (t <= (points[0]?.[0] ?? 0)) return points[0]?.[1] ?? 0;
  const last = points[points.length - 1];
  if (!last) return 0;
  if (t >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    if (t <= b[0]) {
      const span = b[0] - a[0];
      if (span <= 1e-6) return b[1];
      const f = (t - a[0]) / span;
      return a[1] + (b[1] - a[1]) * f;
    }
  }
  return last[1];
}

export function lerpPose(from: Pose, to: Pose, t: number): Pose {
  const out: Pose = {};
  const factor = smoothstep(t);
  const keys = new Set<string>([...Object.keys(from), ...Object.keys(to)]);
  for (const name of keys) {
    const a = (from as Record<string, PoseChannel | undefined>)[name] ?? {};
    const b = (to as Record<string, PoseChannel | undefined>)[name] ?? {};
    const merged: PoseChannel = {};
    merged.rx = (a.rx ?? 0) + ((b.rx ?? 0) - (a.rx ?? 0)) * factor;
    merged.ry = (a.ry ?? 0) + ((b.ry ?? 0) - (a.ry ?? 0)) * factor;
    merged.rz = (a.rz ?? 0) + ((b.rz ?? 0) - (a.rz ?? 0)) * factor;
    merged.px = (a.px ?? 0) + ((b.px ?? 0) - (a.px ?? 0)) * factor;
    merged.py = (a.py ?? 0) + ((b.py ?? 0) - (a.py ?? 0)) * factor;
    merged.pz = (a.pz ?? 0) + ((b.pz ?? 0) - (a.pz ?? 0)) * factor;
    (out as Record<string, PoseChannel>)[name] = merged;
  }
  return out;
}

export function mergePose(base: Pose, target: Pose): Pose {
  const out: Pose = {};
  for (const joint of JOINT_NAMES) {
    const b = base[joint];
    const t = target[joint];
    if (!b && !t) continue;
    out[joint] = { ...(b ?? {}), ...(t ?? {}) };
  }
  const b = base.root;
  const t = target.root;
  if (b || t) out.root = { ...(b ?? {}), ...(t ?? {}) };
  return out;
}

function punchPose(p: number, side: 1 | -1, timing: AttackTiming): Pose {
  const ss = timing.strikeStart;
  const se = Math.max(ss + 0.04, timing.strikeEnd);
  const impact = ss + (se - ss) * 0.35;
  const arm = side === 1 ? 'armR' : 'armL';
  const elbow = side === 1 ? 'elbowR' : 'elbowL';
  const otherArm = side === 1 ? 'armL' : 'armR';
  const otherElbow = side === 1 ? 'elbowL' : 'elbowR';
  const pose: Pose = {
    body: { py: sampleKey(p, [[0, 0], [ss, 0.01], [impact, -0.03], [1, 0]]) },
    torso: {
      ry: sampleKey(p, [[0, 0], [ss * 0.9, 0.34 * side], [impact, -0.52 * side], [se + 0.09, -0.28 * side], [1, 0]]),
      rx: sampleKey(p, [[0, 0.02], [impact, 0.08], [1, 0]]),
    },
    head: { ry: sampleKey(p, [[0, 0], [ss * 0.9, -0.18 * side], [impact, 0.28 * side], [1, 0]]) },
    [arm]: {
      rx: sampleKey(p, [[0, 0.04], [ss * 0.92, 0.62], [impact, -1.58], [se + 0.06, -1.5], [1, 0.04]]),
      rz: sampleKey(p, [[0, 0.08 * side], [ss * 0.92, 0.2 * side], [impact, -0.05 * side], [1, 0.08 * side]]),
    },
    [elbow]: {
      rx: sampleKey(p, [[0, -0.22], [ss * 0.92, -1.35], [impact, -0.06], [se + 0.05, -0.3], [1, -0.22]]),
    },
    [otherArm]: {
      rx: sampleKey(p, [[0, 0.04], [ss, 0.3], [impact, -0.38], [1, 0.04]]),
      rz: sampleKey(p, [[0, -0.08 * side], [ss, 0.22 * side], [1, -0.08 * side]]),
    },
    [otherElbow]: { rx: sampleKey(p, [[0, -0.22], [impact, -1.15], [1, -0.22]]) },
    legL: { rx: sampleKey(p, [[0, 0], [impact, 0.08], [1, 0]]) },
    legR: { rx: sampleKey(p, [[0, 0], [impact, -0.1], [1, 0]]) },
    root: { pz: sampleKey(p, [[0, 0], [impact, 0.09], [se, 0.05], [1, 0]]) },
  };
  return pose;
}

function kickPose(p: number, timing: AttackTiming): Pose {
  const ss = timing.strikeStart;
  const se = Math.max(ss + 0.06, timing.strikeEnd);
  const impact = ss + (se - ss) * 0.4;
  return {
    body: { py: sampleKey(p, [[0, 0], [ss, 0.02], [impact, -0.02], [1, 0]]) },
    torso: {
      rx: sampleKey(p, [[0, 0], [ss, 0.3], [impact, -0.3], [se + 0.08, -0.2], [1, 0]]),
      ry: sampleKey(p, [[0, 0], [ss, 0.38], [impact, -0.55], [se + 0.1, -0.3], [1, 0]]),
    },
    head: {
      rx: sampleKey(p, [[0, 0], [impact, -0.15], [1, 0]]),
      ry: sampleKey(p, [[0, 0], [impact, 0.3], [1, 0]]),
    },
    legR: {
      rx: sampleKey(p, [[0, 0], [ss, 0.5], [impact, -1.52], [se + 0.06, -1.42], [1, 0]]),
      rz: sampleKey(p, [[0, 0], [ss, -0.12], [impact, 0.14], [1, 0]]),
    },
    kneeR: {
      rx: sampleKey(p, [[0, 0.04], [ss, 1.45], [impact, 0.14], [se + 0.05, 0.32], [1, 0.04]]),
    },
    legL: { rx: sampleKey(p, [[0, 0], [impact, 0.15], [1, 0]]), rz: sampleKey(p, [[0, 0], [impact, -0.08], [1, 0]]) },
    kneeL: { rx: sampleKey(p, [[0, 0.04], [impact, 0.2], [1, 0.04]]) },
    armL: {
      rx: sampleKey(p, [[0, 0.04], [ss, -0.45], [impact, 0.85], [1, 0.04]]),
      rz: sampleKey(p, [[0, -0.08], [impact, -1.05], [1, -0.08]]),
    },
    armR: {
      rx: sampleKey(p, [[0, 0.04], [ss, -0.35], [impact, -0.7], [1, 0.04]]),
      rz: sampleKey(p, [[0, 0.08], [impact, 0.85], [1, 0.08]]),
    },
    elbowL: { rx: sampleKey(p, [[0, -0.22], [impact, -0.35], [1, -0.22]]) },
    elbowR: { rx: sampleKey(p, [[0, -0.22], [impact, -0.65], [1, -0.22]]) },
    root: {
      pz: sampleKey(p, [[0, 0], [impact, 0.13], [se, 0.08], [1, 0]]),
      py: sampleKey(p, [[0, 0], [ss, -0.02], [impact, 0.03], [1, 0]]),
    },
  };
}

function walkPose(time: number, speedScale: number): Pose {
  const phase = time * 7.2 * speedScale;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  return {
    body: { py: Math.abs(c) * 0.022 - 0.008, ry: s * 0.07 },
    torso: { rx: 0.04 + Math.abs(c) * 0.02, ry: -s * 0.1 },
    head: { ry: s * 0.06, rx: -0.02 },
    legL: { rx: -s * 0.58, rz: -0.02 },
    legR: { rx: s * 0.58, rz: 0.02 },
    kneeL: { rx: Math.max(0, s) * 0.55 + 0.06 },
    kneeR: { rx: Math.max(0, -s) * 0.55 + 0.06 },
    armL: { rx: s * 0.5, rz: -0.08 },
    armR: { rx: -s * 0.5, rz: 0.08 },
    elbowL: { rx: -0.3 - Math.max(0, -s) * 0.2 },
    elbowR: { rx: -0.3 - Math.max(0, s) * 0.2 },
  };
}

function runPose(time: number): Pose {
  const phase = time * 9.8;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  return {
    body: { py: Math.abs(c) * 0.055, ry: s * 0.1 },
    torso: { rx: 0.19, ry: -s * 0.16 },
    head: { rx: -0.12, ry: s * 0.08 },
    legL: { rx: -s * 0.92 },
    legR: { rx: s * 0.92 },
    kneeL: { rx: Math.max(0, s) * 1.05 + 0.15 },
    kneeR: { rx: Math.max(0, -s) * 1.05 + 0.15 },
    armL: { rx: s * 0.85, rz: -0.12 },
    armR: { rx: -s * 0.85, rz: 0.12 },
    elbowL: { rx: -1.05 },
    elbowR: { rx: -1.05 },
  };
}

/** Computes a full pose for a state. Pure function: unit-tested. */
export function poseFor(
  state: AnimState,
  time: number,
  duration: number,
  attack?: AttackTiming,
): Pose {
  const timing: AttackTiming = attack ?? {
    progress: duration > 0 ? clamp01(time / duration) : 0,
    strikeStart: 0.28,
    strikeEnd: 0.45,
  };
  const p = clamp01(timing.progress);

  switch (state) {
    case 'idle': {
      const breathe = Math.sin(time * 1.8);
      const sway = Math.sin(time * 0.55);
      return {
        body: { py: breathe * 0.008, ry: sway * 0.03 },
        torso: { rx: 0.025 + breathe * 0.012, ry: sway * 0.04 },
        head: { ry: sway * 0.12, rx: -0.03 + breathe * 0.01 },
        armL: { rx: 0.08 + breathe * 0.04, rz: -0.1 },
        armR: { rx: 0.08 - breathe * 0.04, rz: 0.1 },
        elbowL: { rx: -0.55 - breathe * 0.06 },
        elbowR: { rx: -0.55 + breathe * 0.06 },
        legL: { rz: -0.03 },
        legR: { rz: 0.03 },
        kneeL: { rx: 0.06 },
        kneeR: { rx: 0.06 },
      };
    }
    case 'walk':
      return walkPose(time, 1);
    case 'run':
      return runPose(time);
    case 'punch1':
      return punchPose(p, 1, timing);
    case 'punch2':
      return punchPose(p, -1, timing);
    case 'kick':
      return kickPose(p, timing);
    case 'special': {
      const charge = sampleKey(p, [[0, 0], [0.24, -0.16], [0.4, 0.06], [0.62, -0.06], [1, 0]]);
      const burst = sampleKey(p, [[0, 0], [0.28, 0], [0.44, 1], [0.7, 0.65], [1, 0]]);
      return {
        body: { py: charge },
        torso: {
          rx: sampleKey(p, [[0, 0.02], [0.26, 0.35], [0.44, -0.32], [1, 0.02]]),
          rz: Math.sin(p * Math.PI) * 0.12,
        },
        head: { rx: sampleKey(p, [[0, 0], [0.3, 0.2], [0.48, -0.3], [1, 0]]) },
        armL: {
          rx: sampleKey(p, [[0, 0.04], [0.24, 0.95], [0.46, -2.35], [0.7, -2.1], [1, 0.04]]),
          rz: sampleKey(p, [[0, -0.08], [0.24, -0.35], [0.46, -1.25], [1, -0.08]]),
        },
        armR: {
          rx: sampleKey(p, [[0, 0.04], [0.24, 0.95], [0.46, -2.35], [0.7, -2.1], [1, 0.04]]),
          rz: sampleKey(p, [[0, 0.08], [0.24, 0.35], [0.46, 1.25], [1, 0.08]]),
        },
        elbowL: { rx: sampleKey(p, [[0, -0.22], [0.24, -1.4], [0.46, -0.15], [1, -0.22]]) },
        elbowR: { rx: sampleKey(p, [[0, -0.22], [0.24, -1.4], [0.46, -0.15], [1, -0.22]]) },
        legL: { rx: sampleKey(p, [[0, 0], [0.24, 0.25], [0.46, -0.1], [1, 0]]), rz: -0.04 - burst * 0.16 },
        legR: { rx: sampleKey(p, [[0, 0], [0.24, 0.25], [0.46, -0.1], [1, 0]]), rz: 0.04 + burst * 0.16 },
        kneeL: { rx: sampleKey(p, [[0, 0.04], [0.24, 0.75], [0.46, 0.1], [1, 0.04]]) },
        kneeR: { rx: sampleKey(p, [[0, 0.04], [0.24, 0.75], [0.46, 0.1], [1, 0.04]]) },
        root: { py: sampleKey(p, [[0, 0], [0.28, 0], [0.46, 0.12], [1, 0]]) },
      };
    }
    case 'dodge': {
      const t = easeOutCubic(p);
      return {
        body: { py: -0.14 + Math.abs(Math.sin(p * Math.PI)) * 0.04, rz: -0.1 * Math.sin(p * Math.PI) },
        torso: { rx: 0.32, rz: 0.12 * Math.sin(p * Math.PI), ry: -0.2 * t },
        head: { rx: -0.18, ry: 0.3 * t },
        armL: { rx: 0.7, rz: -0.55 },
        armR: { rx: 0.95, rz: 0.4 },
        elbowL: { rx: -1.5 },
        elbowR: { rx: -1.65 },
        legL: { rx: 0.6, rz: -0.2 },
        legR: { rx: -0.35, rz: 0.16 },
        kneeL: { rx: 1.15 },
        kneeR: { rx: 0.65 },
      };
    }
    case 'hurt': {
      const strike = p < 0.3 ? easeOutCubic(p / 0.3) : 1 - smoothstep((p - 0.3) / 0.7);
      return {
        body: { py: -0.03 * strike },
        torso: { rx: -0.45 * strike, rz: 0.12 * strike },
        head: { rx: -0.42 * strike, rz: 0.1 * strike },
        armL: { rx: -0.6 * strike, rz: -0.45 * strike },
        armR: { rx: -0.5 * strike, rz: 0.5 * strike },
        elbowL: { rx: -0.9 },
        elbowR: { rx: -0.9 },
        legL: { rx: 0.15 * strike },
        legR: { rx: -0.18 * strike },
        kneeL: { rx: 0.35 * strike + 0.04 },
        kneeR: { rx: 0.28 * strike + 0.04 },
      };
    }
    case 'stun': {
      const wobble = Math.sin(time * 8.5);
      return {
        body: { py: -0.06, ry: wobble * 0.1 },
        torso: { rx: 0.2, rz: wobble * 0.16 },
        head: { rx: 0.3, rz: -wobble * 0.22, ry: wobble * 0.16 },
        armL: { rx: 0.25, rz: -0.3 },
        armR: { rx: 0.2, rz: 0.32 },
        elbowL: { rx: -0.55 },
        elbowR: { rx: -0.5 },
        legL: { rz: -0.08, rx: 0.1 },
        legR: { rz: 0.08, rx: -0.1 },
        kneeL: { rx: 0.3 },
        kneeR: { rx: 0.32 },
      };
    }
    case 'ko': {
      const fall = easeOutCubic(p);
      return {
        body: { py: -0.1 * fall },
        torso: { rx: 0.1 * (1 - fall) },
        head: { rx: -0.3 * fall },
        armL: { rx: -0.4, rz: -0.9 * fall, ry: 0 },
        armR: { rx: -0.3, rz: 0.9 * fall },
        elbowL: { rx: -0.5 - fall * 0.3 },
        elbowR: { rx: -0.45 - fall * 0.25 },
        legL: { rx: -0.25 * fall, rz: -0.2 * fall },
        legR: { rx: 0.2 * fall, rz: 0.18 * fall },
        kneeL: { rx: 0.55 * fall + 0.04 },
        kneeR: { rx: 0.35 * fall + 0.04 },
        root: { rx: -1.52 * fall, py: 0.02 * fall, pz: -0.06 * fall },
      };
    }
    case 'victory': {
      const bounce = Math.abs(Math.sin(time * 3.4));
      const pump = Math.sin(time * 6.8);
      return {
        body: { py: bounce * 0.13 },
        torso: { rx: -0.08, ry: Math.sin(time * 1.7) * 0.1 },
        head: { rx: -0.18, ry: Math.sin(time * 1.3) * 0.18 },
        armL: { rx: -2.55 - pump * 0.28, rz: -0.28 },
        armR: { rx: -2.55 + pump * 0.28, rz: 0.28 },
        elbowL: { rx: -0.18 },
        elbowR: { rx: -0.18 },
        legL: { rx: -bounce * 0.35, rz: -0.08 },
        legR: { rx: bounce * 0.2, rz: 0.08 },
        kneeL: { rx: bounce * 0.55 + 0.04 },
        kneeR: { rx: bounce * 0.15 + 0.04 },
      };
    }
    case 'intro': {
      const breathe = Math.sin(time * 2.2);
      return {
        body: { py: breathe * 0.015 },
        torso: { rx: -0.1, ry: Math.sin(time * 0.8) * 0.06 },
        head: { rx: -0.22, ry: Math.sin(time * 0.5) * 0.16 },
        armL: { rx: -0.3, rz: -1.0 + breathe * 0.05 },
        armR: { rx: -0.3, rz: 1.0 - breathe * 0.05 },
        elbowL: { rx: -0.9 },
        elbowR: { rx: -0.9 },
        legL: { rz: -0.14 },
        legR: { rz: 0.14 },
        kneeL: { rx: 0.12 },
        kneeR: { rx: 0.12 },
      };
    }
    case 'roar': {
      const shake = Math.sin(time * 22) * 0.035;
      return {
        body: { py: Math.abs(Math.sin(time * 3)) * 0.02 },
        torso: { rx: -0.26 + shake, rz: shake * 0.5 },
        head: { rx: -0.5, rz: shake },
        armL: { rx: -1.9, rz: -1.25 },
        armR: { rx: -1.9, rz: 1.25 },
        elbowL: { rx: -0.35 },
        elbowR: { rx: -0.35 },
        legL: { rx: 0.18, rz: -0.2 },
        legR: { rx: -0.18, rz: 0.2 },
        kneeL: { rx: 0.4 },
        kneeR: { rx: 0.4 },
      };
    }
    case 'charge': {
      const phase = time * 12;
      const s = Math.sin(phase);
      return {
        body: { py: Math.abs(Math.cos(phase)) * 0.05 },
        torso: { rx: 0.52, ry: s * 0.12 },
        head: { rx: -0.35 },
        armL: { rx: 0.9, rz: -0.3 },
        armR: { rx: 0.9, rz: 0.3 },
        elbowL: { rx: -1.2 },
        elbowR: { rx: -1.2 },
        legL: { rx: -s * 0.95 },
        legR: { rx: s * 0.95 },
        kneeL: { rx: Math.max(0, s) * 0.9 + 0.1 },
        kneeR: { rx: Math.max(0, -s) * 0.9 + 0.1 },
      };
    }
    case 'slam': {
      const raise = sampleKey(p, [[0, 0], [0.34, 1], [0.52, 0.12], [0.7, 0.18], [1, 0]]);
      return {
        body: { py: sampleKey(p, [[0, 0], [0.34, 0.02], [0.52, -0.14], [0.72, -0.1], [1, 0]]) },
        torso: { rx: sampleKey(p, [[0, 0], [0.34, -0.28], [0.54, 0.55], [0.75, 0.4], [1, 0]]) },
        head: { rx: sampleKey(p, [[0, 0], [0.34, -0.25], [0.54, 0.3], [1, 0]]) },
        armL: {
          rx: sampleKey(p, [[0, 0.04], [0.34, -2.9], [0.52, 0.45], [0.72, 0.3], [1, 0.04]]),
          rz: -0.18,
        },
        armR: {
          rx: sampleKey(p, [[0, 0.04], [0.34, -2.9], [0.52, 0.45], [0.72, 0.3], [1, 0.04]]),
          rz: 0.18,
        },
        elbowL: { rx: sampleKey(p, [[0, -0.22], [0.34, -0.15], [0.52, -0.1], [1, -0.22]]) },
        elbowR: { rx: sampleKey(p, [[0, -0.22], [0.34, -0.15], [0.52, -0.1], [1, -0.22]]) },
        legL: { rx: sampleKey(p, [[0, 0], [0.34, 0.08], [0.52, 0.55], [1, 0]]) },
        legR: { rx: sampleKey(p, [[0, 0], [0.34, 0.08], [0.52, 0.55], [1, 0]]) },
        kneeL: { rx: sampleKey(p, [[0, 0.04], [0.52, 0.9], [1, 0.04]]) },
        kneeR: { rx: sampleKey(p, [[0, 0.04], [0.52, 0.9], [1, 0.04]]) },
        root: { py: raise * 0 },
      };
    }
    case 'bag': {
      const ss = timing.strikeStart;
      const se = Math.max(ss + 0.06, timing.strikeEnd);
      const swing = sampleKey(p, [[0, 0], [ss, -1], [ss + (se - ss) * 0.4, 1.15], [se + 0.08, 0.9], [1, 0]]);
      return {
        body: { ry: swing * 0.22 },
        torso: { ry: swing * 0.55, rx: sampleKey(p, [[0, 0], [ss, 0.18], [se, -0.12], [1, 0]]) },
        head: { ry: -swing * 0.3 },
        armR: {
          rx: sampleKey(p, [[0, 0.04], [ss, 0.9], [ss + 0.12, 0.2], [se, -1.2], [1, 0.04]]),
          rz: sampleKey(p, [[0, 0.08], [ss, 0.9], [se, -0.9], [1, 0.08]]),
        },
        elbowR: { rx: sampleKey(p, [[0, -0.22], [ss, -1.2], [ss + 0.12, -0.1], [1, -0.22]]) },
        armL: { rx: 0.4, rz: -0.7 },
        elbowL: { rx: -1.1 },
        legL: { rx: -0.18 },
        legR: { rx: 0.22 },
        kneeL: { rx: 0.15 },
        kneeR: { rx: 0.2 },
      };
    }
    default:
      return {};
  }
}

interface PlayOptions {
  duration?: number;
  reset?: boolean;
  rate?: number;
}

export class AnimationSystem {
  private readonly rig: CharacterVisual;
  private readonly basePositions = new Map<JointName, THREE.Vector3>();
  private state: AnimState = 'idle';
  private time = 0;
  private duration = 0;
  private rate = 1;
  private blend = 1;
  private fromPose: Pose = {};
  private attack: AttackTiming | null = null;
  private lastPose: Pose = {};
  private applied = false;

  constructor(rig: CharacterVisual) {
    this.rig = rig;
    for (const joint of JOINT_NAMES) {
      this.basePositions.set(joint, rig.joints[joint].position.clone());
    }
    this.applyPose(mergePose(BASE_POSE, poseFor('idle', 0, 0)));
  }

  get currentState(): AnimState {
    return this.state;
  }

  get progress(): number {
    if (this.attack) return this.attack.progress;
    if (this.duration <= 0) return 0;
    return Math.min(1, this.time / this.duration);
  }

  play(state: AnimState, options: PlayOptions = {}): void {
    const reset = options.reset ?? state !== this.state;
    if (state === this.state && !reset) {
      if (options.rate !== undefined) this.rate = options.rate;
      return;
    }
    if (this.applied) this.fromPose = this.lastPose;
    this.blend = 0;
    this.state = state;
    this.time = 0;
    this.duration = options.duration ?? 0;
    this.rate = options.rate ?? 1;
    this.attack = null;
    this.applied = true;
  }

  setAttack(
    state: AnimState,
    progress: number,
    strikeStart: number,
    strikeEnd: number,
    reset = false,
  ): void {
    if (state !== this.state || reset) {
      if (this.applied) this.fromPose = this.lastPose;
      this.blend = 0;
      this.state = state;
      this.time = 0;
      this.duration = 0;
      this.applied = true;
    }
    this.attack = {
      progress: clamp01(progress),
      strikeStart: clamp01(strikeStart),
      strikeEnd: clamp01(strikeEnd),
    };
  }

  update(dt: number): void {
    if (!this.attack) {
      this.time += dt * this.rate;
      if (this.duration > 0) this.time = Math.min(this.time, this.duration);
    }
    const target = mergePose(BASE_POSE, poseFor(this.state, this.time, this.duration, this.attack ?? undefined));
    let pose = target;
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt * 11);
      pose = lerpPose(this.fromPose, target, this.blend);
    }
    this.applyPose(pose);
    this.lastPose = pose;
    this.applied = true;
  }

  private applyPose(pose: Pose): void {
    for (const name of JOINT_NAMES) {
      const joint = this.rig.joints[name];
      const channel = pose[name];
      const base = this.basePositions.get(name);
      if (channel) {
        joint.rotation.set(channel.rx ?? 0, channel.ry ?? 0, channel.rz ?? 0);
        joint.position.set(
          (base?.x ?? 0) + (channel.px ?? 0),
          (base?.y ?? 0) + (channel.py ?? 0),
          (base?.z ?? 0) + (channel.pz ?? 0),
        );
      } else {
        joint.rotation.set(0, 0, 0);
        if (base) joint.position.copy(base);
      }
    }
    const root = pose.root ?? {};
    this.rig.visual.position.set(root.px ?? 0, root.py ?? 0, root.pz ?? 0);
    this.rig.visual.rotation.set(root.rx ?? 0, root.ry ?? 0, root.rz ?? 0);
  }

  isOneShot(): boolean {
    return ONE_SHOT_STATES.has(this.state);
  }

  get stateTime(): number {
    return this.time;
  }
}
