#!/usr/bin/env node
/**
 * Renders the level-select artwork from the real game arenas.
 *
 * Starts a throwaway Vite dev server, loads /?capture=N for every level and
 * saves a 16:9 screenshot of the game canvas to public/previews/level-N.jpg.
 * Run after changing an arena:  node scripts/capture-previews.mjs
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { chromium } from '@playwright/test';

const PORT = Number(process.env.CAPTURE_PORT ?? 5199);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const LEVELS = 9;
const VIEWPORT = { width: 1200, height: 675 };

async function waitForServer(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Dev server did not answer on ${url}`);
}

const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let viteLog = '';
vite.stdout.on('data', (chunk) => {
  viteLog += chunk.toString();
});
vite.stderr.on('data', (chunk) => {
  viteLog += chunk.toString();
});

const cleanup = () => {
  if (!vite.killed) vite.kill('SIGTERM');
};

try {
  await waitForServer(ORIGIN);
  await mkdir(new URL('../public/previews', import.meta.url), { recursive: true });

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

  for (let level = 1; level <= LEVELS; level++) {
    await page.goto(`${ORIGIN}/?capture=${level}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__MARANZA_CAPTURE_READY__ === true, undefined, {
      timeout: 90_000,
    });
    // Let the render loop draw a few frames and the water/boats settle.
    await page.waitForTimeout(900);
    const buffer = await page.locator('#game-canvas').screenshot({
      type: 'jpeg',
      quality: 82,
    });
    await writeFile(new URL(`../public/previews/level-${level}.jpg`, import.meta.url), buffer);
    console.log(`captured level ${level} (${Math.round(buffer.byteLength / 1024)} kB)`);
  }

  await browser.close();
} catch (error) {
  console.error(viteLog.split('\n').slice(-25).join('\n'));
  console.error(error);
  process.exitCode = 1;
} finally {
  cleanup();
}

// Give the child a moment to exit before the process ends.
await Promise.race([once(vite, 'exit'), new Promise((resolve) => setTimeout(resolve, 1500))]);
