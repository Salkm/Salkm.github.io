import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = 'artifacts/reference-atmosphere';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const records = [];
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto('https://www.rubenmarcus.dev/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  const rules = await page.evaluate(() => {
    const results = [];
    function walk(rules, media = '') {
      for (const rule of rules) {
        if (/hero-terminal|gradient-grid-bg|ice-bg/.test(rule.selectorText || '')) results.push({ media, selector: rule.selectorText, style: rule.style.cssText });
        if (rule.cssRules) walk(rule.cssRules, `${media} ${rule.conditionText || ''}`.trim());
      }
    }
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch {} }
    return results;
  });
  await writeFile(`${output}/rules.json`, JSON.stringify(rules, null, 2));
  for (const [name, width, height] of [['wide', 1900, 1000], ['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const styles = await page.evaluate(() => {
      const selectors = ['.hero-terminal', '.hero-terminal__body', '.hero-terminal__line', '.hero-terminal__cursor', '.tk-kw', '.tk-str', '.tk-com', '.tk-fn', '.tk-txt', '.hero__rotating', '.hero__verb', '.gradient-grid-bg', '.ice-bg'];
      return selectors.map(selector => {
        const element = document.querySelector(selector);
        if (!element) return { selector, missing: true };
        const s = getComputedStyle(element);
        return { selector, rect: element.getBoundingClientRect().toJSON(), color: s.color, opacity: s.opacity, font: s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight, transform: s.transform, mask: s.maskImage, position: s.position, zIndex: s.zIndex, top: s.top, left: s.left, width: s.width, height: s.height, padding: s.padding, display: s.display, whiteSpace: s.whiteSpace, maxHeight: s.maxHeight, overflow: s.overflow };
      });
    });
    records.push({ name, width, height, styles });
  }
} finally {
  await writeFile(`${output}/geometry.json`, JSON.stringify(records, null, 2));
  await browser.close();
}
console.log('Terminal and atmosphere measurements captured at three viewports');
