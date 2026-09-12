import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = path.resolve("artifacts");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const characterURL = new URL(process.env.PORTFOLIO_URL || "http://127.0.0.1:4175/");
characterURL.searchParams.set('renderer', 'character');
const baseURL = characterURL.href;
const results = [];
const failures = [];

async function capture(page, options) {
  const wasPaused = await page.evaluate(() => {
    const scene = window.__portfolioScene;
    if (!scene) return true;
    const paused = scene.getDiagnostics().paused;
    scene.setPaused(true);
    return paused;
  });
  await page.screenshot({ ...options, timeout: 60000 });
  if (!wasPaused)
    await page.evaluate(() => window.__portfolioScene?.setPaused(false));
}

async function canvasPixels(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#hero-canvas");
    const gl = canvas.getContext("webgl2");
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(
      0,
      0,
      canvas.width,
      canvas.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );
    let count = 0,
      hash = 0,
      left = canvas.width,
      right = 0,
      top = canvas.height,
      bottom = 0;
    for (let y = 0; y < canvas.height; y += 3)
      for (let x = 0; x < canvas.width; x += 3) {
        const index = (y * canvas.width + x) * 4;
        if (data[index + 3] < 20) continue;
        count++;
        hash =
          ((hash * 31) ^
            data[index] ^
            (data[index + 1] << 8) ^
            (data[index + 2] << 16)) |
          0;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, canvas.height - y);
        bottom = Math.max(bottom, canvas.height - y);
      }
    return {
      count,
      hash,
      bounds: {
        left: left / canvas.width,
        right: right / canvas.width,
        top: top / canvas.height,
        bottom: bottom / canvas.height,
      },
    };
  });
}

try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["wide", 1920, 1080],
    ["mobile", 390, 844],
    ["small-mobile", 375, 667],
    ["tablet", 768, 1024],
    ["compact-mobile", 320, 640],
    ["short-desktop", 1280, 720],
    ["landscape", 1024, 600],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: width <= 600,
      hasTouch: width <= 600,
    });
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => window.__portfolioScene?.getDiagnostics().ready,
      { timeout: 30000 },
    );
    await page.waitForTimeout(900);
    const pixels = await canvasPixels(page);
    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: innerWidth,
      headlineLines: (() => {
        const heading = document.querySelector('.hero h1');
        return heading.getBoundingClientRect().height / parseFloat(getComputedStyle(heading).lineHeight);
      })(),
      greetingTop: document.querySelector('.hero-greeting').getBoundingClientRect().top,
      headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom,
      heroBottom: document.querySelector(".hero").getBoundingClientRect()
        .bottom,
      overlappingControls: (() => {
        const a = document
          .querySelector(".hero-actions")
          .getBoundingClientRect();
        const b = document
          .querySelector(".scene-toolbar")
          .getBoundingClientRect();
        return (
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top
        );
      })(),
      images: [...document.images].every(
        (image) =>
          !image.offsetParent || (image.complete && image.naturalWidth > 0),
      ),
    }));
    const diagnostics = await page.evaluate(() =>
      window.__portfolioScene.getDiagnostics(),
    );
    assert.equal(
      diagnostics.skeletal,
      true,
      `${name}: a real skinned character is required`,
    );
    assert.ok(
      diagnostics.boneCount > 20,
      `${name}: character must have a humanoid skeleton`,
    );
    assert.equal(errors.length, 0, `${name} page errors: ${errors.join(", ")}`);
    assert.ok(
      pixels.count > 1000,
      `${name}: scene must contain visible pixels`,
    );
    assert.ok(layout.scrollWidth <= width, `${name}: horizontal overflow`);
    assert.ok(layout.greetingTop >= layout.headerBottom, `${name}: header overlaps hero greeting`);
    if (width > 760) assert.ok(layout.headlineLines < 3.1, `${name}: headline must remain three lines`);
    assert.ok(
      layout.heroBottom < height,
      `${name}: next section must be visible`,
    );
    assert.ok(!layout.overlappingControls, `${name}: controls overlap copy`);
    await capture(page, { path: path.join(output, `${name}.png`) });
    if (name === "desktop") {
      const firstPose = await page.evaluate(
        () => window.__portfolioScene.getDiagnostics().poseSignature,
      );
      const next = await canvasPixels(page);
      await page.waitForTimeout(300);
      const moving = await canvasPixels(page);
      assert.notEqual(next.hash, moving.hash, "Scene must animate");
      assert.notEqual(
        await page.evaluate(
          () => window.__portfolioScene.getDiagnostics().poseSignature,
        ),
        firstPose,
        "Typing must animate character bones",
      );
      await page.locator('[data-mode="security"]').click();
      await page.waitForTimeout(600);
      assert.equal(
        await page.evaluate(
          () => window.__portfolioScene.getDiagnostics().mode,
        ),
        "security",
      );
      await page
        .getByRole("button", { name: "Pause animation", exact: true })
        .click();
      assert.equal(
        await page.evaluate(
          () => window.__portfolioScene.getDiagnostics().paused,
        ),
        true,
      );
      await page.waitForTimeout(1600);
      const pausedPixels = await canvasPixels(page);
      await page.waitForTimeout(350);
      assert.equal(
        (await canvasPixels(page)).hash,
        pausedPixels.hash,
        "Pause must stop choreography",
      );
      await page.mouse.move(width * 0.72, height * 0.4);
      await page.mouse.down();
      await page.mouse.move(width * 0.81, height * 0.43, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      assert.notEqual(
        (await canvasPixels(page)).hash,
        pausedPixels.hash,
        "Dragging changes the 3D view",
      );
      await page
        .getByRole("button", { name: "Reset 3D view", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Play animation", exact: true })
        .click();
      await page.locator('[data-mode="automation"]').click();
      await page.mouse.move(20, 110);
      await page.evaluate(() =>
        window.__portfolioScene.setScrollProgress(0.38),
      );
      await page.waitForFunction(() => {
        const state = window.__portfolioScene.getDiagnostics();
        return state.modeBlend < .01 && Math.abs(state.renderedProgress - .38) < .01;
      }, null, { timeout: 45000 });
      const scrollState = await page.evaluate(() =>
        window.__portfolioScene.getDiagnostics(),
      );
      assert.ok(scrollState.modeBlend < 0.01, "Scroll effects require Portrait mode");
      assert.ok(
        Math.abs(scrollState.renderedProgress - 0.38) < 0.01,
        "Scroll progress reaches the wireframe state",
      );
      const wirePixels = await canvasPixels(page);
      assert.notEqual(
        wirePixels.hash,
        pausedPixels.hash,
        "Scroll changes portrait rendering",
      );
      await capture(page, {
        path: path.join(output, "portrait-wireframe.png"),
      });
      await page.evaluate(() => window.__portfolioScene.setScrollProgress(0.72));
      await page.waitForFunction(() => Math.abs(window.__portfolioScene.getDiagnostics().renderedProgress - .72) < .01, null, { timeout: 45000 });
      const cloudPixels = await canvasPixels(page);
      assert.ok(cloudPixels.count > 1000, "Point cloud stays visible");
      assert.notEqual(
        cloudPixels.hash,
        wirePixels.hash,
        "Point cloud differs from wireframe",
      );
      await capture(page, {
        path: path.join(output, "portrait-pointcloud.png"),
      });
      await page.evaluate(() => window.__portfolioScene.setScrollProgress(1));
      await page.waitForFunction(() => Math.abs(window.__portfolioScene.getDiagnostics().renderedProgress - 1) < .01, null, { timeout: 45000 });
      const scanPixels = await canvasPixels(page);
      assert.ok(scanPixels.count > 1000, "Scanline state stays visible");
      assert.notEqual(scanPixels.hash, cloudPixels.hash, "Scanlines differ from points");
      await capture(page, {
        path: path.join(output, "portrait-scanlines.png"),
      });
      await page.evaluate(() => window.__portfolioScene.setScrollProgress(0));
      await page.locator('[data-filter="automation"]').click();
      assert.equal(await page.locator(".project").count(), 3);
      await page.locator('[data-filter="ai"]').click();
      assert.equal(await page.locator(".project").count(), 1);
      await page.locator(".project-open").click();
      assert.equal(
        await page
          .locator(".project-dialog")
          .evaluate((element) => element.open),
        true,
      );
      assert.match(
        await page.locator("#dialog-title").innerText(),
        /AI-Assisted/,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .locator(".project-dialog")
          .evaluate((element) => element.open),
        false,
      );
      await page.locator('[data-filter="all"]').click();
      assert.equal(await page.locator(".project").count(), 6);
      await page.locator(".experience-item").nth(1).locator("summary").click();
      assert.equal(
        await page.locator(".experience-item").nth(1).getAttribute("open"),
        "",
      );
      await page.locator(".copy-email").click();
      await page.locator(".toast").waitFor({ state: "visible" });
      assert.match(await page.locator(".toast").innerText(), /Email/);
      assert.match(
        await page.locator(".contact-bottom a").getAttribute("href"),
        /^mailto:mail2skm@icloud.com/,
      );
      await capture(page, {
        path: path.join(output, "desktop-full.png"),
        fullPage: true,
      });
    }
    if (name === "mobile") {
      await page.getByRole("button", { name: "Open navigation" }).click();
      assert.equal(await page.locator("#mobile-nav").isVisible(), true);
      await page.locator('#mobile-nav a[href="#about"]').click();
      assert.equal(await page.locator("#mobile-nav").isVisible(), false);
      await page.waitForTimeout(500);
      await capture(page, { path: path.join(output, "mobile-about.png") });
      await page.locator('[data-filter="security"]').click();
      assert.equal(await page.locator(".project").count(), 2);
      await page.locator(".project-open").first().click();
      await capture(page, { path: path.join(output, "mobile-project.png") });
      await page.locator(".dialog-close").click();
    }
    results.push({ name, layout, pixels, diagnostics, errors });
    console.log(
      `${name}: passed (${pixels.count} scene pixels, ${diagnostics.drawCalls} draw calls)`,
    );
    await page.close();
  }
  const reducedPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await reducedPage.goto(baseURL, { waitUntil: "networkidle" });
  await reducedPage.waitForFunction(
    () => window.__portfolioScene?.getDiagnostics().ready,
  );
  assert.equal(
    await reducedPage.evaluate(
      () => window.__portfolioScene.getDiagnostics().paused,
    ),
    true,
  );
  const staticFirst = await canvasPixels(reducedPage);
  await reducedPage.waitForTimeout(300);
  assert.equal(
    (await canvasPixels(reducedPage)).hash,
    staticFirst.hash,
    "Reduced-motion scene remains still",
  );
  await reducedPage
    .getByRole("button", { name: "Play animation", exact: true })
    .click();
  await reducedPage.waitForTimeout(300);
  assert.equal(
    await reducedPage.evaluate(
      () => window.__portfolioScene.getDiagnostics().paused,
    ),
    false,
  );
  assert.notEqual(
    (await canvasPixels(reducedPage)).hash,
    staticFirst.hash,
    "Explicit play can enable motion",
  );
  await reducedPage.close();
  const fallbackPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await fallbackPage.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).startsWith("webgl")) return null;
      return getContext.call(this, type, ...args);
    };
  });
  await fallbackPage.goto(baseURL, { waitUntil: "networkidle" });
  await fallbackPage.waitForFunction(
    () => document.querySelector(".hero").dataset.scene === "fallback",
  );
  assert.equal(await fallbackPage.locator(".scene-fallback").isVisible(), true);
  assert.equal(await fallbackPage.locator(".project").count(), 6);
  await capture(fallbackPage, {
    path: path.join(output, "webgl-fallback.png"),
  });
  await fallbackPage.close();
  console.log("Reduced-motion and WebGL fallback: passed");
} catch (error) {
  failures.push(error.message);
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await writeFile(
    path.join(output, "verification.json"),
    JSON.stringify({ results, failures }, null, 2),
  );
  await browser.close();
}
