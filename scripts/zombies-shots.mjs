import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto(url);
await page.waitForFunction(() => Boolean(window.__MARANZA__), undefined, { timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'screenshots/mobile-menu.png' });

await page.locator('#btn-zombies').tap();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/mobile-zombies-briefing.png' });
await page.locator('[data-zmode="infinite"]').tap();
await page.waitForFunction(() => window.__MARANZA__.snapshot.mode === 'zombies', undefined, { timeout: 30000 });
await page.waitForTimeout(1400);
await page.screenshot({ path: 'screenshots/mobile-zombies.png' });
await page.waitForFunction(() => window.__MARANZA__.snapshot.phase === 'round', undefined, { timeout: 30000 });

// Fire at the closest non-dead zombie with the real FUOCO button.
let shots = 0;
for (let attempt = 0; attempt < 60; attempt++) {
  const target = await page.evaluate(() => {
    const snap = window.__MARANZA__.snapshot;
    const alive = snap.zombiesAt.filter((entry) => entry[2] !== 'dead');
    if (alive.length === 0) return null;
    alive.sort(
      (a, b) =>
        Math.hypot(a[0] - snap.playerX, a[1] - snap.playerZ) -
        Math.hypot(b[0] - snap.playerX, b[1] - snap.playerZ),
    );
    window.__MARANZA__.zombiesAim(alive[0][0], alive[0][1]);
    return { x: alive[0][0], z: alive[0][1], hp: snap.hp, phase: snap.phase };
  });
  if (!target) {
    await page.waitForTimeout(250);
    continue;
  }
  await page.waitForTimeout(100);
  await page.locator('.tbtn--fire').tap();
  shots += 1;
  await page.waitForTimeout(240);
  const state = await page.evaluate(() => window.__MARANZA__.snapshot);
  if (shots >= 16 || state.phase !== 'round' || state.hp <= 0 || state.kills > 0) break;
}

await page.screenshot({ path: 'screenshots/mobile-zombies-combat.png' });

const layout = await page.evaluate(() => {
  const rect = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, w: box.width, h: box.height };
  };
  const overlap = (a, b) => {
    if (!a || !b) return false;
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  };
  const weapon = rect('.zhud__weapon');
  const stick = rect('.stick');
  const fire = rect('.tbtn--fire');
  return { weapon, stick, fire, weaponHitsStick: overlap(weapon, stick), weaponHitsFire: overlap(weapon, fire) };
});

const state = await page.evaluate(() => {
  const snapshot = window.__MARANZA__.snapshot;
  return {
    touch: document.body.classList.contains('is-touch'),
    mode: snapshot.mode,
    phase: snapshot.phase,
    round: snapshot.round,
    kills: snapshot.kills,
    points: snapshot.points,
    hp: snapshot.hp,
    mag: snapshot.mag,
    hud: document.getElementById('zombies-hud')?.classList.contains('is-active') ?? false,
    fireVisible: getComputedStyle(document.querySelector('.tbtn--fire')).display !== 'none',
    stickVisible: getComputedStyle(document.querySelector('.stick')).display !== 'none',
  };
});

console.log(JSON.stringify({ state, shots, layout, errors }, null, 2));
await browser.close();
if (errors.length > 0) process.exitCode = 1;
