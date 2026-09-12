import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PNG } = require(process.env.PNGJS_MODULE || 'pngjs');
const output = 'artifacts/motion-comparison';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const captures = [];
const samples = [
  { name: 'early', time: 0.5, pointer: [.5, .5] },
  { name: 'center', time: 2, pointer: [.5, .5] },
  { name: 'late', time: 4, pointer: [.5, .5] },
  { name: 'head', time: 2, pointer: [.86, .66] },
  { name: 'hands', time: 2, pointer: [.62, .2] },
  { name: 'left', time: 2, pointer: [-.1, .6] },
];

try {
  for (const [name, width] of [['wide', 1900], ['desktop', 1440]]) {
    for (const [target, url] of [['reference', 'https://www.rubenmarcus.dev/'], ['local', 'http://127.0.0.1:4175/?calibration=reference']]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.__studyVideos = [];
        const create = Document.prototype.createElement;
        Document.prototype.createElement = function (name, ...args) {
          const element = create.call(this, name, ...args);
          if (String(name).toLowerCase() === 'video') {
            window.__studyVideos.push(element);
            const listen = element.addEventListener;
            // Seeking can emit canplay again; keep the reference texture's original frame callback.
            element.addEventListener = function (type, callback, options) {
              return listen.call(this, type, callback, type === 'canplay' ? { once: true } : options);
            };
          }
          return element;
        };
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          return this.__studyFrozen ? Promise.resolve() : play.call(this);
        };
      });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction(() => window.__studyVideos.some(video => video.readyState >= 2), null, { timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(2000);
      const geometry = await page.evaluate(target => {
        const root = document.querySelector(target === 'reference' ? '.hero-scan' : '#hero-canvas');
        const canvas = target === 'reference' ? root.querySelector('canvas') : root;
        const rect = root.getBoundingClientRect();
        return {
          window: rect.toJSON(), clientWidth: root.clientWidth, clientHeight: root.clientHeight,
          canvas: {
            width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight, rect: canvas.getBoundingClientRect().toJSON(),
            style: canvas.getAttribute('style'),
          },
        };
      }, target);
      for (const sample of samples) {
        await page.evaluate(async ({ sample, target }) => {
          const video = window.__studyVideos.find(video => video.readyState >= 2);
          video.__studyFrozen = true;
          video.pause();
          if (Math.abs(video.currentTime - sample.time) > .0001) {
            await new Promise(resolve => {
              video.addEventListener('seeked', resolve, { once: true });
              video.currentTime = sample.time;
            });
          }
          clearInterval(window.__studyPointerTimer);
          const move = () => {
            const rect = document.querySelector(target === 'reference' ? '.hero-scan' : '#hero-canvas').getBoundingClientRect();
            const clientX = rect.left + rect.width * sample.pointer[0];
            const clientY = rect.top + rect.height * (1 - sample.pointer[1]);
            window.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, pointerType: 'mouse' }));
          };
          move();
          window.__studyPointerTimer = setInterval(move, 60);
        }, { sample, target });
        await page.waitForTimeout(5000);
        const frame = await page.evaluate(() => {
          const video = window.__studyVideos.find(video => video.readyState >= 2);
          return { time: video.currentTime, paused: video.paused, duration: video.duration, diagnostics: window.__portfolioScene?.getDiagnostics() };
        });
        assert.equal(frame.paused, true);
        assert.ok(Math.abs(frame.time - sample.time) < .001, `${target}/${name}/${sample.name} frame`);
        await page.screenshot({ path: `${output}/${name}-${target}-${sample.name}.png`, timeout: 90000 });
        captures.push({ name, target, sample, geometry, frame, errors });
        console.log(`${name}/${target}/${sample.name}: captured`);
      }
      assert.equal(errors.length, 0, errors.join('; '));
      await page.close();
    }
  }
} finally {
  await writeFile(`${output}/captures.json`, JSON.stringify(captures, null, 2));
  await browser.close();
}

const comparisons = [];
for (const name of ['wide', 'desktop']) {
  for (const sample of samples) {
    const reference = PNG.sync.read(await readFile(`${output}/${name}-reference-${sample.name}.png`));
    const local = PNG.sync.read(await readFile(`${output}/${name}-local-${sample.name}.png`));
    const region = { left: Math.round(reference.width * .54), right: reference.width - 65, top: 180, bottom: 900 };
    function measure(dx = 0, dy = 0) {
      let n = 0, a = 0, b = 0, aa = 0, bb = 0, ab = 0, error = 0;
      for (let y = region.top; y < region.bottom; y++) {
        for (let x = region.left; x < region.right; x++) {
          const i = (y * reference.width + x) * 4;
          const j = ((y + dy) * local.width + x + dx) * 4;
          const first = reference.data[i + 1], second = local.data[j + 1];
          if (Math.max(first, second) < 25) continue;
          n++; a += first; b += second; aa += first * first; bb += second * second; ab += first * second;
          for (let c = 0; c < 3; c++) error += Math.abs(reference.data[i + c] - local.data[j + c]);
        }
      }
      return { dx, dy, pixels: n, meanAbsoluteRgbError: error / (n * 3), correlation: (ab - a * b / n) / Math.sqrt((aa - a * a / n) * (bb - b * b / n)) };
    }
    const raw = measure();
    let best = raw;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const measured = measure(dx, dy);
      if (measured.correlation > best.correlation) best = measured;
    }
    comparisons.push({ name, sample, region, raw, best });
  }
}
await writeFile(`${output}/comparison.json`, JSON.stringify(comparisons, null, 2));
console.log(JSON.stringify(comparisons.map(({ name, sample, raw, best }) => ({ name, sample: sample.name, correlation: raw.correlation, error: raw.meanAbsoluteRgbError, best })), null, 2));
