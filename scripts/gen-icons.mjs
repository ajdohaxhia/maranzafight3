import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const outputDir = new URL('../public/icons/', import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

async function render(size, path, { maskable = false } = {}) {
  const padding = maskable ? size * 0.1 : 0;
  const inner = size - padding * 2;
  const background = maskable ? '#08080a' : 'transparent';
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:${background};overflow:hidden}
      .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center}
      svg{width:${inner}px;height:${inner}px;display:block}
    </style></head><body><div class="wrap">${svg}</div></body></html>`,
  );
  await page.screenshot({
    path,
    clip: { x: 0, y: 0, width: size, height: size },
    omitBackground: !maskable,
  });
}

await render(192, new URL('icon-192.png', outputDir).pathname);
await render(512, new URL('icon-512.png', outputDir).pathname);
await render(512, new URL('icon-maskable-512.png', outputDir).pathname, { maskable: true });
await render(180, new URL('apple-touch-icon.png', outputDir).pathname);

await browser.close();
console.log('Icons generated in public/icons/');
