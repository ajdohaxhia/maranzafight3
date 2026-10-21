import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();
await page.goto(url);
await page.waitForFunction(() => Boolean(window.__MARANZA__), undefined, { timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'screenshots/mobile-menu.png' });

await page.locator('#btn-play').tap();
await page.waitForTimeout(3200);
await page.screenshot({ path: 'screenshots/mobile-play.png' });

const state = await page.evaluate(() => window.__MARANZA__.snapshot);
console.log(JSON.stringify({ touch: state.touchDevice, state: state.state, hud: state.hudVisible, fps: state.fps }));

await browser.close();
