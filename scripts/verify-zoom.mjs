import { createRequire } from 'node:module';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.QA_OUTPUT || 'artifacts/zoom-qa';
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:4176/';
await mkdir(output, { recursive: true });
const profile = await mkdtemp(resolve(output, 'chrome-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chrome', headless: true, viewport: null, reducedMotion: 'reduce',
  args: ['--window-size=1440,1000', '--force-device-scale-factor=1', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const results = [];
try {
  // Chrome's own page-zoom setting changes layout, DPR, and media queries together.
  const settings = await context.newPage();
  await settings.goto('chrome://settings/appearance');
  console.log('Native zoom API:', await settings.evaluate(() => typeof chrome.settingsPrivate?.setDefaultZoom));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().ready);
  for (const zoom of (process.env.ZOOM_LEVELS || '50,67,75,80,90,100,110,125,150,175,200,250,300,400').split(',').map(Number)) {
    await settings.evaluate(value => new Promise(resolve => chrome.settingsPrivate.setDefaultZoom(value, resolve)), zoom / 100);
    await page.bringToFront();
    await page.waitForFunction(value => Math.abs(devicePixelRatio - value) < .02, zoom / 100);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForTimeout(500);
    const layout = await page.evaluate(() => {
      const bounds = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      const visible = el => el.checkVisibility() && !el.closest('[aria-hidden="true"],.sr-only,.skip-link');
      const overflow = [...document.querySelectorAll('main h1,main h2,main h3,main p,main li,main strong,main button,main a,header a')]
        .filter(visible).filter(el => el.textContent.trim() && getComputedStyle(el).display !== 'inline' && el.scrollWidth > el.clientWidth + 2)
        .map(el => ({ tag: el.tagName, class: el.className, text: el.textContent.trim().slice(0,65), width: el.clientWidth, scroll: el.scrollWidth }));
      const title = bounds('.hero-title-group');
      const hero = bounds('.hero');
      const header = bounds('.site-header');
      const support = bounds('.hero-support');
      const toolbar = bounds('.scene-toolbar');
      return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scale: visualViewport.scale,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        title, hero, header, support, toolbar, overflow,
        headingBehindHeader: title.top < header.bottom + 8,
        contentClipped: support.bottom > hero.bottom - 8,
        controlsOverlap: toolbar.top < support.bottom && toolbar.left < support.right,
      };
    });
    const checks = { nativeZoom: Math.abs(layout.dpr - zoom / 100) < .02 && layout.scale === 1,
      noHorizontalOverflow: !layout.horizontalOverflow, noTextOverflow: layout.overflow.length === 0,
      clearHeader: !layout.headingBehindHeader, contentVisible: !layout.contentClipped, controlsSeparate: !layout.controlsOverlap };
    // Playwright's CSS-sized screenshot clip is inaccurate with native browser zoom.
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(`${output}/zoom-${zoom}.png`, Buffer.from(screenshot.data, 'base64'));
    const pixels = await page.locator('#hero-canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      const data = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let visible = 0;
      for (let i = 0; i < data.length; i += 16) if (data[i + 3] > 20 && data[i + 1] > 20) visible++;
      return { visible, width: canvas.width, height: canvas.height, state: window.__portfolioScene.getDiagnostics() };
    });
    checks.portraitVisible = pixels.visible > 1000;
    if (await page.locator('.menu-toggle').isVisible()) {
      await page.locator('.menu-toggle').click();
      await page.locator('#mobile-nav a').last().scrollIntoViewIfNeeded();
      checks.menuReachable = await page.locator('#mobile-nav a').last().evaluate(el => {
        const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight;
      });
      await page.keyboard.press('Escape');
    }
    await page.locator('.project-open').first().click();
    checks.dialogOpen = await page.locator('.project-dialog').evaluate(d => d.open && d.scrollWidth <= d.clientWidth + 1);
    await page.locator('.project-dialog .button').scrollIntoViewIfNeeded();
    checks.dialogActionReachable = await page.locator('.project-dialog .button').evaluate(el => {
      const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight;
    });
    await page.keyboard.press('Escape');
    results.push({ zoom, checks, layout, pixels });
    console.log(`${zoom}% (${layout.width}x${layout.height}, DPR ${layout.dpr}): ${JSON.stringify(checks)}`);
  }
  results.push({ errors });
  if (!process.env.QA_AUDIT_ONLY) {
    assert.ok(results.filter(r => r.checks).every(r => Object.values(r.checks).every(Boolean)), 'Zoom regression: inspect verification.json');
    assert.equal(errors.length, 0, errors.join('; '));
  }
} finally {
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  await context.close();
}
