import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PNG } = require(process.env.PNGJS_MODULE || 'pngjs');
const output = 'artifacts/dither-comparison';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4175/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#page-field').dataset.ready === 'true');
    const dataUrl = await page.locator('#page-field').evaluate(canvas => canvas.toDataURL());
    const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
    await writeFile(`${output}/${name}-local.png`, bytes);
    const local = PNG.sync.read(bytes);
    const reference = PNG.sync.read(await readFile(`artifacts/reference-fields/${name}-dither.png`));
    assert.equal(local.width, reference.width);
    assert.equal(local.height, reference.height);
    let pixels = 0, shared = 0, error = 0, a = 0, b = 0, aa = 0, bb = 0, ab = 0;
    for (let i = 3; i < local.data.length; i += 4) {
      const first = reference.data[i], second = local.data[i];
      if (first === 0 && second === 0) continue;
      pixels++;
      if (first && second) shared++;
      error += Math.abs(first - second);
      a += first; b += second; aa += first * first; bb += second * second; ab += first * second;
    }
    const correlation = (ab - a * b / pixels) / Math.sqrt((aa - a * a / pixels) * (bb - b * b / pixels));
    const rgbaExact = reference.data.equals(local.data);
    assert.ok(pixels > 10000, 'Nonblank ordered dot field');
    assert.equal(rgbaExact, true, 'Calibrated dither raster matches the saved reference');
    await page.locator('#skills').evaluate(element => element.scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#page-field').evaluate(canvas => canvas.toDataURL()), dataUrl, 'Dither stays fixed on scroll');
    await page.screenshot({ path: `${output}/${name}-stack.png`, timeout: 60000 });
    assert.equal(errors.length, 0, errors.join('; '));
    reports.push({ name, pixels, rgbaExact, sharedPixelFraction: shared / pixels, alphaError: error / pixels, alphaCorrelation: correlation, errors });
    await page.close();
  }
} finally {
  await writeFile(`${output}/comparison.json`, JSON.stringify(reports, null, 2));
  await browser.close();
}
console.log(JSON.stringify(reports, null, 2));
