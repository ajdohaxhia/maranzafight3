import * as THREE from 'three';
import { Player } from '../entities/Player';
import { Zombie, ZOMBIE_ARCHETYPES, type ZombieKind } from './Zombie';
import {
  buildZombiesMap,
  type ZombieInteractable,
  type ZombiePerkId,
  type ZombieWindow,
  type ZombiesMapBuild,
} from './ZombiesMap';
import { WEAPONS, WeaponState, slotDamage, type WeaponId } from './Weapons';
import { WeaponView } from './WeaponView';
import type { ZombieSave, ZombiesRunMode, ZombiesRunSnapshot } from './ZombieSave';
import { CombatSystem } from '../combat/CombatSystem';
import type { AttackSpec, HitInfo } from '../combat/types';
import type { Physics } from '../core/Physics';
import type { CharacterFactory } from '../graphics/CharacterFactory';
import type { Effects } from '../graphics/Effects';
import type { CameraRig } from '../core/CameraRig';
import type { InputManager } from '../controls/InputManager';
import type { AudioManager } from '../audio/AudioManager';
import type { Quality } from '../systems/SettingsManager';
import type { UI } from '../ui/UI';
import { ZombiesHUD, type ZombiesPrompt } from '../ui/ZombiesHUD';

export interface ZombiesResult {
  mode: ZombiesRunMode;
  round: number;
  kills: number;
  headshots: number;
  points: number;
  time: number;
  extracted: boolean;
  reason: string;
  newRecord: boolean;
  bestRound: number;
}

export interface ZombiesCallbacks {
  onGameOver(result: ZombiesResult): void;
  onVictory(result: ZombiesResult): void;
  onExit(): void;
}

export interface ZombiesDeps {
  scene: THREE.Scene;
  physics: Physics;
  factory: CharacterFactory;
  input: InputManager;
  audio: AudioManager;
  effects: Effects;
  cameraRig: CameraRig;
  ui: UI;
  save: ZombieSave;
  quality: Quality;
  callbacks: ZombiesCallbacks;
}

type ZombiesPhase = 'intermission' | 'round' | 'extraction' | 'dead' | 'victory';

interface PowerUp {
  kind: 'ammo' | 'points' | 'heal' | 'double';
  group: THREE.Group;
  x: number;
  z: number;
  ttl: number;
}

const DOUBLE_POINTS_SECONDS = 25;
const EXTRACTION_HOLD = 8;
const EXTRACTION_TIME = 90;

function alive(zombies: Zombie[]): number {
  let count = 0;
  for (const zombie of zombies) if (zombie.alive) count += 1;
  return count;
}

function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class ZombiesMode {
  readonly modeType: ZombiesRunMode;
  readonly map: ZombiesMapBuild;
  readonly player: Player;
  private readonly deps: ZombiesDeps;
  private readonly combat: CombatSystem;
  private readonly weapons = new WeaponState();
  private readonly view: WeaponView;
  private readonly hud = new ZombiesHUD();
  private zombies: Zombie[] = [];
  private pickups: PowerUp[] = [];

  private phase: ZombiesPhase = 'intermission';
  private round = 0;
  private points = 0;
  private kills = 0;
  private headshots = 0;
  private runTime = 0;
  private roundKills = 0;
  private maxAlive = 12;
  private spawnQueue: ZombieKind[] = [];
  private spawnTimer = 0;
  private intermissionTimer = 8;
  private pendingExtraction = false;
  private extractionTimer = EXTRACTION_TIME;
  private extractionHold = 0;
  private extractionGroup: THREE.Group;
  private powered = false;
  private readonly openDoors = new Set<string>();
  private readonly perks = new Set<ZombiePerkId>();
  private readonly earnedPoints = new Map<number, number>();
  private readonly prompt: { interactable: ZombieInteractable | null; window: ZombieWindow | null; label: string; sub: string; price: number } = {
    interactable: null,
    window: null,
    label: '',
    sub: '',
    price: 0,
  };
  private reviveUsed = false;
  private doublePointsTimer = 0;
  private deathTimer = -1;
  private victoryTimer = -1;
  private resultSent = false;
  private lastSector: string | null = null;
  private sectorToastTimer = 0;
  private deathReason = 'I NON-MORTI HANNO VINTO';
  private previousBestRound = 0;
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpOrigin = new THREE.Vector3();

  constructor(deps: ZombiesDeps, mode: ZombiesRunMode, snapshot: ZombiesRunSnapshot | null) {
    this.deps = deps;
    this.modeType = mode;
    this.map = buildZombiesMap(deps.physics, deps.quality);
    deps.scene.add(this.map.group);
    this.extractionGroup = this.map.extraction.group;
    this.maxAlive = deps.quality === 'low' ? 9 : deps.quality === 'medium' ? 11 : 12;

    this.combat = new CombatSystem({
      onDamage: (attacker, target, info, spec) => this.onCombatDamage(attacker, target, info, spec),
      onPerfectDodge: () => undefined,
    });

    this.player = new Player(deps.physics, deps.factory, this.combat, this.playerEvents(), this.map.playerStart.clone());
    this.player.addToScene(deps.scene);
    this.player.setYaw(this.map.startYaw + Math.PI);
    this.view = new WeaponView(this.player.visual);
    this.view.setWeapon(this.weapons.current?.id ?? null);
    deps.cameraRig.distance = 4.0;
    deps.cameraRig.setMode('follow');
    deps.cameraRig.yaw = this.map.startYaw;
    deps.cameraRig.pitch = 0.2;
    deps.cameraRig.aimLook = 12;
    deps.cameraRig.setTarget(new THREE.Vector3(this.player.posX, this.player.pos.y, this.player.posZ));
    deps.cameraRig.resetToPlayer();
    deps.cameraRig.yaw = this.map.startYaw;

    if (snapshot) {
      this.restore(snapshot);
    } else {
      deps.save.startNew();
      this.round = 0;
      this.intermissionTimer = 9;
      this.phase = 'intermission';
      this.hud.setVisible(true);
      deps.ui.toast('NOTTE MORTA A MILANO', 'ROUND 1 IN ARRIVO · SBARRA LE FINESTRE', 2600);
    }
    this.hud.setVisible(true);
    deps.ui.hud.setVisible(false);
    deps.ui.setControlsActive(true);
    deps.input.clearTransient();
    deps.input.setEnabled(true);
    deps.audio.unlock();
    deps.audio.setPaused(false);
    deps.audio.startMusic('zombies', true);
    this.player.invulnTimer = Math.max(this.player.invulnTimer, 1.6);
    this.refreshPrompt();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────
  private restore(snapshot: ZombiesRunSnapshot): void {
    this.round = Math.max(0, snapshot.nextRound - 1);
    this.points = snapshot.points;
    this.kills = snapshot.kills;
    this.headshots = snapshot.headshots;
    this.runTime = snapshot.time;
    this.weapons.restore(snapshot.weapons);
    this.view.setWeapon(this.weapons.current?.id ?? null);
    this.player.hp = Math.max(1, Math.min(this.player.maxHp, snapshot.hp));
    for (const id of snapshot.doors) {
      if (this.map.openDoor(id)) this.openDoors.add(id);
    }
    if (snapshot.power) this.powered = true;
    for (const perk of snapshot.perks) this.applyPerk(perk, false);
    if (this.modeType === 'extraction' && snapshot.nextRound > 20) {
      this.round = 20;
      this.pendingExtraction = true;
      this.intermissionTimer = 4;
    } else {
      this.intermissionTimer = 7;
    }
    this.phase = 'intermission';
    this.hud.setVisible(true);
    this.deps.ui.toast('RUN RIPRESA', `ROUND ${snapshot.nextRound} · CHECKPOINT`, 2200);
  }

  pause(): void {
    if (this.phase === 'dead' || this.phase === 'victory') return;
    this.checkpoint();
    this.deps.input.clearTransient();
  }

  resume(): void {
    this.deps.input.clearTransient();
  }

  get isFinished(): boolean {
    return this.phase === 'dead' || this.phase === 'victory';
  }

  /** Serialisable checkpoint taken between rounds (and on pause/quit). */
  snapshot(): ZombiesRunSnapshot {
    return {
      mode: this.modeType,
      nextRound: this.pendingExtraction ? 21 : this.round + 1,
      points: this.points,
      hp: Math.max(1, Math.ceil(this.player.hp)),
      weapons: this.weapons.toJSON(),
      doors: [...this.openDoors],
      power: this.powered,
      perks: [...this.perks],
      kills: this.kills,
      headshots: this.headshots,
      time: Math.floor(this.runTime),
    };
  }

  checkpoint(): void {
    if (this.phase === 'dead' || this.phase === 'victory') return;
    this.deps.save.snapshot(this.snapshot());
  }

  // ── Update ───────────────────────────────────────────────────────────
  update(dt: number): void {
    this.weapons.tick(dt);
    this.view.update(dt);
    this.map.tick(dt);
    this.runTime += dt;
    if (this.doublePointsTimer > 0) this.doublePointsTimer = Math.max(0, this.doublePointsTimer - dt);
    if (this.sectorToastTimer > 0) this.sectorToastTimer = Math.max(0, this.sectorToastTimer - dt);
    this.updatePowerUps(dt);
    this.refreshPrompt();

    if (this.phase === 'dead') {
      this.player.update(dt, 0, 0, false);
      this.updateZombieActors(dt, false);
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.sendGameOver();
      this.deps.cameraRig.setTarget(new THREE.Vector3(this.player.posX, 0, this.player.posZ));
      return;
    }
    if (this.phase === 'victory') {
      this.player.update(dt, 0, 0, false);
      this.updateZombieActors(dt, false);
      this.victoryTimer -= dt;
      if (this.victoryTimer <= 0) this.sendVictory();
      this.deps.cameraRig.setTarget(new THREE.Vector3(this.player.posX, 0, this.player.posZ));
      return;
    }

    this.handleActions();
    const movement = this.moveVector();
    this.player.update(dt, movement.x, movement.z, this.deps.input.run && movement.length > 0.1);

    if (this.phase === 'intermission') {
      this.intermissionTimer -= dt;
      this.updateZombieActors(dt, false);
      if (this.intermissionTimer <= 0) {
        if (this.pendingExtraction) this.startExtraction();
        else this.startRound(this.round + 1);
      }
    } else if (this.phase === 'round' || this.phase === 'extraction') {
      this.updateSpawning(dt);
      this.updateZombieActors(dt, true);
      this.combat.update(dt, [this.player, ...this.zombies.filter((zombie) => zombie.alive)]);
      if (this.phase === 'round') this.updateRoundState();
      else this.updateExtraction(dt);
    }

    this.deps.physics.step();
    this.player.syncFromPhysics();
    for (const zombie of this.zombies) zombie.syncFromPhysics();
    this.cleanupCorpses();

    const sector = this.map.sectorAt(this.player.posX, this.player.posZ);
    if (sector && sector !== this.lastSector) {
      this.lastSector = sector;
      if (sector !== 'atrio' && this.sectorToastTimer <= 0) {
        const info = this.map.sectors.find((entry) => entry.id === sector);
        this.deps.ui.toast(info?.name ?? 'ZONA', info?.subtitle ?? 'MILANO', 1500);
        this.sectorToastTimer = 6;
      }
    }

    this.deps.cameraRig.setMode('follow');
    this.deps.cameraRig.setTarget(new THREE.Vector3(this.player.posX, this.player.pos.y, this.player.posZ));
  }

  private moveVector(): { x: number; z: number; length: number } {
    const basis = this.deps.cameraRig.getBasis();
    let x = basis.right.x * this.deps.input.moveX + basis.forward.x * this.deps.input.moveY;
    let z = basis.right.z * this.deps.input.moveX + basis.forward.z * this.deps.input.moveY;
    let length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
      length = 1;
    }
    return { x, z, length };
  }

  // ── Input ────────────────────────────────────────────────────────────
  private handleActions(): void {
    const input = this.deps.input;
    if (input.consume('dodge')) {
      if (this.player.tryDodge()) {
        this.deps.audio.playSfx('dodge');
        this.deps.effects.spawnSparks(this.player.pos, '#cfd8ff', 5, 0.6);
      }
    }
    if (input.consume('switchWeapon')) this.switchWeapon();
    if (input.consume('slot1')) this.selectSlot(0);
    if (input.consume('slot2')) this.selectSlot(1);
    if (input.consume('reload')) this.startReload();
    if (input.consume('interact')) this.handleInteract();
    this.handleShooting();
  }

  private switchWeapon(): void {
    if (!this.weapons.slots[0] || !this.weapons.slots[1]) {
      this.deps.ui.toast('SECONDO SLOT VUOTO', 'COMPRA UN\'ARMA DAL MURO', 1100);
      return;
    }
    if (!this.weapons.switchWeapon()) return;
    this.view.setWeapon(this.weapons.current?.id ?? null);
    this.deps.audio.playSfx('reload');
    this.refreshPrompt();
  }

  private selectSlot(index: 0 | 1): void {
    if (!this.weapons.slots[index]) {
      this.deps.ui.toast('SLOT VUOTO', 'COMPRA UN\'ARMA DAL MURO', 1100);
      return;
    }
    if (!this.weapons.switchTo(index)) return;
    this.view.setWeapon(this.weapons.current?.id ?? null);
    this.deps.audio.playSfx('reload');
    this.refreshPrompt();
  }

  private startReload(): void {
    const scale = this.perks.has('ricarica') ? 0.6 : 1;
    if (this.weapons.startReload(scale).started) {
      this.deps.audio.playSfx('reload');
    } else if (this.weapons.current && this.weapons.current.mag <= 0) {
      this.deps.audio.playSfx('empty');
    }
  }

  private handleShooting(): void {
    const slot = this.weapons.current;
    if (!slot) return;
    const spec = WEAPONS[slot.id];
    const held = this.deps.input.isDown('fire');
    const trigger = this.deps.input.consume('fire') || (spec.auto && held);
    if (!trigger) return;
    if (this.weapons.reloading) {
      this.weapons.cancelReload();
      if (slot.mag <= 0) return;
    }
    if (!this.weapons.canFire()) {
      if (slot.mag <= 0 && !this.weapons.reloading) {
        this.deps.audio.playSfx('empty');
        this.startReload();
      }
      return;
    }
    this.fireOnce();
  }

  private fireOnce(): void {
    const slot = this.weapons.current;
    const spec = this.weapons.currentSpec;
    if (!slot || !spec) return;
    if (!this.weapons.consumeShot()) return;
    const camera = this.deps.cameraRig.camera;
    camera.getWorldDirection(this.tmpDir);
    this.tmpOrigin.set(this.player.posX, this.player.pos.y + 1.42, this.player.posZ).addScaledVector(this.tmpDir, 0.45);
    const muzzle = this.view.flashAt();
    this.deps.audio.playSfx(spec.id === 'pistol' ? 'gunPistol' : spec.id === 'smg' ? 'gunSmg' : spec.id === 'shotgun' ? 'gunShotgun' : 'gunRifle');
    this.deps.cameraRig.addShake(spec.recoil * 0.12);
    this.deps.cameraRig.addPunch(spec.recoil * 0.55);
    this.deps.effects.spawnFlash(muzzle, '#ffe0a0', 0.9, 0.06);

    for (let pellet = 0; pellet < spec.pellets; pellet++) {
      const dir = this.tmpDir.clone();
      if (spec.spread > 0) {
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        const up = new THREE.Vector3().crossVectors(right, dir).normalize();
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * spec.spread;
        dir.addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius).normalize();
      }
      this.tracePellet(slot.id, slot.tier, dir, spec.range * (this.perks.has('mobilita') ? 1 : 1));
    }
    this.refreshPrompt();
    this.updateHud();
  }

  private tracePellet(weapon: WeaponId, tier: number, dir: THREE.Vector3, range: number): void {
    const spec = WEAPONS[weapon];
    const wall = this.deps.physics.raycast(this.tmpOrigin, dir, range, false);
    const maxDistance = wall ? Math.min(range, wall.distance - 0.05) : range;
    if (maxDistance <= 0) return;
    let best: { zombie: Zombie; t: number; head: boolean; point: THREE.Vector3 } | null = null;

    for (const zombie of this.zombies) {
      if (!zombie.alive) continue;
      const checks: Array<{ y: number; radius: number; head: boolean }> = [
        { y: zombie.headY, radius: 0.27 * zombie.archetype.scale, head: true },
        { y: zombie.bodyY, radius: 0.46 * zombie.archetype.scale, head: false },
      ];
      for (const check of checks) {
        const center = new THREE.Vector3(zombie.posX, check.y, zombie.posZ);
        const toCenter = center.clone().sub(this.tmpOrigin);
        const t = toCenter.dot(dir);
        if (t < 0.2 || t > maxDistance) continue;
        const closest = this.tmpOrigin.clone().addScaledVector(dir, t);
        if (closest.distanceTo(center) > check.radius) continue;
        if (!best || t < best.t) {
          best = { zombie, t, head: check.head, point: closest };
        }
        break;
      }
    }

    if (wall && (!best || wall.distance < best.t)) {
      this.deps.effects.spawnSparks(wall.point, '#c9d4e0', 4, 0.5);
      this.deps.effects.spawnRing(wall.point, '#9aabbb', 0.18, 0.12);
      return;
    }
    if (!best) return;

    const zombie = best.zombie;
    const damage = slotDamage({ id: weapon, mag: 0, reserve: 0, tier }) * (best.head ? spec.headshot : 1);
    const info: HitInfo = {
      damage,
      dirX: dir.x,
      dirZ: dir.z,
      knockback: best.head ? 2.4 : 1.4,
      hitstun: best.head ? 0.3 : 0.16,
      hitstop: 0,
      heavy: best.head,
      specId: 'bullet',
      fromX: this.player.posX,
      fromZ: this.player.posZ,
    };
    zombie.applyHit(info, this.player);
    this.awardHit(zombie, best.head);
    this.deps.effects.spawnSparks(best.point, best.head ? '#ffd400' : '#ff8a5a', best.head ? 10 : 6, best.head ? 1.2 : 0.8);
    this.deps.effects.spawnFlash(best.point, best.head ? '#ffe38a' : '#ffb08a', best.head ? 1.1 : 0.7, 0.12);
    this.deps.ui.spawnDamage(
      new THREE.Vector3(zombie.posX, zombie.headY + 0.12, zombie.posZ),
      this.deps.cameraRig.camera,
      Math.round(damage),
      best.head ? 'crit' : 'enemy',
    );
    if (!zombie.alive) this.killZombie(zombie, best.head);
  }

  private awardHit(zombie: Zombie, headshot: boolean): void {
    const already = this.earnedPoints.get(zombie.id) ?? 0;
    if (already >= 60) return;
    const base = headshot ? 15 : 10;
    const gain = Math.min(base, 60 - already);
    this.earnedPoints.set(zombie.id, already + gain);
    this.addPoints(gain);
    if (headshot) this.headshots += 1;
  }

  private addPoints(amount: number): void {
    const multiplier = this.doublePointsTimer > 0 ? 2 : 1;
    this.points += Math.max(0, Math.round(amount * multiplier));
  }

  private killZombie(zombie: Zombie, headshot: boolean): void {
    if (zombie.deathHandled) return;
    zombie.deathHandled = true;
    this.kills += 1;
    this.roundKills += 1;
    const base = zombie.archetype.points;
    const bonus = headshot ? 50 : 0;
    this.addPoints(base + bonus);
    this.deps.audio.playSfx('ko');
    this.deps.effects.spawnRing(zombie.pos, '#ffd400', zombie.kind === 'elite' ? 6 : 2.2, 0.5);
    this.deps.effects.spawnSparks(zombie.pos, '#ffcf6b', zombie.kind === 'elite' ? 30 : 14, 1.3);
    this.deps.cameraRig.addPunch(zombie.kind === 'elite' ? 4 : 1.4);
    if (zombie.kind === 'elite' || Math.random() < 0.11) this.dropPowerUp(zombie.pos);
  }

  private handleInteract(): void {
    const prompt = this.prompt;
    if (prompt.window) {
      this.tryRepairWindow(prompt.window);
      return;
    }
    const target = prompt.interactable;
    if (!target) return;
    if (target.kind === 'door') {
      const doorId = target.doorId;
      if (!doorId || this.openDoors.has(doorId)) return;
      if (!this.spend(target.price)) return;
      if (this.map.openDoor(doorId)) {
        this.openDoors.add(doorId);
        this.deps.audio.playSfx('buy');
        this.deps.ui.toast('ZONA SBLOCCATA', target.label.replace('APRI ', ''), 1600);
        this.deps.effects.spawnRing(this.player.pos, '#4fe6ff', 2.6, 0.5);
      }
      return;
    }
    if (target.kind === 'wallbuy' && target.weapon) {
      const spec = WEAPONS[target.weapon];
      const owned = this.weapons.has(target.weapon);
      const price = owned ? spec.ammoPrice : spec.price;
      if (!this.spend(price)) return;
      const result = this.weapons.acquire(target.weapon);
      if (result === 'full') {
        this.points += price;
        this.deps.audio.playSfx('deny');
        this.deps.ui.toast('GIÀ PIENO', 'MUNIZIONI AL MASSIMO', 1200);
        return;
      }
      this.view.setWeapon(this.weapons.current?.id ?? null);
      this.deps.audio.playSfx('buy');
      this.deps.ui.toast(result === 'new' ? 'ARMA ACQUISTATA' : 'MUNIZIONI', spec.name, 1500);
      return;
    }
    if (target.kind === 'ammo' && target.weapon) {
      const owned = this.weapons.has(target.weapon);
      if (!owned) {
        this.deps.audio.playSfx('deny');
        this.deps.ui.toast('NON HAI L\'ARMA', 'COMPRA PRIMA IL FERRO', 1300);
        return;
      }
      if (!this.spend(target.price)) return;
      const result = this.weapons.buyAmmo(target.weapon);
      if (result === 'full') {
        this.points += target.price;
        this.deps.audio.playSfx('deny');
        this.deps.ui.toast('MUNIZIONI PIENE', 'RISERVA AL MASSIMO', 1200);
        return;
      }
      this.deps.audio.playSfx('buy');
      this.deps.ui.toast('MUNIZIONI', WEAPONS[target.weapon].name, 1200);
      return;
    }
    if (target.kind === 'power') {
      if (this.powered) return;
      if (!this.spend(target.price)) return;
      this.powered = true;
      this.deps.audio.playSfx('power');
      this.deps.ui.flash('special');
      this.deps.effects.spawnRing(this.player.pos, '#ffd400', 4, 0.8);
      this.deps.ui.toast('CORRENTE ATTIVA', 'BANCO E MACCHINE SBLOCCATE', 2200);
      return;
    }
    if (target.kind === 'perk' && target.perk) {
      if (!this.powered) {
        this.deps.audio.playSfx('deny');
        this.deps.ui.toast('SERVE LA CORRENTE', 'ATTIVA L\'INTERRUTTORE AL METRO', 1600);
        return;
      }
      if (this.perks.has(target.perk)) return;
      if (!this.spend(target.price)) return;
      this.applyPerk(target.perk, true);
      this.deps.audio.playSfx('upgrade');
      return;
    }
    if (target.kind === 'bench') {
      if (!this.powered) {
        this.deps.audio.playSfx('deny');
        this.deps.ui.toast('SERVE LA CORRENTE', 'ATTIVA L\'INTERRUTTORE AL METRO', 1600);
        return;
      }
      const slot = this.weapons.current;
      if (!slot || slot.tier >= 3) {
        this.deps.audio.playSfx('deny');
        this.deps.ui.toast('ARMA AL MASSIMO', 'NESSUNA ALTRA MIGLIORA', 1300);
        return;
      }
      if (!this.spend(target.price)) return;
      this.weapons.upgrade(slot.id);
      this.deps.audio.playSfx('upgrade');
      this.deps.ui.toast('ARMA POTENZIATA', `${WEAPONS[slot.id].name} · TIER ${this.weapons.current?.tier ?? 1}`, 1600);
      return;
    }
  }

  private spend(cost: number): boolean {
    if (cost <= 0) return true;
    if (this.points < cost) {
      this.deps.audio.playSfx('deny');
      this.deps.ui.toast('PUNTI INSUFFICIENTI', `SERVONO ${cost} PUNTI`, 1200);
      this.refreshPrompt();
      return false;
    }
    this.points -= cost;
    this.refreshPrompt();
    this.updateHud();
    return true;
  }

  private tryRepairWindow(window: ZombieWindow): void {
    if (!window.broken) return;
    if (!this.spend(100)) return;
    if (this.map.repairWindow(window.id)) {
      this.deps.audio.playSfx('buy');
      this.deps.ui.toast('BARRICATA RIPARATA', '100 PUNTI', 1200);
      this.deps.effects.spawnRing(window.center, '#ffd400', 2.2, 0.4);
    }
    this.refreshPrompt();
  }

  private applyPerk(perk: ZombiePerkId, announce: boolean): void {
    if (this.perks.has(perk)) return;
    this.perks.add(perk);
    const player = this.player;
    if (perk === 'resistenza') {
      player.damageReduction = 0.35;
      player.heal(40);
    } else if (perk === 'ricarica') {
      /* reload scaling is read when starting a reload */
    } else if (perk === 'mobilita') {
      player.speedMultiplier = 1.18;
      player.dodgeCooldownMultiplier = 0.72;
    }
    if (announce) {
      this.deps.ui.toast('POTENZIAMENTO', perk === 'resistenza' ? 'RESISTENZA · -35% DANNI' : perk === 'ricarica' ? 'MANI VELOCI · RICARICA -40%' : 'PASSO LUNGO · PIÙ MOBILITÀ', 2000);
    }
  }

  // ── Rounds ───────────────────────────────────────────────────────────
  private startRound(next: number): void {
    this.round = next;
    this.phase = 'round';
    this.roundKills = 0;
    this.spawnQueue = this.buildWave(next);
    this.spawnTimer = 0.6;
    this.pendingExtraction = false;
    const total = this.spawnQueue.length;
    this.deps.audio.playSfx('roundStart');
    this.deps.ui.toast(`ROUND ${next}`, `${total} NON-MORTI IN ARRIVO`, 2000);
    this.extractionGroup.visible = false;
    this.updateHud();
  }

  private buildWave(round: number): ZombieKind[] {
    const total = Math.min(42, 4 + round * 2 + Math.floor(round * round * 0.3));
    const queue: ZombieKind[] = [];
    const elites = round % 5 === 0 ? (round >= 15 ? 2 : 1) : 0;
    const brutes = round >= 5 ? Math.min(6, Math.floor(round / 4)) : 0;
    const runners = round >= 3 ? Math.min(total - elites - brutes - 2, Math.floor(total * (0.16 + round * 0.012))) : 0;
    for (let i = 0; i < elites; i++) queue.push('elite');
    for (let i = 0; i < brutes; i++) queue.push('brute');
    for (let i = 0; i < runners; i++) queue.push('runner');
    while (queue.length < total) queue.push('walker');
    // Shuffle so elites are not all first, but keep a couple of walkers up front.
    for (let i = queue.length - 1; i > 2; i--) {
      const j = 2 + Math.floor(Math.random() * (i - 1));
      const tmp = queue[i]!;
      queue[i] = queue[j]!;
      queue[j] = tmp;
    }
    return queue;
  }

  private updateSpawning(dt: number): void {
    if (this.phase === 'extraction') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && alive(this.zombies) < this.maxAlive) {
        const r = Math.random();
        const kind: ZombieKind = r < 0.2 ? 'elite' : r < 0.5 ? 'brute' : r < 0.8 ? 'runner' : 'walker';
        this.spawnZombie(kind);
        this.spawnTimer = Math.max(0.6, 2.4 - this.round * 0.04) * random(0.7, 1.2);
      }
      return;
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.spawnQueue.length === 0) return;
    const roundCap = Math.min(this.maxAlive, 3 + Math.floor(this.round * 0.85));
    if (alive(this.zombies) >= roundCap) return;
    const kind = this.spawnQueue.shift();
    if (!kind) return;
    this.spawnZombie(kind);
    this.spawnTimer = Math.max(0.32, 1.25 - this.round * 0.025) * random(0.7, 1.3);
  }

  private spawnZombie(kind: ZombieKind): void {
    const reachable = this.map.reachableSectors(this.openDoors);
    const playerSector = this.map.sectorAt(this.player.posX, this.player.posZ);
    const reachableWindows = this.map.windows.filter((window) => reachable.has(window.sector));
    const sameSector = playerSector ? reachableWindows.filter((window) => window.sector === playerSector) : [];
    let candidates = sameSector.length > 0 ? sameSector : reachableWindows;
    const distFromPlayer = (window: ZombieWindow): number =>
      Math.hypot(window.inside.x - this.player.posX, window.inside.z - this.player.posZ);
    const further = candidates.filter((window) => distFromPlayer(window) > 7);
    if (further.length > 0) candidates = further;
    if (candidates.length === 0) candidates = this.map.windows;
    // Spread the wave across the barricades instead of stacking everybody on
    // the same window. The count includes zombies already assigned to it.
    const load = new Map<string, number>();
    for (const living of this.zombies) {
      if (living.alive && living.windowId) load.set(living.windowId, (load.get(living.windowId) ?? 0) + 1);
    }
    const least = Math.min(...candidates.map((entry) => load.get(entry.id) ?? 0));
    const pool = candidates.filter((entry) => (load.get(entry.id) ?? 0) === least);
    const window = pool[Math.floor(Math.random() * pool.length)] ?? candidates[0];
    if (!window) return;
    const archetype = ZOMBIE_ARCHETYPES[kind];
    const spawn = window.outside.clone();
    spawn.x += random(-1.1, 1.1);
    spawn.z += random(-1.1, 1.1);
    const zombie = new Zombie(this.deps.physics, this.deps.factory, this.combat, archetype, spawn, Math.floor(Math.random() * 4));
    zombie.windowId = window.id;
    zombie.entryStage = 'outside';
    zombie.setYaw(Math.atan2(this.player.posX - spawn.x, this.player.posZ - spawn.z));
    zombie.addToScene(this.deps.scene);
    this.zombies.push(zombie);
    this.deps.effects.spawnRing(spawn, '#ff2f2f', 1.4, 0.35);
    this.deps.effects.spawnSparks(spawn, '#ff8a5a', 6, 0.6);
  }

  private updateZombieActors(dt: number, active: boolean): void {
    const targetAlive = this.player.alive;
    const windowAttackers = new Map<string, number>();
    for (const zombie of this.zombies) {
      if (!zombie.alive) {
        zombie.update(dt, {
          targetX: this.player.posX,
          targetZ: this.player.posZ,
          targetAlive: false,
          zombies: this.zombies,
          waypoint: null,
          time: this.runTime,
        });
        continue;
      }
      let waypoint: { x: number; z: number } | null = null;
      if (zombie.windowId) {
        const window = this.map.windows.find((entry) => entry.id === zombie.windowId);
        if (!window) {
          zombie.windowId = null;
        } else if (window.broken) {
          zombie.entryStage = 'inside';
          const distance = Math.hypot(zombie.posX - window.inside.x, zombie.posZ - window.inside.z);
          if (distance < 1.25) {
            zombie.windowId = null;
            zombie.entryStage = null;
          } else {
            waypoint = { x: window.inside.x, z: window.inside.z };
          }
        } else {
          const distance = Math.hypot(zombie.posX - window.outside.x, zombie.posZ - window.outside.z);
          waypoint = { x: window.outside.x, z: window.outside.z };
          if (distance < 1.5) {
            // At most two bodies can chew the same barricade at once: the rest
            // wait their turn, so a single window cannot melt in two seconds.
            const attackers = windowAttackers.get(window.id) ?? 0;
            if (attackers < 2) {
              windowAttackers.set(window.id, attackers + 1);
              this.damageBarricade(window, dt);
            }
          }
        }
      }
      zombie.update(dt, {
        targetX: this.player.posX,
        targetZ: this.player.posZ,
        targetAlive: active && targetAlive,
        zombies: this.zombies,
        waypoint,
        time: this.runTime,
      });
    }
  }

  private damageBarricade(window: ZombieWindow, dt: number): void {
    if (!this.map.damageWindow(window.id, 6 * dt)) return;
    this.deps.audio.playSfx('heavy');
    this.deps.effects.spawnSparks(window.center, '#c9a06a', 12, 0.9);
    this.deps.effects.spawnRing(window.center, '#ffd400', 1.8, 0.4);
    this.deps.ui.toast('BARRICATA SFONDATA', 'RIPARALA CON E', 1500);
  }

  private updateRoundState(): void {
    if (this.spawnQueue.length > 0) return;
    if (alive(this.zombies) > 0) return;
    this.completeRound();
  }

  private completeRound(): void {
    const bonus = 150 + this.round * 120 + this.roundKills * 6;
    this.addPoints(bonus);
    this.phase = 'intermission';
    this.intermissionTimer = 12;
    const finishedRound = this.round;
    if (this.modeType === 'extraction' && finishedRound >= 20) {
      this.pendingExtraction = true;
      this.intermissionTimer = 8;
    }
    this.deps.audio.playSfx('levelComplete');
    this.deps.ui.toast(`ROUND ${finishedRound} COMPLETATO`, `+${bonus} PUNTI · RIPARA E COMPRA`, 2200);
    this.checkpoint();
    this.updateHud();
  }

  private startExtraction(): void {
    this.phase = 'extraction';
    this.pendingExtraction = false;
    this.extractionTimer = EXTRACTION_TIME;
    this.extractionHold = 0;
    this.extractionGroup.visible = true;
    this.spawnTimer = 0.4;
    this.deps.audio.playSfx('extract');
    this.deps.audio.startMusic('boss', true);
    this.deps.ui.toast('ESTRAZIONE', `RAGGIUNGI LA PIAZZA · RESTA ${EXTRACTION_HOLD} SECONDI`, 3200);
    this.checkpoint();
  }

  private updateExtraction(dt: number): void {
    this.extractionTimer = Math.max(0, this.extractionTimer - dt);
    const distance = Math.hypot(this.player.posX - this.map.extraction.x, this.player.posZ - this.map.extraction.z);
    if (distance <= this.map.extraction.radius) {
      this.extractionHold = Math.min(EXTRACTION_HOLD, this.extractionHold + dt);
      if (this.extractionHold >= EXTRACTION_HOLD) {
        this.winExtraction();
        return;
      }
    }
    if (this.extractionTimer <= 0) {
      this.die('TEMPO SCADUTO', 'L\'ELICOTTERO È ANDATO VIA');
    }
  }

  private winExtraction(): void {
    this.phase = 'victory';
    this.victoryTimer = 2.6;
    this.player.playVictory();
    this.deps.audio.stopMusic();
    this.deps.audio.playSfx('victory');
    this.deps.ui.flash('special');
    this.deps.effects.spawnRing(this.player.pos, '#4fe6ff', 6, 0.9);
    this.deps.ui.toast('ESTRATTO', 'MILANO PUÒ ASPETTARE DOMANI', 2600);
    this.extractionGroup.visible = false;
  }

  // ── Player damage / death ────────────────────────────────────────────
  private onCombatDamage(attacker: import('../combat/types').Combatant, target: import('../combat/types').Combatant, info: HitInfo, spec: AttackSpec): void {
    if (target !== this.player) return;
    this.deps.cameraRig.addShake(info.heavy ? 0.48 : 0.28);
    this.deps.cameraRig.addPunch(info.heavy ? 4 : 2.4);
    this.deps.audio.playSfx(info.heavy ? 'heavy' : 'hit');
    this.deps.ui.flash('hurt');
    this.deps.effects.spawnSparks(this.player.pos, '#ff7b6a', 10, 1);
    this.deps.ui.spawnDamage(
      new THREE.Vector3(this.player.posX, this.player.pos.y + 1.7, this.player.posZ),
      this.deps.cameraRig.camera,
      Math.round(info.damage * (1 - this.player.damageReduction)),
      'player',
    );
    if (!this.player.alive) this.onPlayerDown(`UCCISO DA UN ${spec.label}`);
    void attacker;
  }

  private onPlayerDown(reason: string): void {
    if (this.phase === 'dead' || this.phase === 'victory') return;
    if (!this.reviveUsed) {
      this.reviveUsed = true;
      this.player.alive = true;
      this.player.hp = 55;
      this.player.invulnTimer = 2.6;
      this.player.controlLocked = false;
      this.player.attack = null;
      this.deps.cameraRig.addShake(0.6);
      this.deps.ui.flash('special');
      this.deps.effects.spawnRing(this.player.pos, '#ffd400', 4.4, 0.8);
      this.deps.effects.spawnPillar(this.player.pos, '#ffe45c', 4.2);
      this.deps.ui.toast('RINASCITA USATA', 'SOLO UNA VOLTA PER RUN', 2200);
      return;
    }
    this.die(reason, 'I NON-MORTI HANNO VINTO');
  }

  private die(reason: string, subtitle: string): void {
    if (this.phase === 'dead' || this.phase === 'victory') return;
    this.phase = 'dead';
    this.deathTimer = 2.2;
    this.player.controlLocked = true;
    this.player.attack = null;
    this.deps.audio.stopMusic();
    this.deps.audio.playSfx('gameOver');
    this.deps.cameraRig.addPunch(6);
    this.deps.ui.flash('hurt');
    this.deps.ui.toast(reason, subtitle, 2600);
    this.previousBestRound = this.deps.save.records.bestRound;
    this.deathReason = reason;
    this.deps.save.recordRun({ round: this.round, kills: this.kills, points: this.points, extracted: false });
    this.deps.save.clearActive();
    this.updateHud();
  }

  private sendGameOver(): void {
    if (this.resultSent) return;
    this.resultSent = true;
    const records = this.deps.save.records;
    this.deps.callbacks.onGameOver({
      mode: this.modeType,
      round: this.round,
      kills: this.kills,
      headshots: this.headshots,
      points: this.points,
      time: Math.floor(this.runTime),
      extracted: false,
      reason: this.deathReason,
      newRecord: this.round > this.previousBestRound,
      bestRound: records.bestRound,
    });
  }

  private sendVictory(): void {
    if (this.resultSent) return;
    this.resultSent = true;
    this.deps.save.recordRun({ round: this.round, kills: this.kills, points: this.points, extracted: true });
    this.deps.save.clearActive();
    const records = this.deps.save.records;
    this.deps.callbacks.onVictory({
      mode: this.modeType,
      round: this.round,
      kills: this.kills,
      headshots: this.headshots,
      points: this.points,
      time: Math.floor(this.runTime),
      extracted: true,
      reason: 'ESTRATTO DA MILANO',
      newRecord: true,
      bestRound: records.bestRound,
    });
  }

  // ── Prompt / purchases ───────────────────────────────────────────────
  private refreshPrompt(): void {
    let best: ZombieInteractable | null = null;
    let bestDistance = Infinity;
    for (const target of this.map.interactables) {
      if (target.kind === 'door' && target.doorId && this.openDoors.has(target.doorId)) continue;
      if (target.kind === 'power' && this.powered) continue;
      if (target.kind === 'perk' && target.perk && this.perks.has(target.perk)) continue;
      // Do not let the ammo crate steal the prompt from a weapon you do not own yet.
      if (target.kind === 'ammo' && target.weapon && !this.weapons.has(target.weapon)) continue;
      if (target.kind === 'extract') continue;
      const distance = Math.hypot(target.x - this.player.posX, target.z - this.player.posZ);
      if (distance <= target.radius && distance < bestDistance) {
        bestDistance = distance;
        best = target;
      }
    }
    let window: ZombieWindow | null = null;
    let windowDistance = 2.6;
    for (const candidate of this.map.windows) {
      if (!candidate.broken) continue;
      const distance = Math.hypot(candidate.inside.x - this.player.posX, candidate.inside.z - this.player.posZ);
      if (distance < windowDistance) {
        windowDistance = distance;
        window = candidate;
      }
    }
    this.prompt.interactable = best;
    this.prompt.window = window;
    if (window) {
      this.prompt.label = 'RIPARA BARRICATA';
      this.prompt.sub = '100 PUNTI · TORNA SOLIDA';
      this.prompt.price = 100;
      return;
    }
    if (best) {
      if (best.kind === 'wallbuy' && best.weapon) {
        const owned = this.weapons.has(best.weapon);
        this.prompt.label = owned ? `MUNIZIONI ${WEAPONS[best.weapon].name}` : `COMPRA ${WEAPONS[best.weapon].name}`;
        this.prompt.sub = owned ? 'RICARICA COMPLETA' : WEAPONS[best.weapon].tag;
        this.prompt.price = owned ? WEAPONS[best.weapon].ammoPrice : WEAPONS[best.weapon].price;
      } else {
        this.prompt.label = best.label;
        this.prompt.sub = best.sub;
        this.prompt.price = best.price;
      }
      return;
    }
    this.prompt.label = '';
    this.prompt.sub = '';
    this.prompt.price = 0;
  }

  // ── Power-ups ────────────────────────────────────────────────────────
  private dropPowerUp(position: THREE.Vector3): void {
    if (this.pickups.length >= 3) return;
    const kinds: Array<PowerUp['kind']> = ['ammo', 'points', 'heal', 'double'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)] ?? 'ammo';
    const group = new THREE.Group();
    group.position.set(position.x + random(-0.6, 0.6), 0.5, position.z + random(-0.6, 0.6));
    const geo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    const color = kind === 'ammo' ? '#ffd400' : kind === 'points' ? '#4fe6ff' : kind === 'heal' ? '#6dff9e' : '#ff3d8a';
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3, flatShading: true });
    const mesh = new THREE.Mesh(geo, material);
    group.add(mesh);
    this.deps.scene.add(group);
    this.pickups.push({ kind, group, x: group.position.x, z: group.position.z, ttl: 30 });
  }

  private updatePowerUps(dt: number): void {
    for (const pickup of this.pickups) {
      pickup.ttl -= dt;
      pickup.group.rotation.y += dt * 2.2;
      pickup.group.position.y = 0.5 + Math.sin(this.runTime * 3 + pickup.x) * 0.12;
      if (pickup.ttl <= 0) continue;
      const distance = Math.hypot(pickup.x - this.player.posX, pickup.z - this.player.posZ);
      if (distance > 1.35) continue;
      pickup.ttl = 0;
      this.collectPowerUp(pickup);
    }
    for (const pickup of this.pickups) {
      if (pickup.ttl > 0) continue;
      pickup.group.removeFromParent();
      pickup.group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
    }
    this.pickups = this.pickups.filter((pickup) => pickup.ttl > 0);
  }

  private collectPowerUp(pickup: PowerUp): void {
    if (pickup.kind === 'ammo') {
      for (const slot of this.weapons.slots) {
        if (!slot) continue;
        const spec = WEAPONS[slot.id];
        slot.reserve = Math.min(spec.reserveMax, slot.reserve + Math.round(spec.reserveMax * 0.5));
      }
      this.deps.ui.toast('RIFORNIMENTO', 'MUNIZIONI DI RISERVA +50%', 1500);
    } else if (pickup.kind === 'points') {
      this.addPoints(500);
      this.deps.ui.toast('BONUS', '+500 PUNTI', 1500);
    } else if (pickup.kind === 'heal') {
      this.player.heal(40);
      this.deps.ui.toast('MEDIKIT', '+40 SALUTE', 1500);
    } else {
      this.doublePointsTimer = DOUBLE_POINTS_SECONDS;
      this.deps.ui.toast('DOPPIO PUNTI', `${DOUBLE_POINTS_SECONDS} SECONDI`, 1500);
    }
    this.deps.audio.playSfx('pickup');
    this.deps.effects.spawnRing(pickup.group.position.clone().setY(0), '#ffd400', 1.4, 0.4);
  }

  // ── Visuals / HUD ────────────────────────────────────────────────────
  followSky(position: THREE.Vector3): void {
    this.map.followCamera(position);
  }

  setHudVisible(visible: boolean): void {
    this.hud.setVisible(visible);
    if (!visible) document.body.classList.remove('is-zombies');
  }

  updateVisual(dt: number, alpha: number, frozen: boolean): void {
    this.player.updateVisual(dt, alpha, frozen);
    for (const zombie of this.zombies) zombie.updateVisual(dt, alpha, frozen);
    this.view.pose(this.player.visual, this.player.isDodgingActive, this.player.hurtTimer > 0);
    this.view.update(frozen ? 0 : dt);
    for (const pickup of this.pickups) pickup.group.rotateY(frozen ? 0 : dt * 1.4);
  }

  updateHud(): void {
    const slot = this.weapons.current;
    const spec = slot ? WEAPONS[slot.id] : null;
    const prompt: ZombiesPrompt | null = this.prompt.label
      ? {
          label: this.prompt.label,
          sub: this.prompt.sub,
          price: this.prompt.price,
          affordable: this.points >= this.prompt.price,
        }
      : null;
    const reloadProgress = slot && spec ? (this.weapons.reloading ? 1 - this.weapons.reloadTimer / (spec.reload * (this.perks.has('ricarica') ? 0.6 : 1)) : 0) : 0;
    const slotNames: [string, string | null] = [
      this.weapons.slots[0] ? WEAPONS[this.weapons.slots[0].id].name : 'VUOTO',
      this.weapons.slots[1] ? WEAPONS[this.weapons.slots[1].id].name : null,
    ];
    let intermission: number | null = null;
    if (this.phase === 'intermission') intermission = this.intermissionTimer;
    this.hud.update({
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      points: this.points,
      round: Math.max(1, this.phase === 'intermission' && !this.pendingExtraction ? this.round + 1 : this.round),
      mode: this.modeType,
      remaining: alive(this.zombies) + this.spawnQueue.length,
      weaponName: spec?.name ?? 'SENZA ARMA',
      weaponTag: spec?.tag ?? 'TROVA UN\'ARMA',
      mag: slot?.mag ?? 0,
      reserve: slot?.reserve ?? 0,
      reloading: this.weapons.reloading,
      reloadRatio: reloadProgress,
      slotNames,
      activeSlot: this.weapons.active,
      perks: [...this.perks],
      powered: this.powered,
      prompt,
      extraction:
        this.phase === 'extraction'
          ? { active: true, time: this.extractionTimer, hold: this.extractionHold / EXTRACTION_HOLD }
          : null,
      intermission,
      buff: this.doublePointsTimer > 0 ? `DOPPIO PUNTI · ${Math.ceil(this.doublePointsTimer)}s` : null,
    });
  }

  private cleanupCorpses(): void {
    const survivors: Zombie[] = [];
    for (const zombie of this.zombies) {
      if (!zombie.alive && zombie.deathTimer > 2.6) {
        zombie.dispose();
        this.earnedPoints.delete(zombie.id);
        continue;
      }
      survivors.push(zombie);
    }
    this.zombies = survivors;
  }

  private playerEvents() {
    return {
      onAttackStart: () => undefined,
      onDodge: () => {
        this.deps.audio.playSfx('dodge');
      },
      onSpecial: () => undefined,
      onPerfectDodge: () => undefined,
      onHurt: () => undefined,
      onDeath: () => undefined,
    };
  }

  // ── Debug / test hooks ───────────────────────────────────────────────
  debugSnapshot(): Record<string, unknown> {
    return {
      mode: 'zombies',
      phase: this.phase,
      round: this.round,
      points: this.points,
      kills: this.kills,
      headshots: this.headshots,
      hp: Math.round(this.player.hp),
      alive: alive(this.zombies),
      queue: this.spawnQueue.length,
      weapon: this.weapons.current?.id ?? null,
      mag: this.weapons.current?.mag ?? 0,
      reserve: this.weapons.current?.reserve ?? 0,
      doors: [...this.openDoors],
      powered: this.powered,
      perks: [...this.perks],
      prompt: this.prompt.label,
      extraction: this.phase === 'extraction' ? { time: Math.round(this.extractionTimer), hold: this.extractionHold } : null,
      playerX: Number(this.player.posX.toFixed(2)),
      playerZ: Number(this.player.posZ.toFixed(2)),
      camera: this.deps.cameraRig.camera.position.toArray().map((value) => Number(value.toFixed(2))),
      reviveUsed: this.reviveUsed,
      zombiesAt: this.zombies.filter((z) => z.alive).map((z) => [Number(z.posX.toFixed(1)), Number(z.posZ.toFixed(1)), z.entryStage ?? '-', z.windowId ?? '-']),
      barricades: this.map.windows.slice(0, 4).map((w) => Math.round(w.health)),
    };
  }

  debugAddPoints(amount: number): void {
    this.points += Math.max(0, Math.floor(amount));
    this.updateHud();
  }

  debugClearZombies(): void {
    for (const zombie of this.zombies) {
      if (zombie.alive) {
        zombie.hp = 0;
        zombie.alive = false;
        zombie.attack = null;
        zombie.detachBody();
        this.killZombie(zombie, false);
      }
    }
  }

  debugOpenAllDoors(): void {
    for (const door of this.map.doors) {
      if (this.map.openDoor(door.id)) this.openDoors.add(door.id);
    }
  }

  debugStartRound(round: number): void {
    this.startRound(Math.max(1, Math.floor(round)));
  }

  debugCompleteRound(): void {
    this.debugClearZombies();
    this.spawnQueue = [];
    if (this.phase === 'round') this.completeRound();
  }

  debugHurt(amount: number): void {
    this.player.applyHit(
      {
        damage: amount,
        dirX: 0,
        dirZ: 1,
        knockback: 0,
        hitstun: 0.1,
        hitstop: 0,
        heavy: false,
        specId: 'debug',
        fromX: this.player.posX,
        fromZ: this.player.posZ + 1,
      },
      this.player,
    );
    if (!this.player.alive) this.onPlayerDown('DEBUG');
  }

  debugBreakWindow(): string | null {
    const window = this.map.windows.find((entry) => !entry.broken);
    if (!window) return null;
    this.map.damageWindow(window.id, window.maxHealth);
    return window.id;
  }

  /** Test hook: drops an already-inside zombie in front of the player. */
  debugSpawnZombie(kind: ZombieKind = 'walker'): void {
    const spawn = new THREE.Vector3(
      this.player.posX + this.player.forwardX * 4,
      0,
      this.player.posZ + this.player.forwardZ * 4,
    );
    const zombie = new Zombie(this.deps.physics, this.deps.factory, this.combat, ZOMBIE_ARCHETYPES[kind], spawn, 0);
    zombie.entryStage = 'inside';
    zombie.attackCooldown = 1.6;
    zombie.addToScene(this.deps.scene);
    this.zombies.push(zombie);
  }

  debugAim(x: number, z: number): void {
    this.deps.cameraRig.yaw = Math.atan2(this.player.posX - x, this.player.posZ - z);
    this.deps.cameraRig.pitch = 0.05;
  }

  debugTeleport(x: number, z: number): void {
    this.player.body.teleport(x, 0, z);
    this.player.syncFromPhysics();
  }

  dispose(): void {
    this.hud.setVisible(false);
    this.view.dispose();
    for (const zombie of this.zombies) zombie.dispose();
    this.zombies = [];
    for (const pickup of this.pickups) pickup.group.removeFromParent();
    this.pickups = [];
    this.player.dispose();
    this.map.dispose();
    this.deps.physics.resetWorld();
    document.body.classList.remove('is-zombies');
  }
}
