import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = 'artifacts/reference-fields';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const records = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto('https://www.rubenmarcus.dev/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4000);
    const details = await page.evaluate(() => [...document.querySelectorAll('canvas')].map(canvas => {
      const ancestors = [];
      let element = canvas;
      while (element && ancestors.length < 4) {
        const style = getComputedStyle(element);
        ancestors.push({
          tag: element.tagName, id: element.id, class: element.className,
          rect: element.getBoundingClientRect().toJSON(), position: style.position,
          background: style.background, opacity: style.opacity, mask: style.maskImage,
          transform: style.transform, zIndex: style.zIndex,
        });
        element = element.parentElement;
      }
      return { width: canvas.width, height: canvas.height, ancestors };
    }));
    await page.locator('.stack-section').evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - 140, behavior: 'instant' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${output}/${name}-stack.png`, timeout: 90000 });
    const dither = page.locator('.dither-bg canvas').first();
    if (await dither.count()) {
      const dataUrl = await dither.evaluate(canvas => canvas.toDataURL());
      await writeFile(`${output}/${name}-dither.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    const properties = await page.evaluate(() => [...document.querySelectorAll('astro-island')]
      .filter(element => /DitherBg|IceFlowBg/.test(element.getAttribute('component-url') || ''))
      .map(element => ({ component: element.getAttribute('component-url'), props: JSON.parse(element.getAttribute('props') || '{}') })));
    records.push({ name, width, height, details, properties });
    console.log(JSON.stringify(properties));
    console.log(`${name}: field geometry captured`);
    await page.close();
  }
} finally {
  await writeFile(`${output}/geometry.json`, JSON.stringify(records, null, 2));
  await browser.close();
}
