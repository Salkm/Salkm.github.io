import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:4175/';
const output = process.env.QA_OUTPUT || 'artifacts/laptop-emblem';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const state = () => page.evaluate(() => window.__portfolioScene.getDiagnostics());
  await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().motionSource === 'video', null, { timeout: 90000 });
  const first = await state();
  assert.equal(first.laptopEmblem, 'apple');
  await page.waitForFunction(frames => {
    const state = window.__portfolioScene.getDiagnostics();
    return state.videoTime > .25 && state.renderedFrames > frames + 2;
  }, first.renderedFrames);
  await page.evaluate(() => window.__portfolioScene.setPaused(true));
  const paused = await state();
  await page.waitForTimeout(250);
  assert.equal((await state()).videoTime, paused.videoTime);

  async function checkLogo(name) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const pixels = await page.locator('#hero-canvas').evaluate(canvas => {
      const state = window.__portfolioScene.getDiagnostics();
      const video = state.motionSource === 'video';
      const rect = video ? state.videoFraming : state.imageFraming;
      const [u, v] = video ? [370 / 1280, 514 / 720] : [146 / 1254, 886 / 1254];
      const ratio = canvas.width / state.size.width;
      const x = Math.round((rect.left + rect.width * u) * ratio);
      const y = Math.round(canvas.height - (rect.top + rect.height * v) * ratio);
      const half = Math.max(4, Math.round(rect.width * (video ? 22 / 1280 : 38 / 1254) * ratio));
      const left = Math.max(0, x - half), bottom = Math.max(0, y - half);
      const width = Math.min(canvas.width, x + half) - left;
      const height = Math.min(canvas.height, y + half) - bottom;
      const data = new Uint8Array(width * height * 4);
      const gl = canvas.getContext('webgl2');
      gl.readPixels(left, bottom, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let visible = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 1] > 35 && data[i + 3] > 0) visible++;
      return { visible, samples: width * height, x, y };
    });
    await page.screenshot({ path: `${output}/${name}.png`, timeout: 90000 });
    assert.ok(pixels.visible > pixels.samples * .08, `${name}: emblem region is rendered (${JSON.stringify(pixels)})`);
    console.log(name, JSON.stringify(pixels));
    return pixels;
  }
  const videoLogo = await checkLogo('desktop');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().motionSource === 'image');
  const stillLogo = await checkLogo('reduced-motion');
  assert.ok(Math.hypot(videoLogo.x - stillLogo.x, videoLogo.y - stillLogo.y) < 5, 'Emblem stays aligned when switching between video and still');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().mobile);
  await checkLogo('mobile');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(() => !window.__portfolioScene.getDiagnostics().mobile);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !window.__portfolioScene.getDiagnostics().reducedMotion);
  await page.evaluate(() => {
    window.__portfolioScene.setPaused(false);
    window.__portfolioScene.setScrollProgress(.7);
  });
  await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().portraitPhase > 1.9, null, { timeout: 30000 });
  await page.screenshot({ path: `${output}/dissolve.png`, timeout: 90000 });
  await page.evaluate(() => window.__portfolioScene.setScrollProgress(0));
  await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().portraitPhase < .01);
  assert.deepEqual(errors, []);
  assert.equal((await state()).error, null);
  console.log('Apple emblem: desktop video, pause, reduced-motion still, mobile and dissolve passed.');
} finally {
  await browser.close();
}
