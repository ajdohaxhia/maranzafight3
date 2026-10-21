import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:4180/';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(url);
await page.waitForFunction(() => Boolean(window.__MARANZA__), undefined, { timeout: 60000 });
const registered = await page.evaluate(async () => {
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 15000));
  const registration = await Promise.race([navigator.serviceWorker.ready, timeout]);
  if (!registration) return { active: false, caches: [] };
  const names = await caches.keys();
  const entries = {};
  for (const name of names) {
    const cache = await caches.open(name);
    entries[name] = (await cache.keys()).length;
  }
  return { active: Boolean(registration.active), script: registration.active?.scriptURL ?? null, caches: entries };
});
const firstBoot = await page.evaluate(() => ({
  rapier: window.__MARANZA__.snapshot.rapierReady,
  state: window.__MARANZA__.snapshot.state,
}));

// Disable the HTTP cache so an offline success can only come from the service worker.
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await page.waitForTimeout(1500);
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
let offline = { loaded: false, rapier: false, state: 'n/a' };
try {
  await page.waitForFunction(() => Boolean(window.__MARANZA__), undefined, { timeout: 30000 });
  const snap = await page.evaluate(() => window.__MARANZA__.snapshot);
  offline = { loaded: true, rapier: snap.rapierReady, state: snap.state };
} catch (error) {
  offline = { loaded: false, rapier: false, state: String(error).slice(0, 120) };
}
await context.setOffline(false);

console.log(JSON.stringify({ registered, firstBoot, offline, errors }, null, 2));
await browser.close();
