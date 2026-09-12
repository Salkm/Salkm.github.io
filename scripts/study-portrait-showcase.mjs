import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const output = 'artifacts/identity-study/showcase';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent('<style>body{margin:0;background:black}video{width:100vw;height:100vh;object-fit:contain}</style><video crossorigin="anonymous" muted playsinline preload="auto" src="https://assets.awwwards.com/awards/element/2026/08/6a7bdbcb2c526176332674.mp4"></video>');
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2, null, { timeout: 90000 });
  const metadata = await page.locator('video').evaluate(v => ({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }));
  console.log(metadata);
  const frames = [];
  for (let i = 0; i < 12; i++) {
    const time = Math.min(metadata.duration - .1, metadata.duration * i / 12 + .05);
    await page.locator('video').evaluate((v, time) => new Promise(resolve => {
      v.addEventListener('seeked', resolve, { once: true });
      v.currentTime = time;
    }), time);
    const path = `${output}/frame-${i}.png`;
    await page.screenshot({ path });
    frames.push({ path, time });
  }
  const tiles = [];
  for (let i = 0; i < frames.length; i++) tiles.push({ input: await sharp(frames[i].path).resize(640, 360).toBuffer(), left: (i % 3) * 640, top: Math.floor(i / 3) * 360 });
  await sharp({ create: { width: 1920, height: 1440, channels: 3, background: '#000' } }).composite(tiles).png().toFile(`${output}/contact-sheet.png`);
  await writeFile(`${output}/metadata.json`, JSON.stringify({ metadata, frames }, null, 2));
} finally { await browser.close(); }
