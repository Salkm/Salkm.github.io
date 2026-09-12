import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:4175/';
const output = process.env.QA_OUTPUT || 'artifacts/hover-study/verification';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const width of [1440, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Isolate pointer-driven pixels from movement already present in the video.
    await page.route('**/portrait-typing.mp4', route => route.abort());
    await page.goto(url);
    const state = () => page.evaluate(() => window.__portfolioScene.getDiagnostics());
    await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().ready && window.__portfolioScene.getDiagnostics().videoStatus === 'failed', null, { timeout: 90000 });
    const pixels = () => page.locator('#hero-canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      const data = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let hash = 2166136261, visible = 0;
      for (let i = 0; i < data.length; i += 4) {
        hash = Math.imul(hash ^ data[i + 1], 16777619);
        if (data[i + 1] > 30 && data[i + 3] > 0) visible++;
      }
      return { hash: hash >>> 0, visible };
    });
    await page.mouse.move(40, 160);
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().cursorField.pointer[0] < 0);
    await page.evaluate(() => window.__portfolioScene.setPaused(true));
    await page.waitForTimeout(150);
    const before = await pixels();
    assert.ok(before.visible > 20000, 'Portrait is visible');
    await page.screenshot({ path: `${output}/${width}-rest.png`, timeout: 90000 });
    const initial = await state();
    const bounds = await page.locator('#hero-canvas').boundingBox();
    const portrait = initial.imageFraming;
    const face = { x: bounds.x + portrait.left + portrait.width * .61, y: bounds.y + portrait.top + portrait.height * .27 };
    await page.mouse.move(face.x, face.y, { steps: 10 });
    assert.equal((await pixels()).hash, before.hash, 'Pause blocks hover animation');
    await page.evaluate(() => window.__portfolioScene.setPaused(false));
    await page.mouse.move(face.x - 100, face.y + 100);
    await page.mouse.move(face.x, face.y, { steps: 8 });
    const movementEnergy = await page.evaluate(({ x, y }) => {
      // Sample in the event turn, before a slow software-GPU frame can decay the impulse.
      for (const dx of [-160, 0]) window.dispatchEvent(new PointerEvent('pointermove', { clientX: x + dx, clientY: y, pointerType: 'mouse' }));
      return window.__portfolioScene.getDiagnostics().cursorField.energy;
    }, face);
    assert.ok(movementEnergy > .1, 'Movement energizes the field');
    const expected = [(face.x - bounds.x) / bounds.width, 1 - (face.y - bounds.y) / bounds.height];
    await page.waitForFunction(target => {
      const pointer = window.__portfolioScene.getDiagnostics().cursorField.pointer;
      return Math.hypot(pointer[0] - target[0], pointer[1] - target[1]) < .05;
    }, expected, { timeout: 30000 });
    const hovered = await pixels();
    assert.notEqual(hovered.hash, before.hash, 'Hover visibly changes the portrait canvas');
    await page.screenshot({ path: `${output}/${width}-hover.png`, timeout: 90000 });
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().cursorField.energy < .02, null, { timeout: 30000 });
    await page.screenshot({ path: `${output}/${width}-settled.png`, timeout: 90000 });
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().modeBlend > .95, null, { timeout: 30000 });
    await page.mouse.move(face.x - 150, face.y + 180, { steps: 8 });
    await page.screenshot({ path: `${output}/${width}-scan.png`, timeout: 90000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().reducedMotion);
    await page.waitForTimeout(150);
    const reduced = await pixels();
    await page.mouse.move(50, 200, { steps: 8 });
    assert.equal((await pixels()).hash, reduced.hash, 'Reduced motion stays static');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().mobile);
    await page.evaluate(() => window.__portfolioScene.setMode('automation'));
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().modeBlend < .001, null, { timeout: 30000 });
    await page.waitForTimeout(150);
    const mobile = await pixels();
    await page.mouse.move(350, 500, { steps: 10 });
    assert.equal((await pixels()).hash, mobile.hash, 'Mobile does not animate mouse hover');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    await page.screenshot({ path: `${output}/${width}-mobile.png`, timeout: 90000 });
    assert.equal((await state()).laptopEmblem, 'apple');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, visiblePixels: before.visible, hoverChangedPixels: before.hash !== hovered.hash, pause: 'passed', settle: 'passed', scan: 'passed', reducedMotion: 'passed', mobile: 'passed' }));
    await page.close();
  }
} finally {
  await browser.close();
}
