import { isInAttackCone, isInRadius } from './HitDetection';
import type { ActiveAttack, AttackSpec, Combatant, HitInfo } from './types';
import { attackTotal } from './types';

export interface CombatEvents {
  onDamage(attacker: Combatant, target: Combatant, info: HitInfo, spec: AttackSpec): void;
  onPerfectDodge(attacker: Combatant, target: Combatant, spec: AttackSpec): void;
}

/**
 * Advances attack timelines and resolves hits against hurtboxes.
 * Timing model: windup (telegraph) → active frames (hits) → recovery.
 * A target can only be hit once per attack, multiple targets can be hit.
 */
export class CombatSystem {
  private serial = 0;
  private events: CombatEvents;
  hitstopPending = 0;

  constructor(events: CombatEvents) {
    this.events = events;
  }

  begin(attacker: Combatant, spec: AttackSpec): ActiveAttack | null {
    if (attacker.attack || !attacker.alive) return null;
    this.serial += 1;
    const attack: ActiveAttack = {
      serial: this.serial,
      spec,
      time: 0,
      hitTargets: new Set(),
      struckAoe: false,
      startedAt: performance.now(),
    };
    attacker.attack = attack;
    return attack;
  }

  cancel(attacker: Combatant): void {
    attacker.attack = null;
  }

  update(dt: number, combatants: Combatant[]): void {
    this.hitstopPending = 0;
    for (const attacker of combatants) {
      const attack = attacker.attack;
      if (!attack) continue;
      if (!attacker.alive) {
        attacker.attack = null;
        continue;
      }
      const spec = attack.spec;
      const total = attackTotal(spec);
      const previous = attack.time;
      attack.time += dt;
      const activeStart = spec.windup;
      const activeEnd = spec.windup + spec.active;

      const isActive = attack.time >= activeStart && previous <= activeEnd;
      if (isActive) {
        this.resolve(attacker, attack, combatants);
      }

      if (attack.time >= total) {
        attacker.attack = null;
      }
    }
  }

  private resolve(attacker: Combatant, attack: ActiveAttack, combatants: Combatant[]): void {
    const spec = attack.spec;
    for (const target of combatants) {
      if (target.team === attacker.team || !target.alive) continue;
      if (attack.hitTargets.has(target.id)) continue;

      if (spec.aoe) {
        if (attack.struckAoe) continue;
        if (!isInRadius({ x: attacker.posX, z: attacker.posZ }, { x: target.posX, z: target.posZ, radius: target.radius }, spec.aoeRadius ?? spec.range)) {
          continue;
        }
      } else {
        const inCone = isInAttackCone(
          { x: attacker.posX, z: attacker.posZ },
          { x: attacker.forwardX, z: attacker.forwardZ },
          { x: target.posX, z: target.posZ, radius: target.radius },
          spec.range,
          spec.arc,
        );
        if (!inCone) continue;
      }

      if (target.isInvulnerable()) {
        if (target.isDodging()) {
          attack.hitTargets.add(target.id);
          this.events.onPerfectDodge(attacker, target, spec);
        }
        continue;
      }

      const dx = target.posX - attacker.posX;
      const dz = target.posZ - attacker.posZ;
      const length = Math.hypot(dx, dz) || 1;
      const info: HitInfo = {
        damage: spec.damage,
        dirX: dx / length,
        dirZ: dz / length,
        knockback: spec.knockback,
        hitstun: spec.hitstun,
        hitstop: spec.hitstop,
        heavy: spec.heavy,
        specId: spec.id,
        fromX: attacker.posX,
        fromZ: attacker.posZ,
      };
      attack.hitTargets.add(target.id);
      target.applyHit(info, attacker);
      this.events.onDamage(attacker, target, info, spec);
      this.hitstopPending = Math.max(this.hitstopPending, spec.hitstop);
    }
    if (spec.aoe) attack.struckAoe = true;
  }
}
