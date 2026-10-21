import { test, expect, type Page } from '@playwright/test';

interface Snapshot {
  state: string;
  level: number;
  levelName: string;
  wave: number;
  hp: number;
  score: number;
  attack: string | null;
  lastAttack: number;
  playerX: number;
  playerZ: number;
  playerAlive: boolean;
  rapierReady: boolean;
  touchDevice: boolean;
  touchMove: [number, number];
  cameraYaw: number;
  hudVisible: boolean;
  enemyCount: number;
  enemies: Array<{ kind: string; hp: number; alive: boolean; x: number; z: number }>;
  bossActive: boolean;
  bossHp: number;
  drawCalls: number;
  screen: string | null;
  levelCount: number;
}

declare global {
  interface Window {
    __MARANZA__: {
      version: string;
      readonly snapshot: Snapshot;
      spawnEnemy(kind: string): void;
      teleport(x: number, z: number): void;
      face(yaw: number): void;
      clearWave(): void;
      jumpToLevel(level: number): void;
      hurtPlayer(amount?: number): void;
      showMenu(): void;
    };
  }
}

const boot = async (page: Page): Promise<void> => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__MARANZA__), undefined, { timeout: 60_000 });
  await expect(page.locator('#screen-menu')).toHaveClass(/is-active/);
  (page as Page & { __errors?: string[] }).__errors = errors;
};

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => window.__MARANZA__.snapshot);

const startGame = async (page: Page): Promise<void> => {
  await page.locator('#btn-play').click();
  await page.waitForFunction(() => window.__MARANZA__.snapshot.state === 'playing', undefined, {
    timeout: 30_000,
  });
};

test.describe('MARANZA FIGHT 3', () => {
  test('boot carica la scena 3D e il motore fisico WASM', async ({ page }) => {
    await boot(page);
    const snap = await snapshot(page);
    expect(snap.rapierReady).toBe(true);
    const webgl = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2');
      return { hasContext: Boolean(gl), width: canvas.width, height: canvas.height };
    });
    expect(webgl.hasContext).toBe(true);
    expect(webgl.width).toBeGreaterThan(100);
    expect(webgl.width).toBeGreaterThan(100);
    expect((page as Page & { __errors?: string[] }).__errors ?? []).toEqual([]);
  });

  test('avvia la partita e mostra HUD, arena e ondate', async ({ page }) => {
    await boot(page);
    await startGame(page);
    const snap = await snapshot(page);
    expect(snap.state).toBe('playing');
    expect(snap.hudVisible).toBe(true);
    expect(snap.level).toBe(1);
    expect(snap.levelName).toBe('STAZIONE CENTRALE');
    // The first wave must start spawning on its own.
    await expect
      .poll(async () => (await snapshot(page)).enemies.length, { timeout: 20_000 })
      .toBeGreaterThan(0);
    const withEnemies = await snapshot(page);
    expect(withEnemies.drawCalls).toBeGreaterThan(20);
  });

  test('WASD muove il giocatore e il mouse ruota la telecamera', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Comandi da tastiera e mouse, non disponibili in emulazione mobile');
    await boot(page);
    await startGame(page);
    const before = await snapshot(page);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyW');
    const after = await snapshot(page);
    const moved = Math.hypot(after.playerX - before.playerX, after.playerZ - before.playerZ);
    expect(moved).toBeGreaterThan(0.6);

    const yawBefore = after.cameraYaw;
    await page.mouse.move(500, 400);
    await page.mouse.down();
    await page.mouse.move(760, 400, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const yawAfter = (await snapshot(page)).cameraYaw;
    expect(Math.abs(yawAfter - yawBefore)).toBeGreaterThan(0.05);
  });

  test('pugno a segno: danno, punteggio e combo', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Il tap touch e i click del mouse sono coperti dal test mobile dedicato');
    await boot(page);
    await startGame(page);
    await page.evaluate(() => window.__MARANZA__.spawnEnemy('base'));
    await page.waitForTimeout(400);
    const before = await snapshot(page);
    const target = before.enemies.find((enemy) => enemy.alive && enemy.kind === 'base');
    expect(target).toBeTruthy();
    await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      canvas.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 600, clientY: 400 }),
      );
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: 600, clientY: 400 }),
      );
    });
    await expect
      .poll(async () => {
        const snap = await snapshot(page);
        return (snap.enemies[snap.enemies.length - 1]?.hp ?? 99) < 46;
      }, { timeout: 5_000 })
      .toBe(true);
    const after = await snapshot(page);
    expect(after.score).toBeGreaterThan(0);
    expect((page as Page & { __errors?: string[] }).__errors ?? []).toEqual([]);
  });

  test('pausa e ripresa funzionano da tastiera', async ({ page }) => {
    await boot(page);
    await startGame(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#screen-pause')).toHaveClass(/is-active/);
    expect((await snapshot(page)).state).toBe('paused');
    await page.locator('#btn-resume').click();
    await expect(page.locator('#screen-pause')).not.toHaveClass(/is-active/);
    expect((await snapshot(page)).state).toBe('playing');
  });

  test('game over e riprova', async ({ page }) => {
    await boot(page);
    await startGame(page);
    // The level starts with a short invulnerability grace period.
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.__MARANZA__.hurtPlayer(999));
          return (await snapshot(page)).playerAlive;
        },
        { timeout: 20_000, intervals: [500] },
      )
      .toBe(false);
    await expect(page.locator('#screen-gameover')).toHaveClass(/is-active/, { timeout: 15_000 });
    await page.locator('#btn-retry').click();
    await page.waitForFunction(() => window.__MARANZA__.snapshot.state === 'playing');
    const snap = await snapshot(page);
    expect(snap.hp).toBeGreaterThan(0);
    expect(snap.playerAlive).toBe(true);
  });

  test('il boss compare e incassa i colpi', async ({ page }) => {
    await boot(page);
    await startGame(page);
    expect((await snapshot(page)).levelCount).toBe(9);
    await page.evaluate(() => window.__MARANZA__.jumpToLevel(4));
    await page.waitForFunction(() => window.__MARANZA__.snapshot.level === 4);
    await page.evaluate(() => window.__MARANZA__.spawnEnemy('boss'));
    await page.waitForFunction(() => window.__MARANZA__.snapshot.bossActive, undefined, { timeout: 20_000 });
    const intro = await snapshot(page);
    expect(intro.levelName).toBe('DUOMO SHOWDOWN');
    expect(intro.bossHp).toBeGreaterThan(100);
    await expect(page.locator('#boss-hud')).toHaveClass(/is-active/);
  });

  test('la selezione livelli mostra nove piazze in tre capitoli', async ({ page }) => {
    await boot(page);
    await page.locator('#btn-levels').click();
    await expect(page.locator('#screen-levels')).toHaveClass(/is-active/);
    await expect(page.locator('.level-card')).toHaveCount(9);
    await expect(page.locator('.level-card.is-locked')).toHaveCount(8);
    await expect(page.locator('.level-card__boss.is-chapter').first()).toContainText('CAP I');
    await expect(page.locator('#levels-progress')).toContainText('/ 9 LIVELLI');
    const art = page.locator('.level-card').first().locator('img');
    await expect(art).toHaveAttribute('src', /previews\/level-1\.jpg/);
    // A locked card must not start anything.
    await page.locator('.level-card').nth(7).click({ force: true });
    expect((await snapshot(page)).state).toBe('menu');
    await page.locator('.level-card').first().click();
    await page.waitForFunction(() => window.__MARANZA__.snapshot.state === 'playing');
    const snap = await snapshot(page);
    expect(snap.level).toBe(1);
    expect(snap.levelName).toBe('STAZIONE CENTRALE');
  });
});

test.describe('mobile portrait', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });

  test('invita a ruotare il telefono e permette di proseguire', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#screen-rotate')).toBeVisible();
    await page.locator('#btn-rotate-anyway').tap();
    await expect(page.locator('#screen-rotate')).toBeHidden();
    await expect(page.locator('#btn-play')).toBeVisible();
  });
});

test.describe('mobile touch', () => {
  test.use({
    viewport: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  test('joystick virtuale, pulsanti e camera multitouch', async ({ page }) => {
    await boot(page);
    await startGame(page);
    const snap = await snapshot(page);
    expect(snap.touchDevice).toBe(true);

    const stick = page.locator('#stick');
    await expect(stick).toBeVisible();
    const box = (await stick.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + box.width * 0.35, cy, { steps: 6 });
    await page.waitForTimeout(350);
    const moving = await snapshot(page);
    expect(Math.abs(moving.touchMove[0])).toBeGreaterThan(0.3);
    await page.mouse.up();
    await page.waitForTimeout(250);
    const released = await snapshot(page);
    expect(released.touchMove[0]).toBe(0);

    const before = await snapshot(page);
    await page.locator('.tbtn--punch').tap();
    // The punch window is short: poll the attack serial instead of sampling a
    // single frame, otherwise a slow SwiftShader frame can land after the hitbox.
    await expect
      .poll(async () => (await snapshot(page)).lastAttack, { timeout: 10_000, intervals: [80] })
      .not.toBe(before.lastAttack);
    const after = await snapshot(page);
    expect(after.playerAlive).toBe(true);

    // Camera drag on the empty part of the screen must rotate the view.
    const yawBefore = (await snapshot(page)).cameraYaw;
    await page.evaluate(async () => {
      const target = document.body;
      const fire = (type: string, x: number) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 42,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: 150,
            buttons: type === 'pointerup' ? 0 : 1,
          }),
        );
      fire('pointerdown', 800);
      for (let i = 1; i <= 8; i++) {
        fire('pointermove', 800 - i * 18);
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      fire('pointerup', 656);
    });
    await page.waitForTimeout(250);
    const yawAfter = (await snapshot(page)).cameraYaw;
    expect(Math.abs(yawAfter - yawBefore)).toBeGreaterThan(0.02);
  });
});
