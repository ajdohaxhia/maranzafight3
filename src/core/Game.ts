import * as THREE from 'three';
import { Physics } from './Physics';
import { Renderer, QUALITY_PROFILES } from './Renderer';
import { CameraRig } from './CameraRig';
import { GameLoop } from './GameLoop';
import { CharacterFactory } from '../graphics/CharacterFactory';
import { Effects } from '../graphics/Effects';
import { InputManager } from '../controls/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import type { Settings } from '../systems/SettingsManager';
import { UI, type LevelResult } from '../ui/UI';
import type { HudModel } from '../ui/HUD';
import { LEVELS, LevelManager, type LevelConfig } from '../world/LevelManager';
import { CombatSystem } from '../combat/CombatSystem';
import { ComboTracker, scoreForHit } from '../combat/ComboSystem';
import { PLAYER_KICK, type AttackSpec, type Combatant, type HitInfo } from '../combat/types';
import { Player } from '../entities/Player';
import { Enemy, ENEMY_ARCHETYPES, type EnemyContext, type EnemyKind } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Pickup } from '../entities/Pickup';
import { WaveManager, type SpawnRequest } from '../systems/WaveManager';
import { AttackDirector } from '../ai/AttackDirector';
import { ZombiesMode, type ZombiesResult } from '../zombies/ZombiesMode';
import { ZombieSave, type ZombiesRunMode } from '../zombies/ZombieSave';

type GameState = 'boot' | 'menu' | 'playing' | 'paused' | 'results';

let nextVariant = 0;

export class Game {
  private readonly renderer: Renderer;
  private readonly physics: Physics;
  private readonly cameraRig: CameraRig;
  private readonly input: InputManager;
  private readonly audio: AudioManager;
  private readonly save: SaveManager;
  private readonly zombieSave = ZombieSave.create();
  private readonly ui: UI;
  private readonly factory = new CharacterFactory();
  private readonly effects: Effects;
  private readonly levels: LevelManager;
  private readonly combat: CombatSystem;
  private readonly loop: GameLoop;
  private readonly combo = new ComboTracker();

  private state: GameState = 'boot';
  private levelIndex = 0;
  private config: LevelConfig = LEVELS[0] as LevelConfig;
  private player: Player | null = null;
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private pickups: Pickup[] = [];
  private waves: WaveManager | null = null;
  private director = new AttackDirector(1);

  private score = 0;
  private levelStartScore = 0;
  private levelKos = 0;
  private levelBestCombo = 0;
  private bestCombo = 0;
  private totalKos = 0;
  private levelClock = 0;
  private runClock = 0;

  private hitstop = 0;
  private slowmo = 0;
  private captureMode = false;
  private waveDelay = 1.4;
  private awaitingNextWave = false;
  private finalWave = false;
  private levelCompleteDelay = -1;
  private bossIntroActive = false;
  private bossIntroTimer = 0;
  private bossActive = false;
  private victoryDelay = -1;
  private deathDelay = -1;
  private gameOverShown = false;
  private levelCompleteShown = false;
  private victoryShown = false;
  private menuMode = false;
  private interactionTarget: Pickup | null = null;
  private lastEnemyAttacks = new Map<number, number>();
  private zombies: ZombiesMode | null = null;
  private lastZombiesMode: ZombiesRunMode = 'infinite';
  private readonly unsubscribers: Array<() => void> = [];
  private readonly cameraTarget = new THREE.Vector3();
  private readonly debugInfo = { started: false };

  constructor(canvas: HTMLCanvasElement, physics: Physics, save: SaveManager) {
    this.physics = physics;
    this.save = save;
    const settings = save.getSettings();
    this.renderer = new Renderer(canvas, settings.quality);
    this.cameraRig = new CameraRig(this.renderer.camera);
    this.cameraRig.setPhysics(physics);
    this.audio = new AudioManager();
    this.audio.setSettings(settings);
    this.effects = new Effects(this.renderer.scene);
    this.effects.setDensity(QUALITY_PROFILES[settings.quality].particleDensity);
    this.levels = new LevelManager(this.renderer.scene, physics, settings.quality);
    this.combat = new CombatSystem({
      onDamage: (attacker, target, info, spec) => this.handleDamage(attacker, target, info, spec),
      onPerfectDodge: (attacker, target) => this.handlePerfectDodge(attacker, target),
    });
    this.input = new InputManager(canvas, {
      onPauseRequested: () => this.togglePause(),
      onAnyGesture: () => this.audio.unlock(),
    });
    this.ui = new UI(save, {
      onNewGame: () => this.startNewGame(false),
      onContinue: (level) => this.startNewGame(true, level),
      onSelectLevel: (level) => this.startNewGame(false, level),
      onSettingsChanged: (s) => this.applySettings(s),
      onWipeSave: () => this.handleWipeSave(),
      onResume: () => this.resumeGame(),
      onRestartLevel: () => this.retryLevel(),
      onQuit: () => this.returnToMenu(),
      onPause: () => this.pauseGame(),
      onNextLevel: () => this.nextLevel(),
      onRetry: () => this.retryLevel(),
      onMenu: () => this.returnToMenu(),
      onNewGamePlus: () => this.startNewGame(false),
      onZombies: (mode) => this.startZombies(mode),
      onZombiesResume: () => this.startZombies(this.zombieSave.active?.mode ?? 'infinite', true),
      onZombiesRetry: () => this.startZombies(this.lastZombiesMode, false),
      onZombiesMenu: () => this.returnToMenu(),
      onInstall: () => undefined,
      onUiSound: () => this.audio.playSfx('ui'),
    }, this.zombieSave);
    this.applySettings(settings);
    this.loop = new GameLoop(
      {
        fixedUpdate: (dt) => this.fixedUpdate(dt),
        render: (dt, alpha) => this.render(dt, alpha),
      },
      1 / 60,
    );
    this.bindEnvironment();
    this.ui.showBoot();
    this.ui.setBoot(0.18, 'PREPARO LA PIAZZA', 'Scena 3D e materiali procedurati');
  }

  async start(): Promise<void> {
    this.ui.setBoot(0.36, 'CARICO GLI ATTORI', 'Modelli low-poly e rig procedurali');
    await this.nextFrame();
    this.loadMenuScene();
    this.ui.setBoot(0.78, 'SCALDO IL BORSELLO', 'Fisica WebAssembly pronta');
    await this.nextFrame();
    this.ui.setBoot(0.94, 'ACCENDO LE LUCI', 'Milano non dorme mai');
    await this.nextFrame();
    this.ui.hideBoot();
    this.ui.showMenu();
    this.ui.refreshMenu(this.continueLabel());
    this.state = 'menu';
    this.menuMode = true;
    this.audio.startMusic('menu');
    this.loop.start();
    this.debugInfo.started = true;
  }

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  private continueLabel(): string {
    const level = LEVELS[this.save.nextLevelIndex()];
    return level ? `LIVELLO ${level.number} · ${level.shortName}` : 'LIVELLO 1';
  }

  // ── Scenes ──────────────────────────────────────────────────────────
  private loadMenuScene(): void {
    this.cleanupActors();
    this.effects.clear();
    this.combo.reset();
    this.cameraRig.aimLook = 0;
    this.cameraRig.setMode('menu', {
      center: new THREE.Vector3(1.4, 1.15, 2.4),
      radius: 6.4,
      height: 2.35,
      speed: 0.1,
      startAngle: 2.2,
    });
    const config = LEVELS[0] as LevelConfig;
    this.levels.setQuality(this.save.getSettings().quality);
    this.levels.load(0);
    this.config = config;
    this.levelIndex = 0;
    this.director = new AttackDirector(1);
    this.ui.setControlsActive(false);

    const spawn = new THREE.Vector3(0, 0, 4);
    this.player = new Player(this.physics, this.factory, this.combat, this.playerEvents(), spawn);
    this.player.setYaw(Math.PI);
    this.player.setControlLocked(true);
    this.player.anim.play('idle', { reset: true });
    this.player.addToScene(this.renderer.scene);

    // Two static maranza for the title screen standoff.
    const demoDirector = new AttackDirector(2);
    const base = new Enemy(
      this.physics,
      this.factory,
      this.combat,
      demoDirector,
      ENEMY_ARCHETYPES.base,
      new THREE.Vector3(2.9, 0, 1.9),
      { hp: 1, damage: 1 },
      0,
    );
    base.setYaw(Math.atan2(spawn.x - 2.9, spawn.z - 1.9));
    base.anim.play('idle');
    base.addToScene(this.renderer.scene);
    this.enemies.push(base);
    const turbo = new Enemy(
      this.physics,
      this.factory,
      this.combat,
      demoDirector,
      ENEMY_ARCHETYPES.turbo,
      new THREE.Vector3(-2.7, 0, 1.6),
      { hp: 1, damage: 1 },
      1,
    );
    turbo.setYaw(Math.atan2(spawn.x + 2.7, spawn.z - 1.6));
    turbo.anim.play('idle');
    turbo.addToScene(this.renderer.scene);
    this.enemies.push(turbo);

    this.menuMode = true;
    this.state = 'menu';
    this.ui.showMenu();
    this.ui.refreshMenu(this.continueLabel());
    this.audio.startMusic('menu', true);
    this.loop.setPaused(false);
  }

  private startNewGame(continueRun: boolean, level = 1): void {
    this.audio.unlock();
    if (this.zombies) {
      this.zombies.dispose();
      this.zombies = null;
      this.input.setShooterMode(false);
    }
    this.score = 0;
    this.bestCombo = 0;
    this.totalKos = 0;
    this.runClock = 0;
    this.levelStartScore = 0;
    this.levelKos = 0;
    this.levelBestCombo = 0;
    // Starting from the level select keeps the chosen piazza; a brand new run
    // (or New Game+) always restarts from the station.
    const requested = continueRun || level > 1 ? level - 1 : 0;
    const startIndex = Math.min(LEVELS.length - 1, Math.max(0, requested));
    this.startLevel(startIndex, 0);
    this.ui.refreshMenu(this.continueLabel());
    this.requestPointerLock();
  }

  // ── Zombies ─────────────────────────────────────────────────────────
  private startZombies(mode: ZombiesRunMode, resume = false): void {
    this.audio.unlock();
    if (this.zombies) {
      this.zombies.dispose();
      this.zombies = null;
    }
    this.cleanupActors();
    this.levels.unload();
    this.effects.clear();
    this.pickups = [];
    this.boss = null;
    this.bossActive = false;
    this.combo.reset();
    this.ui.bossIntro(false);
    this.lastZombiesMode = mode;
    const snapshot = resume ? this.zombieSave.active : null;
    this.menuMode = false;
    this.state = 'playing';
    this.input.setShooterMode(true);
    this.input.clearTransient();
    this.input.setEnabled(true);
    this.ui.enterZombies();
    this.loop.setPaused(false);
    this.audio.setPaused(false);
    this.zombies = new ZombiesMode(
      {
        scene: this.renderer.scene,
        physics: this.physics,
        factory: this.factory,
        input: this.input,
        audio: this.audio,
        effects: this.effects,
        cameraRig: this.cameraRig,
        ui: this.ui,
        save: this.zombieSave,
        quality: this.save.getSettings().quality,
        callbacks: {
          onGameOver: (result) => this.finishZombies(result, false),
          onVictory: (result) => this.finishZombies(result, true),
          onExit: () => this.returnToMenu(),
        },
      },
      snapshot?.mode ?? mode,
      snapshot,
    );
    this.zombies.updateHud();
    this.requestPointerLock();
  }

  private finishZombies(result: ZombiesResult, victory: boolean): void {
    if (this.state !== 'playing') return;
    this.state = 'results';
    this.input.setEnabled(false);
    this.input.setShooterMode(false);
    this.ui.setControlsActive(false);
    this.ui.setPickupPrompt(false);
    this.zombies?.setHudVisible(false);
    this.zombies?.updateHud();
    this.audio.setPaused(false);
    this.ui.showZombiesResult(result, victory);
  }

  private startLevel(index: number, baseScore?: number): void {
    this.audio.unlock();
    this.cleanupActors();
    this.effects.clear();
    this.combo.reset();
    this.pickups.forEach((pickup) => pickup.dispose());
    this.pickups = [];
    this.boss = null;
    this.bossActive = false;
    this.bossIntroActive = false;
    this.ui.bossIntro(false);

    this.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    this.config = LEVELS[this.levelIndex] as LevelConfig;
    this.levels.setQuality(this.save.getSettings().quality);
    const built = this.levels.load(this.levelIndex);
    this.director = new AttackDirector(this.config.maxAttackers);
    this.waves = new WaveManager(this.config.waves);
    this.score = baseScore ?? this.score;
    this.levelStartScore = this.score;
    this.levelKos = 0;
    this.levelBestCombo = 0;
    this.levelClock = 0;
    this.waveDelay = 1.5;
    this.awaitingNextWave = false;
    this.finalWave = false;
    this.levelCompleteDelay = -1;
    this.levelCompleteShown = false;
    this.victoryDelay = -1;
    this.victoryShown = false;
    this.deathDelay = -1;
    this.gameOverShown = false;
    this.bossIntroTimer = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.lastEnemyAttacks.clear();
    this.input.clearTransient();

    const spawn = built.arena.playerStart.clone();
    const startYaw = built.arena.startYaw ?? 0;
    this.player = new Player(this.physics, this.factory, this.combat, this.playerEvents(), spawn);
    this.player.setYaw(startYaw + Math.PI);
    this.player.addToScene(this.renderer.scene);
    this.player.setControlLocked(false);

    this.cameraRig.setMode('follow');
    this.cameraRig.resetToPlayer();
    this.cameraRig.setTarget(this.player.pos);
    this.cameraTarget.copy(this.player.pos);
    this.cameraRig.yaw = startYaw;
    this.cameraRig.pitch = 0.24;
    this.cameraRig.aimLook = 0;

    this.state = 'playing';
    this.menuMode = false;
    this.ui.enterGame();
    this.ui.setPickupPrompt(false);
    this.input.setEnabled(true);
    this.loop.setPaused(false);
    this.audio.setPaused(false);
    this.audio.startMusic(this.config.music, true);
    this.ui.toast(`LIVELLO ${this.config.number}`, this.config.name, 2400);
    this.ui.refreshMenu(this.continueLabel());
    this.requestPointerLock();
    // Short grace period before the player can be hit.
    this.player.invulnTimer = 1.2;
  }

  private cleanupActors(): void {
    for (const pickup of this.pickups) pickup.dispose();
    this.pickups = [];
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies = [];
    this.boss = null;
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }
    this.director.releaseAll();
    this.effects.clear();
    this.ui.setPickupPrompt(false);
  }

  // ── Player events ───────────────────────────────────────────────────
  private playerEvents() {
    return {
      onAttackStart: (spec: AttackSpec) => {
        if (spec.id === 'special') return;
        this.audio.playSfx(spec.heavy ? 'kick' : 'punch');
        if (spec.heavy) {
          this.cameraRig.addShake(0.08);
          this.cameraRig.addPunch(1.1);
        }
      },
      onDodge: () => {
        this.audio.playSfx('dodge');
        this.cameraRig.addShake(0.05);
        if (this.player) this.effects.spawnSparks(this.player.pos, '#cfd8ff', 5, 0.6);
      },
      onSpecial: () => {
        if (!this.player) return;
        this.audio.playSfx('special');
        this.cameraRig.addShake(0.5);
        this.cameraRig.addPunch(6);
        this.ui.flash('special');
        this.effects.spawnRing(this.player.pos, '#ffd400', 4.4, 0.55);
        this.effects.spawnRing(this.player.pos, '#ff2f2f', 3.1, 0.4, 0.08);
        this.effects.spawnPillar(this.player.pos, '#ffe45c', 4.2);
        this.effects.spawnSparks(this.player.pos, '#ffd400', 24, 1.7);
        this.ui.toast('RIVOLTA MILANESE', 'SPECIALE SCATENATO', 1100);
      },
      onPerfectDodge: () => {
        if (!this.player) return;
        this.audio.playSfx('perfect');
        this.slowmo = Math.max(this.slowmo, 0.45);
        this.effects.spawnFlash(this.player.pos.clone().setY(1.2), '#fff2b0', 2.2, 0.3);
        this.effects.spawnRing(this.player.pos, '#ffd400', 2.2, 0.4);
        this.effects.spawnSparks(this.player.pos, '#fff2b0', 12, 1.1);
        this.cameraRig.addShake(0.08);
        this.ui.toast('SCHIVATA PERFETTA', '+150', 850);
      },
      onHurt: () => {
        if (!this.player) return;
        this.audio.playSfx('heavy');
        this.cameraRig.addShake(0.4);
        this.cameraRig.addPunch(3.4);
        this.ui.flash('hurt');
        this.hitstop = Math.max(this.hitstop, 0.06);
        this.effects.spawnSparks(this.player.pos, '#ff7b6a', 12, 1.2);
      },
      onDeath: () => {
        if (!this.player) return;
        this.audio.playSfx('ko');
        this.audio.stopMusic();
        this.cameraRig.addShake(0.55);
        this.cameraRig.addPunch(5);
        this.slowmo = 0.7;
        this.ui.flash('hurt');
        this.effects.spawnRing(this.player.pos, '#ff2f2f', 3.2, 0.7);
        this.effects.spawnFlash(this.player.pos.clone().setY(1.1), '#ff5a4a', 3, 0.5);
        this.deathDelay = 2.1;
        this.combo.reset();
        this.ui.setPickupPrompt(false);
        this.ui.setControlsActive(false);
      },
    };
  }

  // ── Damage / scoring ────────────────────────────────────────────────
  private handleDamage(attacker: Combatant, target: Combatant, info: HitInfo, spec: AttackSpec): void {
    const color = target.team === 'player' ? '#ff7b6a' : '#ffd400';
    this.effects.spawnSparks(new THREE.Vector3(target.posX, 0, target.posZ), color, info.heavy ? 18 : 10, info.heavy ? 1.5 : 1);
    this.effects.spawnRing(new THREE.Vector3(target.posX, 0, target.posZ), info.heavy ? '#ffdf7a' : '#fff4cf', info.heavy ? 1.9 : 1.1, 0.3);
    this.effects.spawnFlash(
      new THREE.Vector3(target.posX, 1.2, target.posZ),
      target.team === 'player' ? '#ff8a72' : '#fff1b8',
      info.heavy ? 2.3 : 1.35,
      info.heavy ? 0.26 : 0.17,
    );
    this.cameraRig.addShake(info.heavy ? 0.32 : 0.15);
    this.cameraRig.addPunch(info.heavy ? 3 : 1.4);
    this.hitstop = Math.max(this.hitstop, info.heavy ? info.hitstop * 1.2 : info.hitstop);
    this.audio.playSfx(info.heavy ? 'heavy' : 'hit');

    if (attacker === this.player) {
      const multiplier = this.combo.registerHit();
      this.levelBestCombo = Math.max(this.levelBestCombo, this.combo.count);
      this.bestCombo = Math.max(this.bestCombo, this.combo.count);
      this.score += scoreForHit(info.damage, multiplier, false);
      this.player?.addEnergy(spec.energyGain ?? 6);
      this.ui.spawnDamage(
        new THREE.Vector3(target.posX, 1.65, target.posZ),
        this.renderer.camera,
        Math.round(info.damage),
        info.heavy ? 'crit' : 'enemy',
      );
    } else if (target === this.player) {
      this.combo.reset();
      this.ui.spawnDamage(
        new THREE.Vector3(target.posX, 1.65, target.posZ),
        this.renderer.camera,
        Math.round(info.damage),
        'player',
      );
    }

    if (target.team === 'enemy' && !target.alive) {
      const enemy = target as Enemy;
      if (target === this.boss) {
        this.handleBossDeath();
      }
      this.handleEnemyDeath(enemy);
    }
  }

  private handlePerfectDodge(attacker: Combatant, target: Combatant): void {
    if (target !== this.player) return;
    this.player.onPerfectDodge();
    this.score += 150;
    void attacker;
  }

  private handleEnemyDeath(enemy: Enemy): void {
    if (enemy.deathHandled) return;
    enemy.deathHandled = true;
    if (!enemy.isDebug) this.waves?.onEnemyKilled();
    this.kosAward(enemy);
    this.effects.spawnRing(enemy.pos, '#ffd400', enemy.archetype.kind === 'boss' ? 7 : 2.6, enemy.archetype.kind === 'boss' ? 0.9 : 0.5);
    this.effects.spawnSparks(enemy.pos, '#ffcf6b', enemy.archetype.kind === 'boss' ? 34 : 16, 1.4);
    this.effects.spawnFlash(enemy.pos.clone().setY(1.1), '#ffdf9a', enemy.archetype.kind === 'boss' ? 6 : 2.4, 0.3);
    this.cameraRig.addPunch(enemy.archetype.kind === 'boss' ? 6 : 2.4);
    this.hitstop = Math.max(this.hitstop, enemy.archetype.kind === 'boss' ? 0.14 : 0.05);
    if (enemy.archetype.kind !== 'boss' && !enemy.isDebug) {
      this.maybeDropPickup(enemy);
    }
    this.audio.playSfx('ko');
  }

  private kosAward(enemy: Enemy): void {
    this.levelKos += 1;
    this.totalKos += 1;
    const base = enemy.archetype.score;
    const bonus = Math.round(200 * this.combo.count * 0.1);
    this.score += base + bonus;
  }

  private maybeDropPickup(enemy: Enemy): void {
    if (this.pickups.length >= 4) return;
    if (Math.random() > 0.32) return;
    const offsetX = (Math.random() - 0.5) * 1.2;
    const offsetZ = (Math.random() - 0.5) * 1.2;
    const bounds = this.levels.current?.arena.bounds;
    const x = THREE.MathUtils.clamp(enemy.pos.x + offsetX, (bounds?.minX ?? -20) + 1.5, (bounds?.maxX ?? 20) - 1.5);
    const z = THREE.MathUtils.clamp(enemy.pos.z + offsetZ, (bounds?.minZ ?? -20) + 1.5, (bounds?.maxZ ?? 20) - 1.5);
    this.pickups.push(new Pickup(this.renderer.scene, new THREE.Vector3(x, 0, z), 30));
  }

  private handleBossDeath(): void {
    if (this.victoryDelay >= 0 || this.boss === null) return;
    this.victoryDelay = 3.4;
    this.slowmo = 0.85;
    this.bossActive = true;
    this.ui.flash('boss');
    this.score += 6000;
    this.audio.stopMusic();
    this.audio.playSfx('ko');
    this.cameraRig.setMode('orbit', {
      center: new THREE.Vector3(this.boss.pos.x, 1.4, this.boss.pos.z),
      radius: 6.2,
      height: 3.1,
      speed: 0.16,
      startAngle: 0.4,
    });
    this.player?.setControlLocked(true);
    this.ui.setControlsActive(false);
    this.ui.toast(this.config.bossName ?? 'IL RE È CADUTO', this.levelIndex >= LEVELS.length - 1 ? 'MILANO È SALVA (PIÙ O MENO)' : 'MA LA NOTTE NON È FINITA', 2600);
    this.effects.spawnRing(this.boss.pos, '#ffd400', 9, 1.2);
    this.effects.spawnRing(this.boss.pos, '#ff2f2f', 5.5, 0.9, 0.15);
    this.cameraRig.addShake(0.7);
  }

  private handleBossPhase(phase: number): void {
    if (!this.boss) return;
    this.audio.playSfx('bossPhase');
    this.cameraRig.addShake(0.55);
    this.cameraRig.addPunch(4.5);
    this.ui.flash('boss');
    this.hitstop = Math.max(this.hitstop, 0.1);
    this.effects.spawnRing(this.boss.pos, '#ff2f2f', 7.5, 0.8);
    this.effects.spawnSparks(this.boss.pos, '#ff5a4a', 24, 1.6);
    this.ui.toast(`FASE ${phase === 2 ? 'II' : 'III'}`, phase === 2 ? 'IL RE SI INCAZZA' : 'TUTTO O NIENTE', 1500);
  }

  // ── Boss spawn / intro ──────────────────────────────────────────────
  private spawnBoss(): void {
    if (this.boss) return;
    const arena = this.levels.current?.arena;
    const spawn = arena?.bossSpawn.clone() ?? new THREE.Vector3(0, 0, -6);
    const boss = new Boss(
      this.physics,
      this.factory,
      this.combat,
      this.director,
      spawn,
      { hp: this.config.hpScale, damage: this.config.damageScale },
    );
    boss.addToScene(this.renderer.scene);
    boss.onPhaseChange = (phase) => this.handleBossPhase(phase);
    boss.beginIntro();
    this.boss = boss;
    this.enemies.push(boss);
    this.bossActive = true;
    this.bossIntroActive = true;
    this.bossIntroTimer = 3.8;
    this.ui.setControlsActive(false);
    this.player?.setControlLocked(true);
    this.ui.bossIntro(true);
    this.audio.stopMusic();
    this.audio.startMusic('boss', true);
    this.audio.playSfx('bossIntro');
    this.cameraRig.setMode('orbit', {
      center: new THREE.Vector3(spawn.x, 1.6, spawn.z),
      radius: 5.6,
      height: 2.9,
      speed: 0.42,
      startAngle: 0.5,
    });
    this.effects.spawnRing(spawn, '#ff2f2f', 6, 0.9);
    this.effects.spawnSparks(spawn, '#ffcf6b', 22, 1.3);
  }

  private endBossIntro(): void {
    this.bossIntroActive = false;
    this.ui.bossIntro(false);
    this.ui.setControlsActive(true);
    this.player?.setControlLocked(false);
    this.player?.addEnergy(100);
    this.boss?.endIntro();
    this.cameraRig.setMode('follow');
    this.cameraRig.resetToPlayer();
    this.audio.setPaused(false);
    this.ui.toast('SCATENA LA RIVOLTA', 'SPECIALE CARICO AL 100%', 1800);
  }

  // ── Loop ────────────────────────────────────────────────────────────
  private fixedUpdate(dt: number): void {
    this.input.update(dt);

    if (this.captureMode) {
      this.levels.tick(dt);
      return;
    }

    if (this.zombies) {
      if (this.state === 'playing') this.zombies.update(dt);
      return;
    }

    this.levels.tick(dt);

    if (this.state === 'menu') {
      for (const enemy of this.enemies) {
        enemy.anim.play('idle');
      }
      this.player?.anim.play('idle');
      return;
    }

    if (this.state !== 'playing') return;

    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      return;
    }

    // Perfect dodges and the final KO briefly drop the world into slow motion.
    if (this.slowmo > 0) {
      this.slowmo = Math.max(0, this.slowmo - dt);
      dt *= 0.35;
    }

    this.levelClock += dt;
    this.runClock += dt;
    this.combo.update(dt);

    if (this.bossIntroActive) {
      this.bossIntroTimer -= dt;
      this.player?.update(dt, 0, 0, false);
      if (this.boss) {
        const ctx = this.enemyContext();
        this.boss.update(dt, ctx);
      }
      if (this.bossIntroTimer <= 0) this.endBossIntro();
      return;
    }

    if (!this.player) return;
    this.updateAim();
    this.handleInputActions();
    const movement = this.getMoveVector();
    this.player.update(dt, movement.x, movement.z, this.input.run && movement.length > 0.1);

    if (this.deathDelay > 0) {
      this.deathDelay -= dt;
      if (this.deathDelay <= 0) {
        this.showGameOver();
        return;
      }
    }

    if (this.victoryDelay > 0) {
      this.victoryDelay -= dt;
      if (this.victoryDelay <= 1.6 && !this.victoryShown && !this.player.victory) {
        this.player.playVictory();
      }
      if (this.victoryDelay <= 0) {
        // A boss can close any level: only the last arena rolls the credits.
        if (this.levelIndex >= LEVELS.length - 1) this.showVictory();
        else this.completeLevel();
        return;
      }
    }

    const ctx = this.enemyContext();
    for (const enemy of this.enemies) {
      enemy.update(dt, ctx);
    }

    this.combat.update(dt, this.combatants());
    this.physics.step();
    this.player.syncFromPhysics();
    for (const enemy of this.enemies) enemy.syncFromPhysics();

    this.updateEnemyTelegraphs(dt);
    if (this.player.alive && this.victoryDelay < 0) this.updateWaves(dt);
    this.updatePickups(dt);
    this.updateCameraTarget();
    this.cameraRig.setMode(this.bossIntroActive ? 'orbit' : 'follow');
  }

  private updateCameraTarget(): void {
    if (!this.player) return;
    this.cameraTarget.set(this.player.pos.x, this.player.pos.y + 1.38, this.player.pos.z);
    this.cameraRig.setTarget(this.cameraTarget);
  }

  private enemyContext(): EnemyContext {
    const player = this.player;
    return {
      player: player as Player,
      playerX: player?.posX ?? 0,
      playerZ: player?.posZ ?? 0,
      playerAlive: player?.alive ?? false,
      enemies: this.enemies,
      director: this.director,
      combat: this.combat,
      time: this.levelClock,
    };
  }

  private combatants(): Combatant[] {
    const list: Combatant[] = [];
    if (this.player) list.push(this.player);
    for (const enemy of this.enemies) if (enemy.alive) list.push(enemy);
    return list;
  }

  private getMoveVector(): { x: number; z: number; length: number } {
    const basis = this.cameraRig.getBasis();
    let x = basis.right.x * this.input.moveX + basis.forward.x * this.input.moveY;
    let z = basis.right.z * this.input.moveX + basis.forward.z * this.input.moveY;
    let length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
      length = 1;
    }
    return { x, z, length };
  }

  private updateAim(): void {
    if (!this.player) return;
    let nearest: Enemy | null = null;
    let best = 5.2;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const distance = Math.hypot(enemy.posX - this.player.posX, enemy.posZ - this.player.posZ);
      if (distance < best) {
        best = distance;
        nearest = enemy;
      }
    }
    if (nearest) this.player.setAimTarget(nearest.posX, nearest.posZ);
    else this.player.setAimTarget(null, null);
  }

  private handleInputActions(): void {
    const player = this.player;
    if (!player || !player.alive || player.controlLocked) {
      this.input.consume('punch');
      this.input.consume('kick');
      this.input.consume('dodge');
      this.input.consume('special');
      return;
    }
    if (this.input.consume('punch')) player.tryPunch();
    if (this.input.consume('kick')) player.tryKick();
    if (this.input.consume('dodge')) player.tryDodge();
    if (this.input.consume('special')) player.trySpecial();
    if (this.input.consume('interact')) this.tryCollectPickup();
  }

  private updateWaves(dt: number): void {
    const waves = this.waves;
    if (!waves) return;
    if (this.levelCompleteDelay > 0) {
      this.levelCompleteDelay -= dt;
      if (this.levelCompleteDelay <= 0) this.completeLevel();
      return;
    }
    if (!waves.started) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) {
        waves.start();
        this.announceWave();
      }
      return;
    }
    if (this.awaitingNextWave) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) {
        this.awaitingNextWave = false;
        if (this.finalWave) {
          if (!this.bossActive) this.levelCompleteDelay = 1.2;
        } else {
          waves.nextWave();
          this.announceWave();
        }
      }
      return;
    }
    if (this.bossActive) return;
    if (waves.waveCleared) {
      this.awardWaveClear();
      this.finalWave = waves.waveIndex >= waves.waveTotal - 1;
      this.awaitingNextWave = true;
      this.waveDelay = this.finalWave ? 1.7 : 2.5;
      return;
    }
    const requests = waves.update(dt);
    for (const request of requests) this.spawnFromRequest(request);
  }

  private announceWave(): void {
    const waves = this.waves;
    if (!waves) return;
    const label = waves.currentWave?.label ?? '';
    this.ui.toast(`ONDATA ${waves.waveNumber} / ${waves.waveTotal}`, label, 1800);
    this.audio.playSfx('wave');
    this.ui.setControlsActive(true);
  }

  private awardWaveClear(): void {
    const bonus = 400 + (this.waves?.waveIndex ?? 0) * 220;
    this.score += bonus;
    this.player?.addEnergy(10);
    this.ui.toast('ONDATA COMPLETATA', `+${bonus} PUNTI`, 1300);
    this.combo.reset();
    this.audio.playSfx('levelComplete');
  }

  private spawnFromRequest(request: SpawnRequest): void {
    if (request.kind === 'boss') {
      this.spawnBoss();
      return;
    }
    const archetype = ENEMY_ARCHETYPES[request.kind];
    const bounds = this.levels.current?.arena.bounds;
    const spawnPoints = this.levels.current?.arena.spawnPoints ?? [new THREE.Vector3(0, 0, -6)];
    const player = this.player;
    const sorted = [...spawnPoints].sort((a, b) => {
      const da = Math.hypot(a.x - (player?.posX ?? 0), a.z - (player?.posZ ?? 0));
      const db = Math.hypot(b.x - (player?.posX ?? 0), b.z - (player?.posZ ?? 0));
      return db - da;
    });
    const chosen = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))] ?? sorted[0];
    const jitterX = (Math.random() - 0.5) * 1.6;
    const jitterZ = (Math.random() - 0.5) * 1.6;
    const x = THREE.MathUtils.clamp((chosen?.x ?? 0) + jitterX, (bounds?.minX ?? -18) + 2, (bounds?.maxX ?? 18) - 2);
    const z = THREE.MathUtils.clamp((chosen?.z ?? 0) + jitterZ, (bounds?.minZ ?? -18) + 2, (bounds?.maxZ ?? 18) - 2);
    const variant = nextVariant++ % 3;
    const enemy = new Enemy(
      this.physics,
      this.factory,
      this.combat,
      this.director,
      archetype,
      new THREE.Vector3(x, 0, z),
      { hp: this.config.hpScale, damage: this.config.damageScale },
      variant,
    );
    enemy.setYaw(Math.atan2((player?.posX ?? 0) - x, (player?.posZ ?? 0) - z));
    enemy.addToScene(this.renderer.scene);
    this.enemies.push(enemy);
    this.effects.spawnRing(new THREE.Vector3(x, 0, z), '#ff2f2f', 1.6, 0.4);
    this.effects.spawnSparks(new THREE.Vector3(x, 0, z), '#ffd400', 8, 0.7);
  }

  private updateEnemyTelegraphs(dt: number): void {
    let telegraphCount = 0;
    let nearestThreatX = 0;
    let nearestThreatZ = 0;
    let nearestThreatDist = Infinity;
    const player = this.player;
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        this.effects.clearTelegraph(enemy.id);
        continue;
      }
      const attack = enemy.attack;
      if (!attack) {
        this.effects.clearTelegraph(enemy.id);
        continue;
      }
      const spec = attack.spec;
      if (attack.time < spec.windup) {
        const radius = spec.telegraphRadius ?? spec.aoeRadius ?? Math.max(1.2, spec.range);
        this.effects.setTelegraph(enemy.id, enemy.pos, radius, 0.08, spec.telegraphColor);
      } else {
        this.effects.clearTelegraph(enemy.id);
      }
      const last = this.lastEnemyAttacks.get(enemy.id);
      if (last !== attack.serial) {
        this.lastEnemyAttacks.set(enemy.id, attack.serial);
        this.audio.playSfx('dodge');
        // Boss attacks get their brand announced; generic enemies stay silent
        // besides the telegraph ring and audio cue.
        if (enemy.archetype.kind === 'boss') {
          this.ui.toast(spec.label, spec.brandLabel ?? 'IL RE DEL BORSELLO', 1100);
        }
      }
      // Track winding-up attacks for the pre-emptive dodge rule (>=3 threats).
      if (attack.time < spec.windup) {
        telegraphCount += 1;
        if (player) {
          const d = Math.hypot(enemy.posX - player.posX, enemy.posZ - player.posZ);
          if (d < nearestThreatDist) {
            nearestThreatDist = d;
            nearestThreatX = enemy.posX;
            nearestThreatZ = enemy.posZ;
          }
        }
      }
      if (spec.aoe) {
        const activeStart = spec.windup;
        if (attack.time >= activeStart && attack.time - dt < activeStart) {
          this.effects.spawnRing(enemy.pos, '#ff5b3d', (spec.aoeRadius ?? 3.5) * 1.8, 0.5);
          this.effects.spawnSparks(enemy.pos, '#ffb04a', 22, 1.8);
          this.cameraRig.addShake(0.35);
        }
      }
    }
    if (player) player.setThreat(telegraphCount, nearestThreatX, nearestThreatZ);
  }

  private updatePickups(dt: number): void {
    let nearest: Pickup | null = null;
    let nearestDistance = 1.8;
    for (const pickup of this.pickups) {
      if (pickup.collected) continue;
      pickup.update(dt);
      if (!this.player) continue;
      const distance = Math.hypot(pickup.position.x - this.player.posX, pickup.position.z - this.player.posZ);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = pickup;
      }
    }
    this.interactionTarget = nearest;
    this.ui.setPickupPrompt(nearest !== null && this.player?.alive === true);
    for (const pickup of this.pickups) {
      if (pickup.expired || pickup.collected) {
        pickup.dispose();
      }
    }
    this.pickups = this.pickups.filter((pickup) => !pickup.expired && !pickup.collected);
  }

  private tryCollectPickup(): void {
    const pickup = this.interactionTarget;
    const player = this.player;
    if (!pickup || !player || pickup.collected) return;
    const distance = Math.hypot(pickup.position.x - player.posX, pickup.position.z - player.posZ);
    if (distance > 2) return;
    pickup.collect();
    player.heal(pickup.heal);
    this.audio.playSfx('pickup');
    this.ui.spawnDamage(new THREE.Vector3(player.posX, 1.8, player.posZ), this.renderer.camera, `+${pickup.heal}`, 'heal');
    this.effects.spawnRing(pickup.position, '#6dff9e', 1.5, 0.4);
    this.effects.spawnSparks(pickup.position, '#9dffb8', 10, 0.8);
    this.ui.setPickupPrompt(false);
    this.interactionTarget = null;
  }

  // ── Outcome screens ─────────────────────────────────────────────────
  private completeLevel(): void {
    if (this.state !== 'playing' || this.levelCompleteShown) return;
    this.levelCompleteShown = true;
    const hpRatio = (this.player?.hp ?? 0) / Math.max(1, this.player?.maxHp ?? 1);
    const clearBonus = 2000 * this.config.number + Math.round(hpRatio * 1200);
    this.score += clearBonus;
    const previousBest = this.save.get().bestScore;
    const stars = 1 + (hpRatio > 0.55 ? 1 : 0) + (this.levelClock < 150 ? 1 : 0);
    this.save.recordLevelComplete(this.config.id, this.score, stars);
    this.save.recordScore(this.score);
    this.state = 'results';
    this.player?.playVictory();
    this.input.setEnabled(false);
    this.ui.setControlsActive(false);
    this.ui.setPickupPrompt(false);
    this.audio.stopMusic();
    this.audio.playSfx('levelComplete');
    this.audio.setPaused(false);
    const result: LevelResult = {
      levelNumber: this.config.number,
      levelName: this.config.name,
      score: this.score,
      bestCombo: this.levelBestCombo,
      kos: this.levelKos,
      timeSeconds: this.levelClock,
      stars,
      note: 'Piazza ripulita. I panini sono al sicuro.',
      newBest: this.score > previousBest,
    };
    this.ui.showLevelComplete(result);
    this.cameraRig.setMode('orbit', {
      center: new THREE.Vector3(this.player?.pos.x ?? 0, 1.3, this.player?.pos.z ?? 0),
      radius: 5.4,
      height: 2.8,
      speed: 0.12,
      startAngle: 0.4,
    });
  }

  private showGameOver(): void {
    if (this.gameOverShown || this.state !== 'playing') return;
    this.gameOverShown = true;
    this.state = 'results';
    const previousBest = this.save.get().bestScore;
    this.save.recordScore(this.score);
    this.input.setEnabled(false);
    this.ui.setControlsActive(false);
    this.audio.stopMusic();
    this.audio.playSfx('gameOver');
    this.cameraRig.setMode('frozen');
    this.ui.showGameOver({ score: this.score, wave: (this.waves?.waveNumber ?? 1), newBest: this.score > previousBest });
  }

  private showVictory(): void {
    if (this.victoryShown || this.state !== 'playing') return;
    this.victoryShown = true;
    this.state = 'results';
    const previousBest = this.save.get().bestScore;
    this.save.recordLevelComplete(this.config.id, this.score, 3);
    this.save.recordScore(this.score);
    this.input.setEnabled(false);
    this.ui.setControlsActive(false);
    this.ui.bossIntro(false);
    this.audio.stopMusic();
    this.audio.playSfx('victory');
    this.ui.showVictory({
      score: this.score,
      bestCombo: this.bestCombo,
      kos: this.totalKos,
      timeSeconds: this.runClock,
      newBest: this.score > previousBest,
    });
    this.cameraRig.setMode('orbit', {
      center: new THREE.Vector3(this.player?.pos.x ?? 0, 1.3, this.player?.pos.z ?? 0),
      radius: 6.2,
      height: 3.1,
      speed: 0.14,
      startAngle: 0.4,
    });
  }

  private nextLevel(): void {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.showVictory();
      return;
    }
    this.startLevel(this.levelIndex + 1, this.score);
    this.requestPointerLock();
  }

  private retryLevel(): void {
    this.audio.unlock();
    if (this.zombies) {
      this.startZombies(this.lastZombiesMode, false);
      return;
    }
    this.startLevel(this.levelIndex, this.levelStartScore);
    this.requestPointerLock();
  }

  private returnToMenu(): void {
    this.save.recordScore(this.score);
    this.cleanupActors();
    if (this.zombies) {
      this.zombies.checkpoint();
      this.zombies.dispose();
      this.zombies = null;
    }
    this.input.setShooterMode(false);
    this.input.setEnabled(false);
    this.ui.setPickupPrompt(false);
    this.ui.bossIntro(false);
    this.audio.stopMusic();
    this.loadMenuScene();
    this.audio.setPaused(false);
    this.loop.setPaused(false);
    this.ui.showMenu();
    this.ui.refreshMenu(this.continueLabel());
  }

  private togglePause(): void {
    if (this.state === 'playing') {
      if (this.bossIntroActive) return;
      this.pauseGame();
    } else if (this.state === 'paused') {
      this.resumeGame();
    }
  }

  private pauseGame(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.loop.setPaused(true);
    this.input.clearTransient();
    this.input.setEnabled(false);
    this.audio.setPaused(true);
    this.zombies?.pause();
    this.ui.showPause();
    this.ui.setPickupPrompt(false);
    this.ui.setControlsActive(false);
  }

  private resumeGame(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.loop.setPaused(false);
    this.input.setEnabled(true);
    this.audio.unlock();
    this.audio.setPaused(false);
    this.zombies?.resume();
    this.ui.hidePause();
    this.ui.setControlsActive(!this.bossIntroActive);
    this.input.clearTransient();
    this.requestPointerLock();
  }

  private handleWipeSave(): void {
    this.save.reset();
    this.applySettings(this.save.getSettings());
    this.ui.setSaveStatus('Salvataggi cancellati. Si riparte dal primo maranza.');
    this.ui.showMenu();
    this.ui.refreshMenu(this.continueLabel());
    this.audio.playSfx('ui');
  }

  private requestPointerLock(): void {
    if (!this.input.touch.isTouchDevice) {
      this.input.requestPointerLock();
    }
  }

  // ── Settings ────────────────────────────────────────────────────────
  private applySettings(settings: Settings): void {
    this.renderer.applyQuality(settings.quality);
    this.effects.setDensity(QUALITY_PROFILES[settings.quality].particleDensity);
    this.levels.setQuality(settings.quality);
    this.audio.setSettings(settings);
    this.cameraRig.sensitivity = settings.sensitivity / 100;
    this.cameraRig.invertY = settings.invertY;
    this.cameraRig.shakeEnabled = settings.shake;
    this.cameraRig.setBaseFov(QUALITY_PROFILES[settings.quality].fov);
    this.input.setDeadzone(settings.deadzone);
  }

  // ── Rendering ───────────────────────────────────────────────────────
  private render(dt: number, alpha: number): void {
    if (this.captureMode) {
      this.renderer.render();
      return;
    }

    if (this.state === 'menu') {
      this.input.consumeLook();
      this.cameraRig.update(dt);
      this.levels.followSky(this.renderer.camera.position);
      this.updateActorsVisual(dt, 1, false);
      this.effects.update(dt);
      this.renderer.render();
      return;
    }

    if (this.state === 'boot') return;

    const look = this.input.consumeLook();
    if (this.state === 'playing') {
      this.cameraRig.addLook(look.x, look.y);
      this.cameraRig.update(dt);
    } else if (this.state === 'paused') {
      this.cameraRig.update(0);
    } else if (this.state === 'results') {
      this.cameraRig.update(dt);
    }

    const frozen = this.hitstop > 0 || this.state === 'paused';
    if (this.zombies) {
      this.zombies.followSky(this.renderer.camera.position);
      this.zombies.updateVisual(dt, alpha, frozen);
      this.effects.update(this.state === 'paused' ? 0 : dt);
      this.renderer.render();
      this.zombies.updateHud();
      return;
    }
    this.levels.followSky(this.renderer.camera.position);
    this.updateActorsVisual(dt, alpha, frozen);
    this.effects.update(this.state === 'paused' ? 0 : dt);
    this.renderer.render();
    this.updateHud();
  }

  private updateActorsVisual(dt: number, alpha: number, frozen: boolean): void {
    this.player?.updateVisual(dt, alpha, frozen);
    for (const enemy of this.enemies) {
      enemy.updateVisual(dt, alpha, frozen);
    }
  }

  private updateHud(): void {
    const player = this.player;
    const waves = this.waves;
    const levelStarted = Boolean(waves?.started);
    const waveNumber = waves ? (levelStarted ? waves.waveNumber : 1) : 1;
    const waveTotal = waves?.waveTotal ?? this.config.waves.length;
    const remaining = waves?.remainingInWave ?? 0;
    const waveDef = waves?.currentWave ?? this.config.waves[0];
    const totalInWave = waveDef?.spawns.reduce((sum, spawn) => sum + spawn.count, 0) ?? 0;
    const waveProgress = totalInWave > 0 ? Math.min(1, 1 - remaining / totalInWave) : 0;
    const boss = this.boss;

    const model: HudModel = {
      hp: player?.hp ?? 0,
      maxHp: player?.maxHp ?? 1,
      energy: player?.energy ?? 0,
      maxEnergy: player?.maxEnergy ?? 1,
      score: this.score,
      best: Math.max(this.save.get().bestScore, this.score),
      levelName: this.config.name,
      waveNumber,
      waveTotal,
      enemiesRemaining: remaining,
      waveProgress: this.awaitingNextWave ? 1 : waveProgress,
      comboCount: this.combo.count,
      comboMultiplier: this.combo.multiplier,
      comboActive: this.combo.active,
      specialReady: player?.specialReady ?? false,
      dodgeRatio: player?.dodgeReady ?? 1,
      bossActive: this.bossActive && boss !== null,
      bossHp: boss?.hp ?? 0,
      bossMaxHp: boss?.maxHp ?? 1,
      bossName: this.config.bossName ?? 'IL RE DEL BORSELLO',
      bossPhaseLabel: boss?.phaseLabel ?? 'FASE I — TRUCCIDERO',
    };
    this.ui.updateHud(model);
  }

  // ── Environment listeners ──────────────────────────────────────────
  private bindEnvironment(): void {
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        this.input.clearTransient();
        this.audio.setPaused(true);
        if (this.state === 'playing') this.pauseGame();
      } else {
        this.audio.setPaused(this.state === 'paused');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.unsubscribers.push(() => document.removeEventListener('visibilitychange', onVisibility));

    const onBlur = (): void => {
      this.input.clearTransient();
    };
    window.addEventListener('blur', onBlur);
    this.unsubscribers.push(() => window.removeEventListener('blur', onBlur));
  }

  // ── Debug / tests ──────────────────────────────────────────────────
  /**
   * Renders a single level from its cinematic preview camera with every
   * overlay hidden. Used by scripts/capture-previews.mjs for the level cards.
   */
  captureLevel(index: number): void {
    this.captureMode = true;
    this.cleanupActors();
    this.effects.clear();
    this.audio.setPaused(true);
    this.levels.setQuality(this.save.getSettings().quality);
    this.levels.load(Math.max(0, Math.min(LEVELS.length - 1, index)));
    const arena = this.levels.current?.arena;
    if (!arena) return;
    document.body.classList.add('is-capture');
    for (const screen of document.querySelectorAll<HTMLElement>('.screen')) {
      screen.classList.remove('is-active');
    }
    const camera = this.renderer.camera;
    camera.position.copy(arena.preview.position);
    camera.lookAt(arena.preview.lookAt);
    camera.updateProjectionMatrix();
    this.state = 'menu';
    this.loop.setPaused(false);
    const ready = (): void => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          (window as unknown as Record<string, unknown>).__MARANZA_CAPTURE_READY__ = true;
        });
      });
    };
    ready();
  }

  debugSnapshot(): Record<string, unknown> {
    if (this.zombies) {
      return {
        ...this.zombies.debugSnapshot(),
        state: this.state,
        touchDevice: this.input.touch.isTouchDevice,
        hudVisible: document.getElementById('zombies-hud')?.classList.contains('is-active') ?? false,
        fps: Math.round(this.loop.fps),
        drawCalls: this.renderer.drawCalls,
        triangles: this.renderer.triangles,
        screen: this.ui.current,
        paused: this.state === 'paused',
        camYaw: Number(this.cameraRig.yaw.toFixed(3)),
        camPitch: Number(this.cameraRig.pitch.toFixed(3)),
        camDist: this.cameraRig.distance,
      };
    }
    const player = this.player;
    return {
      state: this.state,
      menu: this.menuMode,
      started: this.debugInfo.started,
      level: this.levelIndex + 1,
      levelCount: LEVELS.length,
      levelName: this.config.name,
      slowmo: Number(this.slowmo.toFixed(2)),
      wave: this.waves?.waveNumber ?? 0,
      waveTotal: this.waves?.waveTotal ?? 0,
      enemies: this.enemies.map((enemy) => ({
        kind: enemy.archetype.kind,
        hp: Math.round(enemy.hp),
        alive: enemy.alive,
        x: Number(enemy.posX.toFixed(2)),
        z: Number(enemy.posZ.toFixed(2)),
      })),
      enemyCount: this.enemies.filter((enemy) => enemy.alive).length,
      hp: player ? Math.round(player.hp) : 0,
      energy: player ? Math.round(player.energy) : 0,
      score: this.score,
      combo: this.combo.count,
      attack: player?.attack?.spec.id ?? null,
      lastAttack: player?.lastAttackId ?? -1,
      playerX: player ? Number(player.posX.toFixed(2)) : 0,
      playerZ: player ? Number(player.posZ.toFixed(2)) : 0,
      playerAlive: player?.alive ?? false,
      bossActive: this.bossActive,
      bossHp: this.boss ? Math.round(this.boss.hp) : 0,
      fps: Math.round(this.loop.fps),
      drawCalls: this.renderer.drawCalls,
      triangles: this.renderer.triangles,
      rapierReady: this.physics.isReady,
      touchDevice: this.input.touch.isTouchDevice,
      touchMove: [Number(this.input.touch.moveX.toFixed(2)), Number(this.input.touch.moveY.toFixed(2))],
      cameraYaw: Number(this.cameraRig.yaw.toFixed(3)),
      screen: this.ui.current,
      hudVisible: document.getElementById('hud')?.classList.contains('is-active') ?? false,
      canvasSize: [this.renderer.renderer.domElement.width, this.renderer.renderer.domElement.height],
      paused: this.state === 'paused',
      pointerLocked: this.input.pointerLocked,
      pickups: this.pickups.filter((pickup) => !pickup.collected).length,
      hitstop: Number(this.hitstop.toFixed(3)),
      levelTime: Number(this.levelClock.toFixed(1)),
    };
  }

  debugSpawnEnemy(kind: EnemyKind = 'base'): void {
    if (this.state !== 'playing' || !this.player) return;
    if (kind === 'boss') {
      this.spawnBoss();
      return;
    }
    const archetype = ENEMY_ARCHETYPES[kind];
    const player = this.player;
    const x = player.posX + player.forwardX * 1.75;
    const z = player.posZ + player.forwardZ * 1.75;
    const enemy = new Enemy(
      this.physics,
      this.factory,
      this.combat,
      this.director,
      archetype,
      new THREE.Vector3(x, 0, z),
      { hp: this.config.hpScale, damage: this.config.damageScale },
      0,
    );
    enemy.isDebug = true;
    enemy.attackCooldown = 999;
    enemy.speedMultiplier = 0;
    enemy.setYaw(Math.atan2(player.posX - x, player.posZ - z));
    enemy.addToScene(this.renderer.scene);
    this.enemies.push(enemy);
    this.effects.spawnRing(new THREE.Vector3(x, 0, z), '#ff2f2f', 1.2, 0.3);
  }

  /** Test hook: defeats every enemy on screen through the normal hit path. */
  debugClearWave(): void {
    const player = this.player;
    if (!player || this.state !== 'playing') return;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const info: HitInfo = {
        damage: enemy.hp + 1,
        dirX: 0,
        dirZ: 1,
        knockback: 0,
        hitstun: 0.2,
        hitstop: 0,
        heavy: true,
        specId: 'debug',
        fromX: player.posX,
        fromZ: player.posZ,
      };
      enemy.applyHit(info, player);
      this.handleDamage(player, enemy, info, PLAYER_KICK);
    }
  }

  /** Test hook: jumps straight into a campaign level (1-based). */
  debugJumpToLevel(number: number): void {
    const index = Math.max(0, Math.min(LEVELS.length - 1, Math.round(number) - 1));
    this.startLevel(index, 0);
  }

  /** Test hook: hurts the player through the same path enemy hits use. */
  debugDamagePlayer(amount = 999): void {
    const player = this.player;
    if (!player || !player.alive) return;
    player.applyHit(
      {
        damage: amount,
        dirX: 0,
        dirZ: 1,
        knockback: 0,
        hitstun: 0.1,
        hitstop: 0,
        heavy: false,
        specId: 'debug',
        fromX: player.posX,
        fromZ: player.posZ + 1,
      },
      player,
    );
  }

  debugTeleportPlayer(x: number, z: number): void {
    this.player?.body.teleport(x, 0, z);
    this.player?.syncFromPhysics();
  }

  debugSetPlayerYaw(yaw: number): void {
    this.player?.setYaw(yaw);
  }

  getState(): GameState {
    return this.state;
  }

  returnToMenuPublic(): void {
    this.returnToMenu();
  }

  setInstallTrigger(trigger: () => void): void {
    this.ui.setInstallAvailable(true, trigger);
  }

  // ── Zombies test hooks ───────────────────────────────────────────────
  debugStartZombies(mode: ZombiesRunMode = 'infinite'): void {
    this.startZombies(mode, false);
  }

  debugStartZombiesRound(round: number): void {
    this.zombies?.debugStartRound(round);
  }

  debugZombiesClear(): void {
    this.zombies?.debugClearZombies();
  }

  debugZombiesCompleteRound(): void {
    this.zombies?.debugCompleteRound();
  }

  debugZombiesPoints(amount: number): void {
    this.zombies?.debugAddPoints(amount);
  }

  debugZombiesOpenDoors(): void {
    this.zombies?.debugOpenAllDoors();
  }

  debugZombiesHurt(amount: number): void {
    this.zombies?.debugHurt(amount);
  }

  debugZombiesTeleport(x: number, z: number): void {
    this.zombies?.debugTeleport(x, z);
  }

  debugZombiesAim(x: number, z: number): void {
    this.zombies?.debugAim(x, z);
  }

  debugZombiesBreakWindow(): string | null {
    return this.zombies?.debugBreakWindow() ?? null;
  }

  debugZombiesSpawn(kind: string = 'walker'): void {
    this.zombies?.debugSpawnZombie(kind as never);
  }

  /** Reports basic render state for a few named scene objects. */
  debugSceneInfo(): Record<string, unknown> {
    const info: Record<string, unknown> = {};
    this.renderer.scene.traverse((object) => {
      if (object.name === 'sky-dome') {
        const material = (object as THREE.Mesh).material as THREE.ShaderMaterial;
        info.sky = {
          renderOrder: object.renderOrder,
          depthWrite: material.depthWrite,
          depthTest: material.depthTest,
          transparent: material.transparent,
          side: material.side,
          visible: object.visible,
        };
      }
      if (object.type === 'Points') {
        info.stars = { count: (object as THREE.Points).geometry.getAttribute('position')?.count ?? 0, renderOrder: object.renderOrder, visible: object.visible };
      }
    });
    return info;
  }

  /** Toggles named scene objects for visual diagnosis. */
  debugSetVisible(name: string, visible: boolean): void {
    this.renderer.scene.traverse((object) => {
      if (object.name === name) object.visible = visible;
    });
  }

  dispose(): void {
    this.zombies?.dispose();
    this.zombies = null;
    this.loop.stop();
    this.input.detach();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.cleanupActors();
    this.effects.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    this.factory.dispose();
  }
}
