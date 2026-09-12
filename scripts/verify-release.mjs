import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:4176/';
const output = process.env.QA_OUTPUT || 'artifacts/release-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const errors = [], failedResponses = [], privateRequests = [];
try {
  const context = await browser.newContext({ reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failedResponses.push({ url: r.url(), status: r.status() }); });
  page.on('request', r => { if (/__reference-study|portrait\.jpg|digital-portrait/.test(r.url())) privateRequests.push(r.url()); });
  const viewports = process.env.QA_SMOKE ? [[1440,900],[390,844],[320,568],[844,390]] : [
    [320,568],[360,800],[390,844],[430,932],[568,320],[667,375],[844,390],
    [760,800],[761,600],[900,900],[901,700],[1024,768],[1150,800],[1151,800],
    [1280,720],[1440,900],[1920,1080],[2560,1440],
  ];
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().ready);
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => {
      const bounds = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      const overflow = [...document.querySelectorAll('main h1,main h2,main h3,main p,main li,main strong,main button,main a,header a')]
        .filter(el => el.checkVisibility() && !el.closest('[aria-hidden="true"],.sr-only,.skip-link') && el.textContent.trim())
        .filter(el => getComputedStyle(el).display !== 'inline' && el.scrollWidth > el.clientWidth + 2)
        .map(el => ({ class: el.className, text: el.textContent.trim().slice(0,65), width: el.clientWidth, scroll: el.scrollWidth }));
      const canvas = document.querySelector('#hero-canvas'), gl = canvas.getContext('webgl2');
      const data = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let pixels = 0;
      for (let i = 0; i < data.length; i += 16) if (data[i+3] > 20 && data[i+1] > 20) pixels++;
      return { overflow, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        greeting: bounds('.hero-greeting'), header: bounds('.site-header'), hero: bounds('.hero'),
        support: bounds('.hero-support'), toolbar: bounds('.scene-toolbar'), pixels };
    });
    const checks = { textFits: layout.overflow.length === 0, noPageOverflow: !layout.pageOverflow,
      headerClear: layout.greeting.top >= layout.header.bottom + 8,
      controlsClear: layout.toolbar.top >= layout.support.bottom + 4 || layout.toolbar.left >= layout.support.right + 4,
      nonblankPortrait: layout.pixels > 1000 };
    if ([320,390,844,1440,1920].includes(width)) await page.screenshot({ path: `${output}/${width}x${height}-hero.png` });
    if (await page.locator('.menu-toggle').isVisible()) {
      await page.locator('.menu-toggle').click();
      await page.locator('#mobile-nav a').last().scrollIntoViewIfNeeded();
      checks.menuFits = await page.locator('#mobile-nav a').last().evaluate(el => {
        const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight;
      });
      await page.keyboard.press('Escape');
      checks.menuEscape = await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'false';
    }
    for (const id of ['services','impact','skills','work','about','experience','contact']) {
      await page.locator(`#${id}`).evaluate(el => el.scrollIntoView({ behavior: 'instant' }));
      await page.waitForTimeout(50);
      if ([320,390,1440].includes(width)) await page.screenshot({ path: `${output}/${width}-${id}.png` });
    }
    for (const [filter,count] of [['automation',3],['security',2],['ai',1],['all',6]]) {
      await page.locator(`[data-filter="${filter}"]`).click();
      checks[`filter-${filter}`] = await page.locator('.project').count() === count;
    }
    await page.locator('.project-open').first().click();
    checks.dialogOpen = await page.locator('.project-dialog').evaluate(d => d.open && d.scrollWidth <= d.clientWidth + 1);
    await page.locator('.project-dialog .button').scrollIntoViewIfNeeded();
    checks.dialogFits = await page.locator('.project-dialog .button').evaluate(el => {
      const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight;
    });
    await page.keyboard.press('Escape');
    checks.dialogFocusReturns = await page.locator('.project-open').first().evaluate(el => document.activeElement === el);
    await page.locator('.copy-email').click();
    checks.clipboard = await page.evaluate(() => navigator.clipboard.readText()) === 'mail2skm@icloud.com';
    const images = await page.locator('img').evaluateAll(images => Promise.all(images.map(async image => {
      await image.decode(); return { src: image.currentSrc, width: image.naturalWidth, alt: image.hasAttribute('alt') };
    })));
    checks.imagesLoaded = images.every(image => image.width > 0 && image.alt);
    checks.anchorTargets = await page.locator('a[href^="#"]').evaluateAll(links => links.every(link => document.getElementById(link.hash.slice(1))));
    results.push({ width, height, checks, layout });
    console.log(`${width}x${height}: ${Object.values(checks).every(Boolean) ? 'PASS' : JSON.stringify({ checks, overflow: layout.overflow })}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.menu-toggle').click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => document.querySelector('#mobile-nav').hidden);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
  results.push({ menuBreakpointReset: 'PASS' });
  const fallback = await context.newPage();
  await fallback.setViewportSize({ width: 390, height: 844 });
  await fallback.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (/webgl/.test(type)) return null;
      return getContext.call(this, type, ...args);
    };
  });
  await fallback.goto(url, { waitUntil: 'networkidle' });
  await fallback.waitForFunction(() => document.querySelector('.hero').dataset.scene === 'fallback');
  assert.ok(await fallback.locator('.scene-fallback').isVisible());
  assert.ok(await fallback.locator('.scene-fallback img').evaluate(image => image.complete && image.naturalWidth > 0));
  await fallback.screenshot({ path: `${output}/no-webgl.png` });
  results.push({ fallback: 'PASS', errors, failedResponses, privateRequests });
  assert.deepEqual(errors, []);
  assert.deepEqual(failedResponses, []);
  assert.deepEqual(privateRequests, []);
  if (!process.env.QA_AUDIT_ONLY) assert.ok(results.filter(r => r.checks).every(r => Object.values(r.checks).every(Boolean)), 'Release regression: inspect verification.json');
} finally {
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
