import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = 'artifacts/identity-study';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
async function pixels(page) {
  return page.locator('#hero-canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    const rgba = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    let visible = 0, hash = 0;
    for (let i = 0; i < rgba.length; i += 16) {
      if (rgba[i + 3] > 20 && rgba[i + 1] > 20) visible++;
      hash = ((hash * 31) ^ rgba[i] ^ (rgba[i + 1] << 8)) | 0;
    }
    return { visible, hash };
  });
}
try {
  for (const [name, width, height] of [['wide', 1900, 1000], ['desktop', 1440, 1000], ['mobile', 390, 844], ['compact', 320, 640], ['tablet', 768, 1024]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const requests = [], errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4175/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().ready, null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    if (width > 900) await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().motionSource === 'video' && window.__portfolioScene.getDiagnostics().videoTime > .2, null, { timeout: 45000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const state = await page.evaluate(() => window.__portfolioScene.getDiagnostics());
    assert.equal(state.source, '/portrait-fallback.png');
    assert.equal(state.videoSource, '/portrait-typing.mp4');
    assert.equal(state.motionSource, width > 900 ? 'video' : 'image', 'Desktop uses owned typing footage; mobile retains the lighter poster');
    assert.equal(requests.some(url => url.includes('/__reference-study/')), false);
    assert.equal(await page.locator('.hero').getAttribute('data-identity'), 'saleem');
    const portrait = await pixels(page);
    assert.ok(portrait.visible > 1000, `${name}: portrait is visible`);
    const projectedHairTop = state.imageFraming.top + state.imageFraming.height * 80 / 1280;
    const headerBottom = await page.locator('.site-header').evaluate(element => element.getBoundingClientRect().bottom);
    assert.ok(projectedHairTop > headerBottom + 20, `${name}: portrait clears the header`);
    if (width > 900) assert.ok(state.imageFraming.left + state.imageFraming.width * .83 <= state.size.width - 23, `${name}: complete face stays within the viewport`);
    if (width <= 900) {
      const frames = state.renderedFrames;
      await page.waitForTimeout(700);
      assert.ok(await page.evaluate(() => window.__portfolioScene.getDiagnostics().renderedFrames) <= frames + 2, 'Mobile portrait does not idle-render');
    } else {
      const interactionFrame = await page.evaluate(() => {
        const frames = window.__portfolioScene.getDiagnostics().renderedFrames;
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth * .86, clientY: 390, pointerType: 'mouse' }));
        return frames;
      });
      await page.waitForFunction(frames => window.__portfolioScene.getDiagnostics().renderedFrames > frames + 4, interactionFrame, { timeout: 45000 });
      assert.notEqual((await pixels(page)).hash, portrait.hash, 'Owned portrait reacts through WebGL');
    }
    await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const frozen = await pixels(page);
    await page.waitForTimeout(400);
    assert.equal((await pixels(page)).hash, frozen.hash, 'Pause freezes the portrait effects');
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${output}/${name}-personalized.png`, timeout: 90000 });
    if (name === 'desktop') {
      await page.getByRole('button', { name: 'Play animation', exact: true }).click();
      await page.locator('[data-mode="security"]').click();
      await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().modeBlend > .95, null, { timeout: 45000 });
      assert.notEqual((await pixels(page)).hash, frozen.hash, 'Scan mode remains functional');
      await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${output}/desktop-scan.png`, timeout: 90000 });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(errors.length, 0, errors.join('; '));
    results.push({ name, state, projectedHairTop, headerBottom, portrait, errors });
    console.log(`${name}: personalized identity, framing, effects, and pause passed`);
    await page.close();
  }
} finally {
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
