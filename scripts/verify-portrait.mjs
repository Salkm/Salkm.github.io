import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const url = "http://127.0.0.1:4175/?calibration=reference";
const output = "artifacts/portrait-study";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
async function pixels(page) {
  return page.evaluate(() => {
    const c = document.querySelector("#hero-canvas"),
      g = c.getContext("webgl2"),
      p = new Uint8Array(c.width * c.height * 4);
    g.readPixels(0, 0, c.width, c.height, g.RGBA, g.UNSIGNED_BYTE, p);
    let count = 0,
      hash = 0;
    for (let i = 0; i < p.length; i += 16) {
      if (p[i + 3] < 20 || p[i + 1] < 20) continue;
      count++;
      hash = ((hash * 31) ^ p[i] ^ (p[i + 1] << 8) ^ (p[i + 2] << 16)) | 0;
    }
    return { count, hash };
  });
}
async function snapshot(page, name) {
  await page.evaluate(() => window.__portfolioScene.setPaused(true));
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${output}/${name}.png`, timeout: 60000 });
}
try {
  for (const [name, width, height] of [
    ["wide", 1900, 1000],
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
    ["tablet", 768, 1024],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.error(message.text());
    });
    await page.addInitScript(() => {
      window.__studyVideos = [];
      const create = Document.prototype.createElement;
      Document.prototype.createElement = function(name, ...args) {
        const element = create.call(this, name, ...args);
        if (String(name).toLowerCase() === 'video') window.__studyVideos.push(element);
        return element;
      };
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function() {
        if (this.__studyFrozen) return Promise.resolve();
        return play.call(this);
      };
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__portfolioScene?.getDiagnostics().ready);
    if (width > 900) await page.waitForFunction(() => window.__portfolioScene.getDiagnostics().videoStatus === "ready");
    await page.waitForTimeout(800);
    const diagnostics = await page.evaluate(() =>
      window.__portfolioScene.getDiagnostics(),
    );
    assert.equal(diagnostics.representation, "image-video-webgl");
    assert.equal(diagnostics.motionSource, width > 900 ? "video" : "image");
    assert.equal(diagnostics.videoPaused, width <= 900);
    assert.equal(diagnostics.scrollBehavior, 'continuous-portrait');
    assert.equal(diagnostics.cursorField.type, 'continuous-scan-lines');
    assert.equal(diagnostics.cursorField.rows, 140);
    assert.equal(diagnostics.cursorField.segments, 17920);
    const canvasBounds = await page.locator('#hero-canvas').boundingBox();
    const expectedWidth = width <= 900 ? width : Math.min(width * .62, 1080);
    assert.ok(Math.abs(canvasBounds.width - expectedWidth) < .1, 'Portrait has its own correctly sized drawing area');
    assert.ok(Math.abs(canvasBounds.x - (width - expectedWidth)) < .1, 'Portrait drawing area is right aligned');
    const first = await pixels(page);
    await page.waitForTimeout(500);
    const second = await pixels(page);
    console.log(JSON.stringify({ name, diagnostics, first, second }));
    if (first.count <= 1000) await snapshot(page, `${name}-failure`);
    assert.ok(first.count > 1000);
    if (width > 900) assert.notEqual(first.hash, second.hash, "Video must visibly move");
    else assert.equal(first.hash,second.hash,"Mobile reference uses the still portrait");
    const frozenSource = await page.evaluate(async () => {
      window.__portfolioScene.setPaused(true);
      window.__portfolioScene.reset();
      const video = window.__studyVideos.find(video => video.src.includes('/__reference-study/motion.mp4'));
      if (!video) return { sources: window.__studyVideos.map(video=>video.src) };
      video.__studyFrozen = true;
      await new Promise(resolve => {
        video.addEventListener('seeked', resolve, { once:true });
        video.currentTime = 2;
      });
      return { sources:window.__studyVideos.map(video=>video.src), time:video.currentTime };
    });
    console.log('Frozen source', frozenSource);
    await snapshot(page, name);
    if (width > 900) assert.equal(await page.evaluate(()=>window.__portfolioScene.getDiagnostics().videoTime),2);
    const frozen = await pixels(page);
    await page.waitForTimeout(300);
    assert.equal(
      (await pixels(page)).hash,
      frozen.hash,
      "Pause must freeze image",
    );
    assert.equal(
      await page.evaluate(
        () => window.__portfolioScene.getDiagnostics().videoPaused,
      ),
      true,
    );
    if (name === "desktop") {
      await page.mouse.move(1150, 420);
      await page.mouse.down();
      await page.mouse.move(1250, 450, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(100);
      assert.notEqual(
        (await pixels(page)).hash,
        frozen.hash,
        "Drag changes portrait parallax",
      );
      await page.evaluate(() => window.__portfolioScene.reset());
      await page.waitForTimeout(500);
      assert.ok(
        (await page.evaluate(
          () => window.__portfolioScene.getDiagnostics().videoTime,
        )) < 0.1,
        "Reset seeks to first frame",
      );
      const neutral = await pixels(page);
      await page.evaluate(() => {
        window.__portfolioScene.setPaused(false);
        window.__portfolioScene.setScrollProgress(1);
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => window.__portfolioScene.setPaused(true));
      assert.equal((await pixels(page)).hash, neutral.hash, 'Scroll must not dissolve the reference portrait into invented states');
      await page.evaluate(() => window.__portfolioScene.setPaused(false));
      await page.mouse.move(1180,420);
      await page.mouse.move(1230,470,{steps:5});
      const cursor = await page.evaluate(() => {
        // Sample in the same task so software-rendering delays cannot outlast the effect.
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1180, clientY: 420, pointerType: 'mouse' }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1230, clientY: 470, pointerType: 'mouse' }));
        return window.__portfolioScene.getDiagnostics().cursorField;
      });
      assert.ok(cursor.energy > 0, 'Movement adds cursor energy before it decays');
      await page.waitForTimeout(200);
      await snapshot(page,'cursor-field');
      assert.notEqual((await pixels(page)).hash,neutral.hash,'Pointer field must visibly react with the video frozen');
      const portraitPixels = await pixels(page);
      await page.locator('[data-mode="security"]').click();
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(
          () => window.__portfolioScene.getDiagnostics().mode,
        ),
        "security",
      );
      assert.notEqual((await pixels(page)).hash, portraitPixels.hash, 'Manual scan control must visibly change the image');
      await snapshot(page,'manual-scan');
      await page.locator('#work').evaluate(element=>element.scrollIntoView({behavior:'instant'}));
      await page.waitForFunction(()=>{
        const heading=document.querySelector('.section-heading-row');
        return heading.dataset.revealed==='true' && getComputedStyle(heading).opacity==='1';
      });
      assert.equal(await page.locator('.section-heading-row').evaluate(element=>getComputedStyle(element).transform),'none');
      await page.screenshot({path:`${output}/section-reveal.png`});
    }
    assert.equal(errors.length, 0, errors.join(", "));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    results.push({ name, diagnostics, first, second, errors });
    console.log(`${name}: portrait rendering and playback checks passed`);
    await page.close();
  }
  const production = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const requests=[];
  production.on('request',request=>requests.push(request.url()));
  await production.goto('http://127.0.0.1:4176/?renderer=portrait&calibration=reference',{waitUntil:'networkidle'});
  await production.waitForFunction(()=>window.__portfolioScene?.getDiagnostics().ready);
  const productionState=await production.evaluate(()=>window.__portfolioScene.getDiagnostics());
  assert.equal(productionState.source,'/portrait-fallback.png');
  assert.equal(productionState.videoSource,null);
  assert.equal(productionState.paused,true);
  assert.equal(requests.some(url=>url.includes('/__reference-study/')),false,'Reference media must never load in production');
  assert.ok((await pixels(production)).count>1000,'Owned portrait must render in the production build');
  await production.screenshot({path:`${output}/production-owned-portrait.png`});
  await production.close();
  results.push({name:'production-safety',diagnostics:productionState});
  console.log('Production asset isolation and reduced motion: passed');
} finally {
  await writeFile(
    `${output}/verification.json`,
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
