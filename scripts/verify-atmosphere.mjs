import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = 'artifacts/atmosphere-study';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
async function pixels(page, selector) {
  return page.locator(selector).evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let hash = 0, count = 0, maximum = 0;
    for (let i = 0; i < data.length; i += 16) {
      hash = ((hash * 31) ^ data[i + 1]) | 0;
      maximum = Math.max(maximum, data[i + 1]);
      if (data[i + 1] > 0) count++;
    }
    return { count, hash, maximum, width: canvas.width, height: canvas.height };
  });
}
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844], ['tablet', 768, 1024]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.log(message.text()); });
    await page.goto('http://127.0.0.1:4175/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().ready && window.__portfolioAtmosphere?.getDiagnostics().length === 2 && window.__portfolioAtmosphere.getDiagnostics().every(layer => layer.ready || layer.error), null, { timeout: 90000 });
    let layers = await page.evaluate(() => window.__portfolioAtmosphere.getDiagnostics());
    assert.equal(layers.some(layer => layer.error), false, JSON.stringify(layers));
    assert.equal(await page.locator('.code-atmosphere').isVisible(), width >= 768);
    if (width >= 768) await page.waitForFunction(() => window.__portfolioTerminal.getDiagnostics().typedCharacters > 5, null, { timeout: 30000 });
    const gridBefore = await pixels(page, '#hero-grid');
    assert.ok(gridBefore.count > 1000, 'Perspective grid contains visible pixels');
    if (width >= 768) {
      const beforeFrame = layers[0].frames;
      await page.waitForFunction(frame => window.__portfolioAtmosphere.getDiagnostics()[0].frames > frame + 2, beforeFrame, { timeout: 30000 });
      assert.notEqual((await pixels(page, '#hero-grid')).hash, gridBefore.hash, 'Grid visibly moves');
    } else {
      await page.waitForTimeout(300);
      assert.equal((await pixels(page, '#hero-grid')).hash, gridBefore.hash, 'Mobile grid is static');
    }
    await page.locator('.scene-toggle').click();
    await page.waitForTimeout(250);
    const frozenText = await page.evaluate(() => window.__portfolioTerminal.getDiagnostics());
    const frozenGrid = await pixels(page, '#hero-grid');
    await page.waitForTimeout(400);
    assert.equal((await pixels(page, '#hero-grid')).hash, frozenGrid.hash, 'Pause freezes the grid');
    assert.equal(await page.evaluate(() => window.__portfolioTerminal.getDiagnostics().text), frozenText.text, 'Pause freezes typing');
    await page.screenshot({ path: `${output}/${name}-hero.png`, timeout: 90000 });
    await page.locator('.scene-toggle').click();
    await page.locator('#skills').evaluate(element => element.scrollIntoView({ behavior: 'instant' }));
    await page.waitForFunction(() => !window.__portfolioTerminal.getDiagnostics().intersecting);
    if (width >= 768) await page.mouse.move(width * .18, height * .5);
    await page.waitForFunction(() => window.__portfolioAtmosphere.getDiagnostics()[1].frames > 5, null, { timeout: 30000 });
    await page.waitForTimeout(350);
    const flow = await pixels(page, '#ambient-flow');
    assert.ok(flow.count > 100, 'ASCII flow contains visible pixels');
    const terminalOffscreen = await page.evaluate(() => window.__portfolioTerminal.getDiagnostics().elapsed);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.__portfolioTerminal.getDiagnostics().elapsed), terminalOffscreen, 'Terminal suspends off-screen');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(400);
    const reducedFlow = await pixels(page, '#ambient-flow');
    await page.waitForTimeout(400);
    assert.equal((await pixels(page, '#ambient-flow')).hash, reducedFlow.hash, 'Reduced motion freezes the flow');
    await page.screenshot({ path: `${output}/${name}-stack.png`, timeout: 90000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(errors.length, 0, errors.join('; '));
    layers = await page.evaluate(() => window.__portfolioAtmosphere.getDiagnostics());
    results.push({ name, gridBefore, flow, layers, errors });
    console.log(`${name}: grid, terminal, flow, pause, visibility, and reduced motion passed`);
    await page.close();
  }
} finally {
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
