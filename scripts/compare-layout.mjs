import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const references = JSON.parse(
  await readFile("artifacts/reference/measurements.json", "utf8"),
);
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const comparisons = [];
try {
  for (const reference of references) {
    const page = await browser.newPage({
      viewport: { width: reference.width, height: reference.height },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4176/", { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => window.__portfolioScene?.getDiagnostics().ready,
    );
    await page.evaluate(() => window.__portfolioScene.setPaused(true));
    const measurements = await page.evaluate(() => {
      const measure = (selector) => {
        const el = document.querySelector(selector),
          r = el.getBoundingClientRect(),
          s = getComputedStyle(el);
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          font: s.fontFamily,
          fontSize: parseFloat(s.fontSize),
          lineHeight: parseFloat(s.lineHeight),
        };
      };
      const canvas = document.querySelector("#hero-canvas"),
        gl = canvas.getContext("webgl2");
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(
        0,
        0,
        canvas.width,
        canvas.height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      let visibleSamples = 0;
      for (let i = 3; i < pixels.length; i += 64)
        if (pixels[i] > 20) visibleSamples++;
      return {
        greeting: measure(".hero-greeting"),
        heading: measure(".hero h1"),
        body: measure(".hero-description"),
        header: measure(".site-header"),
        hero: measure(".hero"),
        visibleSamples,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    const deltas = {};
    for (const [name, refClass] of [
      ["greeting", "hero__intro"],
      ["heading", "hero__title"],
      ["body", "hero__sub"],
    ]) {
      const original = reference.elements.find((e) =>
        e.class.startsWith(refClass),
      );
      deltas[name] = {
        x: measurements[name].x - original.rect.x,
        y: measurements[name].y - original.rect.y,
        fontSize: measurements[name].fontSize - parseFloat(original.fontSize),
        height: measurements[name].height - original.rect.height,
      };
    }
    assert.equal(errors.length, 0, `${reference.name}: ${errors.join(", ")}`);
    assert.equal(measurements.overflow, false);
    assert.ok(measurements.visibleSamples > 1000, "3D canvas must be nonblank");
    assert.ok(
      measurements.greeting.y >=
        measurements.header.y + measurements.header.height,
      "Header must not overlap greeting",
    );
    await page.screenshot({
      path: `artifacts/reference/${reference.name}-local.png`,
      timeout: 60000,
    });
    comparisons.push({ name: reference.name, measurements, deltas, errors });
    console.log(
      JSON.stringify({
        name: reference.name,
        deltas,
        visibleSamples: measurements.visibleSamples,
      }),
    );
    await page.close();
  }
} finally {
  await writeFile(
    "artifacts/reference/layout-comparison.json",
    JSON.stringify(comparisons, null, 2),
  );
  await browser.close();
}
