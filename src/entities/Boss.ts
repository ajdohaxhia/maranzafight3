import * as THREE from 'three';
import type { AttackSpec, Combatant, HitInfo } from '../combat/types';
import type { AttackDirector } from '../ai/AttackDirector';
import type { CombatSystem } from '../combat/CombatSystem';
import type { Physics } from '../core/Physics';
import type { CharacterFactory } from '../graphics/CharacterFactory';
import { Enemy, type EnemyArchetype, type EnemyContext, type EnemyScaling } from './Enemy';

export type BossId = 'borsello' | 'tetti' | 'buttafuori' | 'trainer' | 'dj' | 'consiglio';

export interface BossProfile {
  id: BossId;
  name: string;
  kicker: string;
  quote: string;
  /** Base HP before the level hpScale is applied. */
  hp: number;
  speed: number;
  damage: number;
  score: number;
  /** Index into CharacterFactory's boss outfit table. */
  variant: number;
  phaseLabels: [string, string, string];
  close: AttackSpec;
  heavy: AttackSpec;
  charge: AttackSpec;
}

export const BOSS_ARCHETYPE: EnemyArchetype = {
  kind: 'boss',
  label: 'IL RE DEL BORSELLO',
  look: 'boss',
  hp: 520,
  speed: 2.95,
  damage: 20,
  range: 3.35,
  arc: 160,
  windup: 0.6,
  active: 0.16,
  recovery: 0.55,
  knockback: 8,
  hitstun: 0.4,
  poise: 240,
  stunDuration: 0.4,
  cooldownMin: 1.6,
  cooldownMax: 2.5,
  score: 6000,
  attackAnim: 'bag',
  radius: 0.5,
  halfHeight: 0.62,
  desiredDistance: 2.6,
};

/** Shared attack timing so every boss telegraphs with the same readable rhythm. */
const bossAttack = (
  id: string,
  label: string,
  anim: AttackSpec['anim'],
  damage: number,
  overrides: Partial<AttackSpec> = {},
): AttackSpec => ({
  id,
  label,
  anim,
  damage,
  range: 3.4,
  arc: 170,
  windup: 0.55,
  active: 0.18,
  recovery: 0.55,
  knockback: 8,
  hitstun: 0.36,
  hitstop: 0.1,
  heavy: true,
  telegraphRadius: 3.4,
  telegraphColor: '#b04dff',
  ...overrides,
});

export const BOSS_BAG = bossAttack('bossBag', 'BORSELLATA', 'bag', 20);

export const BOSS_SLAM = bossAttack('bossSlam', 'TERREMOTO DA PIAZZA', 'slam', 24, {
  range: 3.9,
  arc: 360,
  windup: 0.95,
  active: 0.12,
  recovery: 0.72,
  knockback: 10,
  hitstun: 0.5,
  hitstop: 0.14,
  aoe: true,
  aoeRadius: 3.9,
  telegraphRadius: 3.9,
  telegraphColor: '#5500ff',
});

export const BOSS_CHARGE = bossAttack('bossCharge', 'CARICA DEL RE', 'charge', 18, {
  range: 2.35,
  arc: 95,
  windup: 0.52,
  active: 0.36,
  recovery: 0.6,
  knockback: 9,
  hitstop: 0.09,
  telegraphRadius: 2.2,
  telegraphColor: '#0077ff',
});

export const BOSS_PROFILES: Record<BossId, BossProfile> = {
  borsello: {
    id: 'borsello',
    name: 'IL RE DEL BORSELLO',
    kicker: 'BOSS DI METÀ CAMPAGNA',
    quote: '"Questa piazza è casa mia, fra\'."',
    hp: 520,
    speed: 2.95,
    damage: 20,
    score: 6000,
    variant: 0,
    phaseLabels: ['FASE I — TRUCCIDERO', 'FASE II — STRADA', 'FASE III — TUTTO O NIENTE'],
    close: BOSS_BAG,
    heavy: BOSS_SLAM,
    charge: BOSS_CHARGE,
  },
  tetti: {
    id: 'tetti',
    name: 'IL RE DEI TETTI',
    kicker: 'BOSS FINALE',
    quote: '"Da quassù Milano è tutta mia, fra\'."',
    hp: 640,
    speed: 3.05,
    damage: 22,
    score: 8000,
    variant: 1,
    phaseLabels: ['FASE I — PROPRIETARIO', 'FASE II — VENTO IN QUOTA', 'FASE III — ULTIMO PIANO'],
    close: bossAttack('bossBag', 'GINOCCHIATA SUL TETTO', 'bag', 22),
    heavy: bossAttack('bossSlam', 'ONDA D\'URTO', 'slam', 26, {
      range: 3.9,
      arc: 360,
      windup: 0.92,
      active: 0.12,
      recovery: 0.7,
      aoe: true,
      aoeRadius: 3.9,
      telegraphRadius: 3.9,
      telegraphColor: '#5500ff',
    }),
    charge: bossAttack('bossCharge', 'CARICA SUL CORNICIONE', 'charge', 19, {
      range: 2.4,
      arc: 95,
      windup: 0.5,
      active: 0.36,
      recovery: 0.58,
      telegraphRadius: 2.2,
      telegraphColor: '#0077ff',
    }),
  },
  buttafuori: {
    id: 'buttafuori',
    name: 'IL BUTTAFUORI',
    kicker: 'BOSS DI CAPITOLO',
    quote: '"Tu stasera non entri."',
    hp: 460,
    speed: 3.15,
    damage: 18,
    score: 5600,
    variant: 2,
    phaseLabels: ['FASE I — SELEZIONE', 'FASE II — CORDA', 'FASE III — CHIUSURA'],
    close: bossAttack('bossBag', 'PUGNO DA BUTTAFUORI', 'bag', 18, {
      windup: 0.46,
      recovery: 0.46,
      range: 3.2,
      telegraphColor: '#ff8a3d',
    }),
    heavy: bossAttack('bossSlam', 'SPINTA FUORI', 'slam', 22, {
      range: 3.6,
      arc: 360,
      windup: 0.82,
      recovery: 0.6,
      aoe: true,
      aoeRadius: 3.6,
      telegraphRadius: 3.6,
      telegraphColor: '#ff2f2f',
    }),
    charge: bossAttack('bossCharge', 'CARICA ALLA CORDA', 'charge', 17, {
      range: 2.3,
      windup: 0.44,
      active: 0.4,
      recovery: 0.52,
      telegraphRadius: 2.1,
      telegraphColor: '#0077ff',
    }),
  },
  trainer: {
    id: 'trainer',
    name: 'IL PERSONAL TRAINER',
    kicker: 'BOSS DI CAPITOLO',
    quote: '"Ancora dieci ripetizioni, fra\'."',
    hp: 500,
    speed: 3.4,
    damage: 17,
    score: 5800,
    variant: 3,
    phaseLabels: ['FASE I — RISCALDAMENTO', 'FASE II — ULTIMA SERIE', 'FASE III — MASSIMALE'],
    close: bossAttack('bossBag', 'CONTROLLO POSTURA', 'bag', 17, {
      windup: 0.42,
      recovery: 0.42,
      range: 3.1,
      telegraphColor: '#ffd400',
    }),
    heavy: bossAttack('bossSlam', 'FISCHIO ASSORDANTE', 'slam', 23, {
      range: 4.1,
      arc: 360,
      windup: 0.88,
      recovery: 0.66,
      aoe: true,
      aoeRadius: 4.1,
      telegraphRadius: 4.1,
      telegraphColor: '#ff8a3d',
    }),
    charge: bossAttack('bossCharge', 'SCATTO SUL TAPPETO', 'charge', 18, {
      range: 2.4,
      windup: 0.4,
      active: 0.42,
      recovery: 0.48,
      telegraphRadius: 2.2,
      telegraphColor: '#ff2f2f',
    }),
  },
  dj: {
    id: 'dj',
    name: 'IL DJ',
    kicker: 'BOSS DI CAPITOLO',
    quote: '"Questa piazza la droppo io."',
    hp: 480,
    speed: 2.8,
    damage: 19,
    score: 5700,
    variant: 4,
    phaseLabels: ['FASE I — SOUNDCHECK', 'FASE II — DROP', 'FASE III — AFTERHOURS'],
    close: bossAttack('bossBag', 'CROSSFADER', 'bag', 19, {
      windup: 0.5,
      recovery: 0.5,
      range: 3.2,
      telegraphColor: '#4fe6ff',
    }),
    heavy: bossAttack('bossSlam', 'DROPPONE', 'slam', 24, {
      range: 4.2,
      arc: 360,
      windup: 1.0,
      recovery: 0.74,
      aoe: true,
      aoeRadius: 4.2,
      telegraphRadius: 4.2,
      telegraphColor: '#b04dff',
    }),
    charge: bossAttack('bossCharge', 'BASSLINE', 'charge', 18, {
      range: 2.35,
      windup: 0.5,
      active: 0.38,
      recovery: 0.56,
      telegraphRadius: 2.2,
      telegraphColor: '#4fe6ff',
    }),
  },
  consiglio: {
    id: 'consiglio',
    name: 'IL CONSIGLIO DEL BORSELLO',
    kicker: 'BOSS DI FINE CAPITOLO',
    quote: '"Il Consiglio ha deliberato: tu non passi."',
    hp: 720,
    speed: 2.7,
    damage: 23,
    score: 9500,
    variant: 5,
    phaseLabels: ['FASE I — ORDINE DEL GIORNO', 'FASE II — MOZIONE', 'FASE III — SFIDUCIA'],
    close: bossAttack('bossBag', 'DELIBERA', 'bag', 23, {
      windup: 0.58,
      recovery: 0.58,
      range: 3.5,
      telegraphColor: '#ffd400',
    }),
    heavy: bossAttack('bossSlam', 'MOZIONE DI SFIDUCIA', 'slam', 27, {
      range: 4.4,
      arc: 360,
      windup: 1.05,
      recovery: 0.8,
      aoe: true,
      aoeRadius: 4.4,
      telegraphRadius: 4.4,
      telegraphColor: '#b04dff',
    }),
    charge: bossAttack('bossCharge', 'CONVOCAZIONE', 'charge', 20, {
      range: 2.5,
      windup: 0.54,
      active: 0.4,
      recovery: 0.62,
      telegraphRadius: 2.3,
      telegraphColor: '#5500ff',
    }),
  },
};

export function bossProfile(id: BossId | undefined): BossProfile {
  return (id && BOSS_PROFILES[id]) || BOSS_PROFILES.borsello;
}

export class Boss extends Enemy {
  readonly profile: BossProfile;
  phase = 1;
  phaseTransitionTimer = 0;
  introMode = false;
  onPhaseChange: ((phase: number) => void) | null = null;
  private attackCycle = 0;

  constructor(
    physics: Physics,
    factory: CharacterFactory,
    combat: CombatSystem,
    director: AttackDirector,
    spawn: THREE.Vector3,
    scaling: EnemyScaling,
    profile: BossProfile = BOSS_PROFILES.borsello,
  ) {
    super(
      physics,
      factory,
      combat,
      director,
      {
        ...BOSS_ARCHETYPE,
        label: profile.name,
        hp: profile.hp,
        speed: profile.speed,
        damage: profile.damage,
        score: profile.score,
      },
      spawn,
      scaling,
      profile.variant,
    );
    this.profile = profile;
    this.postHitInvuln = 0.07;
    this.anim.play('intro', { reset: true });
  }

  beginIntro(): void {
    this.introMode = true;
    this.invulnTimer = 999;
    this.controlNone();
    this.anim.play('intro', { reset: true });
  }

  endIntro(): void {
    this.introMode = false;
    this.invulnTimer = 0;
    this.anim.play('roar', { reset: true });
    this.attackCooldown = 0.6;
  }

  controlNone(): void {
    this.attack = null;
    this.releaseToken();
  }

  get phaseLabel(): string {
    return this.profile.phaseLabels[Math.min(2, Math.max(0, this.phase - 1))];
  }

  override update(dt: number, ctx: EnemyContext): void {
    this.lastPlayerX = ctx.playerX;
    this.lastPlayerZ = ctx.playerZ;
    if (this.introMode) {
      this.anim.play('intro');
      this.faceTowards(ctx.playerX, ctx.playerZ);
      this.updateFacing(dt);
      return;
    }

    this.checkPhase();

    if (this.phaseTransitionTimer > 0) {
      this.phaseTransitionTimer = Math.max(0, this.phaseTransitionTimer - dt);
      this.invulnTimer = Math.max(this.invulnTimer, 0.1);
      this.anim.play('roar');
      this.moveHorizontal(dt, 0, 0);
      this.faceTowards(ctx.playerX, ctx.playerZ);
      this.updateFacing(dt);
      return;
    }

    super.update(dt, ctx);
  }

  private checkPhase(): void {
    if (!this.alive) return;
    const ratio = this.hp / this.maxHp;
    const next = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (next === this.phase) return;
    this.phase = next;
    this.phaseTransitionTimer = 1.5;
    this.invulnTimer = 1.5;
    this.controlNone();
    this.hurtTimer = 0;
    this.stunTimer = 0;
    this.attackCooldownScale = next === 2 ? 0.86 : next === 3 ? 0.7 : 1;
    this.speedMultiplier = next === 2 ? 1.1 : next === 3 ? 1.24 : 1;
    this.anim.play('roar', { reset: true });
    this.onPhaseChange?.(next);
  }

  protected override makeAttackSpec(): AttackSpec {
    const inMelee = Math.hypot(this.posX - (this.lastPlayerX ?? this.posX), this.posZ - (this.lastPlayerZ ?? this.posZ)) < 3.1;
    this.attackCycle += 1;
    const heavy = this.profile.heavy;
    const close = this.profile.close;
    const charge = this.profile.charge;
    if (this.phase >= 2 && inMelee && this.attackCycle % 2 === 0) {
      return { ...heavy, damage: heavy.damage * this.damageMultiplier };
    }
    if (inMelee) {
      return { ...close, damage: close.damage * this.damageMultiplier };
    }
    if (this.phase === 3 && this.attackCycle % 3 === 0) {
      return { ...heavy, damage: heavy.damage * this.damageMultiplier };
    }
    return { ...charge, damage: charge.damage * this.damageMultiplier };
  }

  private lastPlayerX: number | null = null;
  private lastPlayerZ: number | null = null;
  get damageMultiplier(): number {
    return this.phase === 3 ? 1.18 : this.phase === 2 ? 1.08 : 1;
  }

  protected override onHurt(info: HitInfo, attacker: Combatant): void {
    const superArmor = this.attack !== null && !info.heavy;
    if (superArmor) {
      this.poise -= info.damage;
      if (this.poise <= 0) {
        this.poise = this.archetype.poise;
        this.stunTimer = this.archetype.stunDuration;
        this.hurtTimer = 0.2;
        this.controlNone();
      }
      return;
    }
    super.onHurt(info, attacker);
  }
}
