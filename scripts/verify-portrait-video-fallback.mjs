import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = 'artifacts/identity-study/video-fallback';
const validVideo = process.env.PORTRAIT_TEST_VIDEO || '/portrait-typing.mp4';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const [name, width, height, initialFailure] of [['desktop', 1440, 1000, false], ['mobile', 390, 844, false], ['initial-load', 1440, 1000, true]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__test-corrupt.webm', route => route.fulfill({ status: 200, contentType: 'video/webm', body: 'deliberately invalid media fixture' }));
    await page.goto('http://127.0.0.1:4175/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().ready, null, { timeout: 90000 });
    await page.evaluate(async ({ initialFailure, validVideo }) => {
      window.__portfolioScene.dispose();
      // Exercise a real decoder failure using the owned clip, including mobile recovery.
      const videoSource = initialFailure ? '/__test-corrupt.webm' : validVideo;
      const picture = new Image();
      picture.src = '/portrait-fallback.png';
      await picture.decode();
      window.__portraitDimensions = { width: picture.naturalWidth, height: picture.naturalHeight };
      const createElement = document.createElement;
      document.createElement = function (name, ...args) {
        const element = createElement.call(this, name, ...args);
        if (name === 'video') window.__testVideo = element;
        return element;
      };
      try {
        const { createPortfolioScene } = await import('/src/portrait-scene.js');
        window.__portfolioScene = await createPortfolioScene({ canvas: document.querySelector('#hero-canvas'), source: '/portrait-fallback.png', videoSource });
      } finally { document.createElement = createElement; }
    }, { initialFailure, validVideo });
    if (!initialFailure) {
      await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().motionSource === 'video', null, { timeout: 15000 }).catch(async error => {
        console.log(await page.evaluate(() => ({ state: window.__portfolioScene.getDiagnostics(), media: { error: window.__testVideo?.error?.message, readyState: window.__testVideo?.readyState, networkState: window.__testVideo?.networkState, source: window.__testVideo?.currentSrc } })));
        throw error;
      });
      await page.evaluate(() => { window.__testVideo.src = '/__test-corrupt.webm'; window.__testVideo.load(); });
    }
    await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().videoStatus === 'failed', null, { timeout: 45000 });
    await page.waitForTimeout(300);
    const recovered = await page.evaluate(() => window.__portfolioScene.getDiagnostics());
    assert.equal(recovered.motionSource, 'image', `${name}: failed playback must restore the owned still`);
    assert.deepEqual(recovered.sourceSize, await page.evaluate(() => window.__portraitDimensions));
    assert.equal(recovered.videoPaused, true);
    await page.evaluate(() => {
      window.__portfolioScene.setPaused(true);
      window.__portfolioScene.setPaused(false);
      window.__portfolioScene.setMode('security');
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__portfolioScene.getDiagnostics().videoStatus), 'failed', 'Resume must not retry failed media or overwrite the error status');
    await page.evaluate(() => window.__portfolioScene.setPaused(true));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const visible = await page.locator('#hero-canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let count = 0;
      for (let i = 0; i < pixels.length; i += 16) if (pixels[i + 1] > 20 && pixels[i + 3] > 15) count++;
      return count;
    });
    assert.ok(visible > 1000, `${name}: recovered portrait has visible pixels`);
    await page.screenshot({ path: `${output}/${name}.png`, timeout: 90000 });
    assert.deepEqual(errors, []);
    results.push({ name, recovered, visible, errors });
    console.log(`${name}: media failure restores portrait, preserves controls and does not retry`);
    await page.evaluate(() => window.__portfolioScene.dispose());
    await page.close();
  }
} finally {
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
