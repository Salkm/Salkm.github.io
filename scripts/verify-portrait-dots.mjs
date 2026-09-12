import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PNG } = require(process.env.PNGJS_MODULE || 'pngjs');
const output = 'artifacts/identity-study/dots';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
async function canvasPixels(page) {
  return page.locator('#hero-canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let visible = 0, hash = 0;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i + 1] > 30 && data[i + 3] > 15) visible++;
      hash = ((hash * 31) ^ data[i] ^ (data[i + 1] << 8) ^ data[i + 3]) | 0;
    }
    return { visible, hash };
  });
}
try {
  for (const [name, width, height] of [['wide', 1900, 1000], ['desktop', 1440, 1000], ['mobile', 390, 844], ['compact', 320, 640]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.goto(process.env.PORTFOLIO_URL || 'http://127.0.0.1:4175/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().ready, null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    if (width > 900) await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().motionSource === 'video', null, { timeout: 45000 });
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    const phases = [];
    for (const progress of [0, 1 / 3, 2 / 3, 1]) {
      await page.evaluate(progress => {
        if (window.__portfolioScene.getDiagnostics().paused) document.querySelector('.scene-toggle').click();
        scrollTo(0, Math.round(document.querySelector('.hero').offsetHeight * .65 * progress));
      }, progress);
      await page.waitForFunction(progress => Math.abs(window.__portfolioScene.getDiagnostics().renderedProgress - progress) < .002, progress, { timeout: 90000 });
      await page.evaluate(() => document.querySelector('.scene-toggle').click());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const state = await page.evaluate(() => window.__portfolioScene.getDiagnostics());
      assert.equal(state.source, '/portrait-fallback.png');
      assert.equal(state.motionSource, width > 900 ? 'video' : 'image');
      assert.equal(state.portraitPoints, 129600);
      assert.equal(state.scrollBehavior, 'four-state-dissolve');
      assert.ok(Math.abs(state.portraitPhase - progress * 3) < .01);
      const pixels = await canvasPixels(page);
      assert.ok(pixels.visible > 300, `${name}/${progress}: visible GPU portrait`);
      await page.waitForTimeout(150);
      assert.equal((await canvasPixels(page)).hash, pixels.hash, 'Pause freezes particles and dissolve');
      const screenshot = await page.screenshot({ path: `${output}/${name}-${Math.round(progress * 3)}.png`, timeout: 90000 });
      const png = PNG.sync.read(screenshot);
      let green = 0;
      for (let y = Math.round(height * .14); y < height * .6; y++) {
        for (let x = Math.round(width * .65); x < width; x++) {
          const i = (y * width + x) * 4;
          if (png.data[i + 1] > 25 && png.data[i + 1] > png.data[i] * 1.18 && png.data[i + 1] > png.data[i + 2] * 1.18) green++;
        }
      }
      assert.ok(green > (progress < .7 ? 500 : 70), `${name}/${progress}: portrait stays visible in actual scrolled viewport`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      phases.push({ progress, phase: state.portraitPhase, follow: state.scrollFollowPixels, green, pixels });
    }
    assert.equal(new Set(phases.map(x => x.pixels.hash)).size, 4, 'All four phases have different pixels');
    await page.evaluate(() => { document.querySelector('.scene-toggle').click(); scrollTo(0, 0); });
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().portraitPhase < .01, null, { timeout: 90000 });
    assert.ok((await canvasPixels(page)).visible > phases[3].pixels.visible, 'Scrolling back restores the portrait');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().reducedMotion);
    await page.evaluate(() => scrollTo(0, 240));
    await page.waitForTimeout(200);
    const reduced = await page.evaluate(() => window.__portfolioScene.getDiagnostics());
    assert.equal(reduced.portraitPhase, 0);
    assert.equal(reduced.scrollFollowPixels, 0);
    assert.equal(reduced.paused, true);
    assert.equal(requests.some(url => url.includes('/__reference-study/')), false);
    assert.deepEqual(errors, []);
    results.push({ name, phases, reducedMotionPassed: true, errors });
    console.log(`${name}: four states, real scroll visibility, pause, reverse scroll, and reduced motion passed`);
    await page.close();
  }
} finally {
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
