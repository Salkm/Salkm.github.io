import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];

try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4175/?calibration=owned', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  for (const width of [320, 390, 600, 639, 640, 760, 768, 900, 1079, 1080, 1100, 1200, 1440, 1900]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const measured = await page.locator('.impact-grid').evaluate(grid => {
      const rect = grid.getBoundingClientRect();
      const style = getComputedStyle(grid);
      const cells = [...grid.children];
      return {
        width: rect.width,
        height: rect.height,
        columns: style.gridTemplateColumns.split(' ').length,
        cells: cells.length,
        cellHeight: cells[0].getBoundingClientRect().height,
        overflow: cells.some(cell => cell.scrollWidth > cell.clientWidth + 1),
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    const expectedWidth = Math.min(1088, width - Math.min(112, Math.max(48, width * 0.1)));
    const expectedColumns = width < 640 ? 1 : width < 1080 ? 2 : 4;
    assert.ok(Math.abs(measured.width - expectedWidth) < 1, `Content width at ${width}: expected ${expectedWidth}, got ${measured.width}`);
    assert.equal(measured.columns, expectedColumns, `Columns at ${width}`);
    assert.equal(measured.cells, 8);
    assert.equal(measured.overflow, false, `Cell overflow at ${width}`);
    assert.equal(measured.pageOverflow, false, `Page overflow at ${width}`);
    results.push({ viewportWidth: width, ...measured });
  }
  console.log('Results grid: all 14 viewport and breakpoint checks passed');
} finally {
  await mkdir('artifacts/section-study', { recursive: true });
  await writeFile('artifacts/section-study/metric-layout.json', JSON.stringify(results, null, 2));
  await browser.close();
}
