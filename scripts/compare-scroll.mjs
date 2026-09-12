import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = 'artifacts/scroll-comparison';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = [];
const sections = [
  ['hero', 0, 0], ['transition', 500, 500],
  ['services', '.hire', '#services'], ['results', '.stats', '#impact'],
  ['stack', '.stack-section', '#skills'], ['work', '#writing', '#work'],
  ['contact', '#contact-cta', '#contact'],
];
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    for (const [target, url] of [['reference', 'https://www.rubenmarcus.dev/'], ['local', 'http://127.0.0.1:4175/']]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.evaluate(() => document.fonts.ready);
      if (target === 'local') await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().ready && window.__portfolioAtmosphere?.getDiagnostics().every(layer => layer.ready), null, { timeout: 90000 });
      else await page.waitForTimeout(3500);
      const entries = [];
      for (const [section, reference, local] of sections) {
        const selector = target === 'reference' ? reference : local;
        await page.evaluate(selector => {
          const top = typeof selector === 'number' ? selector : document.querySelector(selector).getBoundingClientRect().top + scrollY - 140;
          scrollTo({ top, behavior: 'instant' });
        }, selector);
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${output}/${name}-${target}-${section}.png`, timeout: 90000 });
        const geometry = await page.evaluate(selector => {
          const element = typeof selector === 'number' ? document.querySelector('main section') : document.querySelector(selector);
          const rect = element.getBoundingClientRect();
          return { scroll: scrollY, section: rect.toJSON(), heading: element.querySelector('h1,h2')?.getBoundingClientRect().toJSON(), overflow: document.documentElement.scrollWidth > innerWidth };
        }, selector);
        if (target === 'local') assert.equal(geometry.overflow, false, `${name}/${section}: no horizontal overflow`);
        entries.push({ section, ...geometry });
      }
      const terminal = await page.evaluate(target => {
        const root = document.querySelector(target === 'reference' ? '.hero-terminal__body' : '.code-body');
        const rect = root?.getBoundingClientRect();
        return rect ? { x: rect.x, y: rect.y + scrollY, width: rect.width, height: rect.height } : null;
      }, target);
      if (target === 'local') assert.equal(errors.length, 0, errors.join('; '));
      report.push({ name, target, terminal, entries, errors });
      await page.close();
      console.log(`${name}/${target}: complete scroll sequence captured`);
    }
  }
} finally {
  await writeFile(`${output}/comparison.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
