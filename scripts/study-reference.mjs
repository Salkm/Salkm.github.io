import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = path.resolve(
  process.env.REFERENCE_OUTPUT || "artifacts/reference",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const report = [];
try {
  for (const [name, width, height] of [
    ["wide", 1900, 1000],
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.__studyVideos = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (this.__studyFrozen) return Promise.resolve();
        return play.call(this);
      };
      const create = Document.prototype.createElement;
      Document.prototype.createElement = function (name, ...args) {
        const element = create.call(this, name, ...args);
        if (String(name).toLowerCase() === "video")
          window.__studyVideos.push(element);
        return element;
      };
    });
    await page.goto("https://www.rubenmarcus.dev/", {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(7000);
    if (width > 900) {
      await page.waitForFunction(
        () => window.__studyVideos.some((v) => v.readyState >= 2),
        null,
        { timeout: 60000 },
      );
      await page.evaluate(async () => {
        const video = window.__studyVideos.find((v) => v.readyState >= 2);
        video.__studyFrozen = true;
        video.pause();
        await new Promise((resolve) => {
          video.addEventListener("seeked", resolve, { once: true });
          video.currentTime = 2;
        });
      });
      await page.evaluate(() => {
        const center = () => {
          const rect = document.querySelector('.hero-scan').getBoundingClientRect();
          window.dispatchEvent(new PointerEvent('pointermove', {clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2}));
        };
        center();
        window.__studyPointerTimer = setInterval(center, 100);
      });
      await page.waitForTimeout(1800);
    }
    await page.screenshot({
      path: path.join(output, `${name}-top.png`),
      timeout: 90000,
    });
    const data = await page.evaluate(() => {
      const selectors = [
        "header",
        "nav",
        "main",
        "section",
        "h1",
        "h2",
        "canvas",
        "main p",
        "main a",
      ];
      const elements = [
        ...new Set(selectors.flatMap((s) => [...document.querySelectorAll(s)])),
      ].map((el) => {
        const rect = el.getBoundingClientRect(),
          style = getComputedStyle(el);
        return {
          tag: el.tagName,
          id: el.id,
          class: String(el.className),
          text:
            el.tagName === "CANVAS" ? "" : el.textContent.trim().slice(0, 140),
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          font: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          position: style.position,
          color: style.color,
        };
      });
      return {
        title: document.title,
        elements,
        motion: window.__studyVideos.map((v) => ({
          source: v.currentSrc,
          width: v.videoWidth,
          height: v.videoHeight,
          time: v.currentTime,
          paused: v.paused,
        })),
        heroImages: [...document.images]
          .filter((i) => i.src.includes("hero"))
          .map((i) => ({
            source: i.src,
            rect: i.getBoundingClientRect().toJSON(),
            opacity: getComputedStyle(i).opacity,
          })),
        resources: performance
          .getEntriesByType("resource")
          .map((r) => ({ url: r.name, bytes: r.transferSize }))
          .filter((r) =>
            /glb|gltf|ktx|draco|\.js|woff|\.webp|\.png|\.jpg|\.mp4/.test(r.url),
          ),
        links: [...document.querySelectorAll("a[href]")].map((a) => ({
          text: a.textContent.trim().slice(0, 50),
          href: a.href,
        })),
      };
    });
    for (const y of [250, 500, 750, 1000, 1500]) {
      await page.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" }),
        y,
      );
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(output, `${name}-scroll-${y}.png`),
        timeout: 90000,
      });
    }
    report.push({ name, width, height, errors, ...data });
    console.log(
      `${name}: reference captured (${data.resources.length} resources)`,
    );
    await page.close();
  }
} finally {
  await writeFile(
    path.join(output, "measurements.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
