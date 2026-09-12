import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PNG } = require(process.env.PNGJS_MODULE || 'pngjs');
const output = 'artifacts/hover-experience';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:4175/';
function difference(first, second) {
  assert.equal(first.data.length, second.data.length);
  let changed = 0, visible = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    if (Math.max(first.data[i + 1], second.data[i + 1]) > 35) visible++;
    if (Math.abs(first.data[i + 1] - second.data[i + 1]) > 12) changed++;
  }
  return { changed, visible };
}
try {
  for (const width of [1440, 1900]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.__hoverVideos = [];
      const create = Document.prototype.createElement;
      Document.prototype.createElement = function (name, ...args) {
        const element = create.call(this, name, ...args);
        if (String(name).toLowerCase() === 'video') window.__hoverVideos.push(element);
        return element;
      };
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        return this.__hoverFrozen ? Promise.resolve() : play.call(this);
      };
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().motionSource === 'video', null, { timeout: 90000 });
    const state = () => page.evaluate(() => window.__portfolioScene.getDiagnostics());
    assert.equal((await state()).hoverEnabled, true);
    assert.equal((await state()).laptopEmblem, 'apple');
    await page.evaluate(async () => {
      const video = window.__hoverVideos[0];
      video.__hoverFrozen = true;
      video.pause();
      await new Promise(resolve => {
        video.addEventListener('seeked', resolve, { once: true });
        video.currentTime = 1;
      });
      window.__peakHoverEnergy = 0;
      window.addEventListener('pointermove', () => {
        window.__peakHoverEnergy = Math.max(window.__peakHoverEnergy, window.__portfolioScene.getDiagnostics().cursorField.energy);
      });
    });
    const capture = async name => {
      await page.screenshot({ path: `${output}/${width}-${name}.png`, timeout: 90000 });
      const data = await page.locator('#hero-canvas').evaluate(canvas => canvas.toDataURL());
      return PNG.sync.read(Buffer.from(data.split(',')[1], 'base64'));
    };
    await page.mouse.move(20, 160);
    await page.waitForTimeout(700);
    const before = await capture('rest');
    const canvas = await page.locator('#hero-canvas').boundingBox();
    const framing = (await state()).videoFraming;
    const head = { x: canvas.x + framing.left + framing.width * .56, y: canvas.y + framing.top + framing.height * .30 };
    await page.mouse.move(head.x - 60, head.y + 35, { steps: 12 });
    await page.mouse.move(head.x + 45, head.y - 30, { steps: 10 });
    // Software WebGL can delay CDP mouse steps; exercise a fast sweep in one browser task.
    await page.evaluate(({ x, y }) => {
      for (const offset of [-65, 0, 65]) window.dispatchEvent(new PointerEvent('pointermove', { clientX: x + offset, clientY: y, pointerType: 'mouse' }));
    }, head);
    await page.waitForTimeout(120);
    const hovered = await capture('face-hover');
    const comparison = difference(before, hovered);
    assert.ok(comparison.visible > 5000, 'Portrait is nonblank');
    assert.ok(comparison.changed > 1500, 'Hover changes visible portrait pixels while the typing frame is frozen');
    assert.ok(await page.evaluate(() => window.__peakHoverEnergy > .2), 'Pointer speed energizes the scan lines');
    assert.ok(Math.abs((await state()).videoTime - 1) < .001, 'Pixel changes are not caused by typing');

    await page.mouse.move(canvas.x + framing.left + framing.width * .30, canvas.y + framing.top + framing.height * .72, { steps: 12 });
    await capture('laptop-hover');
    await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
    await page.waitForTimeout(150);
    const paused = await capture('paused');
    await page.mouse.move(head.x, head.y, { steps: 10 });
    await page.waitForTimeout(200);
    const pausedData = await page.locator('#hero-canvas').evaluate(canvas => canvas.toDataURL());
    assert.equal(difference(paused, PNG.sync.read(Buffer.from(pausedData.split(',')[1], 'base64'))).changed, 0, 'Pause freezes hover');
    await page.getByRole('button', { name: 'Play animation', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().motionSource === 'image');
    assert.equal((await state()).hoverEnabled, false);
    assert.deepEqual((await state()).cursorField.pointer, [.5, .5]);
    await page.mouse.move(400, 500, { steps: 4 });
    assert.equal((await state()).cursorField.energy, 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().hoverEnabled);
    await page.evaluate(() => window.__portfolioScene.setScrollProgress(.7));
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().portraitPhase > 2, null, { timeout: 30000 });
    await capture('scroll-cloud');
    assert.deepEqual(errors, []);
    assert.equal((await state()).error, null);
    results.push({ width, comparison, hover: true, frozenMedia: true, pause: true, reducedMotion: true, scroll: true, errors });
    console.log(`${width}: frozen-frame hover, laptop, pause, reduced motion and scroll passed`);
    await page.close();
  }
  for (const width of [390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const before = await page.evaluate(() => window.__portfolioScene.getDiagnostics());
    assert.equal(before.hoverEnabled, false);
    assert.equal(before.motionSource, 'image');
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', clientX: 100, clientY: 450 })));
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__portfolioScene.getDiagnostics().cursorField.energy), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${output}/${width}-mobile.png`, timeout: 90000 });
    const pixels = await page.locator('#hero-canvas').evaluate(canvas => canvas.toDataURL());
    const png = PNG.sync.read(Buffer.from(pixels.split(',')[1], 'base64'));
    assert.ok(difference(png, png).visible > 5000, 'Mobile portrait is nonblank');
    assert.deepEqual(errors, []);
    results.push({ width, touchIgnoresHover: true, visible: true, overflow: false, errors });
    console.log(`${width}: touch fallback, visible portrait and layout passed`);
    await page.close();
  }
} finally {
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
