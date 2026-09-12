import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = 'artifacts/travel-portrait';
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:4175/';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 640]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${url}#about`, { waitUntil: 'domcontentloaded' });
    const portrait = page.locator('#about .portrait img');
    await portrait.scrollIntoViewIfNeeded();
    await portrait.evaluate(image => image.decode());
    await page.evaluate(() => document.fonts.ready);
    const info = await portrait.evaluate(image => {
      const box = image.getBoundingClientRect(), frame = image.parentElement.getBoundingClientRect();
      return {
        src: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight,
        box: box.toJSON(), frame: frame.toJSON(),
        overflow: document.documentElement.scrollWidth > innerWidth,
        alt: image.alt,
      };
    });
    assert.ok(info.src.endsWith('/portrait-travel-waterfall.webp'));
    assert.equal(info.width, 1024);
    assert.equal(info.height, 1280);
    assert.ok(Math.abs(info.box.width / info.box.height - .8) < .005, 'The travel portrait is not stretched or cropped');
    assert.ok(info.box.left >= 0 && info.box.right <= width, 'Portrait fits the viewport');
    assert.equal(info.overflow, false);
    assert.ok(info.alt.includes('backpack'));
    assert.ok(await page.locator('.scene-fallback img').evaluate(image => new URL(image.src).pathname.endsWith('/portrait-fallback.png')), 'Hero portrait is unchanged');
    await page.locator('#about').screenshot({ path: `${output}/${width}-about.png`, timeout: 90000 });
    assert.deepEqual(errors, []);
    results.push({ width, height, ...info, errors });
    console.log(`${width}: travel photo loaded, full portrait crop and About layout passed`);
    await page.close();
  }
} finally {
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
