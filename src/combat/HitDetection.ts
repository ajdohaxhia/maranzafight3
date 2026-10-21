export interface Point2 {
  x: number;
  z: number;
}

export interface CircleBody extends Point2 {
  radius: number;
}

/** Wraps an angle to [-PI, PI]. */
export function wrapAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function distance2(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * True when a body circle lies inside a forward-facing attack cone.
 * The target's radius is forgivingly added to the range and the angular test
 * is skipped at point-blank, so grazing hits still connect.
 */
export function isInAttackCone(
  origin: Point2,
  forward: Point2,
  target: CircleBody,
  range: number,
  arcDegrees: number,
): boolean {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > range + target.radius) return false;
  if (dist <= 0.35 + target.radius * 0.5) return true;

  const length = Math.hypot(forward.x, forward.z);
  if (length < 1e-5) return false;
  const fx = forward.x / length;
  const fz = forward.z / length;
  const dot = (dx / dist) * fx + (dz / dist) * fz;
  const clamped = Math.max(-1, Math.min(1, dot));
  const angle = Math.acos(clamped);
  const halfArc = Math.max(0.05, (arcDegrees * Math.PI) / 180 / 2);
  return angle <= halfArc;
}

export function isInRadius(origin: Point2, target: CircleBody, radius: number): boolean {
  return distance2(origin, target) <= radius + target.radius;
}

/** Deterministic small hash used for procedural visuals. */
export function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
