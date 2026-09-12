import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "@fontsource/uncut-sans/400.css";
import "@fontsource/uncut-sans/500.css";
import "@fontsource/uncut-sans/600.css";
import "@fontsource-variable/gabarito";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";
import "./responsive.css";
import "./hero.css";
import "./sections.css";
import {
  createIcons,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDown,
  ArrowUp,
  MoveUpRight,
  Menu,
  X,
  Workflow,
  ShieldCheck,
  Pause,
  Play,
  RotateCcw,
  Github,
  Linkedin,
  Copy,
  Check,
  MapPin,
  GitBranch,
  FileText,
  Users,
  ScanLine,
  Route,
  Radar,
  Fingerprint,
  Plus,
  ChevronRight,
} from "lucide";
import { services, projects, expertise, experience, certifications } from "./data.js";
import { createPageMotion } from "./page-motion.js";
import { createPageField } from "./page-field.js";
import { createHeroTerminal } from "./hero-terminal.js";
import { getOwnedPortraitRect } from './portrait-framing.js';

const icons = {
  ArrowUpRight,
  ArrowDownRight,
  ArrowDown,
  ArrowUp,
  MoveUpRight,
  Menu,
  X,
  Workflow,
  ShieldCheck,
  Pause,
  Play,
  RotateCcw,
  Github,
  Linkedin,
  Copy,
  Check,
  MapPin,
  GitBranch,
  FileText,
  Users,
  ScanLine,
  Route,
  Radar,
  Fingerprint,
  Plus,
  ChevronRight,
};
const paintIcons = () =>
  createIcons({ icons, attrs: { "stroke-width": 1.6, "aria-hidden": "true" } });
const icon = (name) => `<i data-lucide="${name}"></i>`;
const ticker = document.querySelector(".availability-track");
ticker.after(ticker.cloneNode(true));
const dialog = document.querySelector(".project-dialog");
let projectTrigger;

function renderProjects(filter = "all") {
  const visible = projects.filter(
    (project) => filter === "all" || project.category === filter,
  );
  document.querySelector("#project-list").innerHTML = visible
    .map(
      (project) => `
    <article class="project ${project.tone}">
      <button class="project-visual" data-project="${project.id}" aria-label="Explore ${project.name}">
        <span class="visual-header"><span>${project.label}</span><span>${String(projects.indexOf(project) + 1).padStart(2, "0")} / 06</span></span>
        <span class="workflow-line" aria-hidden="true">${project.steps.map((step, index) => `<span class="workflow-node"><span class="node-icon">${index === 1 ? icon("shield-check") : icon(index === 0 ? project.icon : "check")}</span><span>${step}</span></span>${index < 2 ? `<span class="workflow-connector">${icon("chevron-right")}</span>` : ""}`).join("")}</span>
        <span class="visual-footer"><span>${project.stack[0]} / ${project.stack[1]}</span><span class="visual-open">${icon("arrow-up-right")}</span></span>
      </button>
      <div class="project-body"><div class="project-outcome">${icon("arrow-up-right")}<strong>${project.outcome}</strong></div>
      <h3>${project.title}</h3><p class="project-summary">${project.summary}</p>
      <div class="project-bottom"><p>${project.stack.slice(0, 3).join(" / ")}</p><button class="project-open icon-button" data-project="${project.id}" aria-label="View ${project.name}" data-tooltip="View project">${icon("arrow-up-right")}</button></div></div>
    </article>`,
    )
    .join("");
  document.querySelector("#project-count").textContent =
    `${visible.length} projects shown`;
  paintIcons();
}
function selectProjectFilter(filter) {
  document.querySelectorAll('[data-filter]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  });
  renderProjects(filter);
}
document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => selectProjectFilter(button.dataset.filter));
});
document.querySelector('#service-list').innerHTML = services.map((service, index) => `
  <article class="service-card">
    <div class="service-marker">${icon(service.icon)}<span>${String(index + 1).padStart(2, '0')}</span></div>
    <h3>${service.title}</h3><p>${service.description}</p>
    <ul class="service-tags">${service.tags.map(tag => `<li>${tag}</li>`).join('')}</ul>
    <a class="service-link" href="#work" data-service-filter="${service.filter}">View work ${icon('arrow-up-right')}</a>
  </article>
`).join('');
document.querySelector('#service-list').addEventListener('click', event => {
  const link = event.target.closest('[data-service-filter]');
  if (link) selectProjectFilter(link.dataset.serviceFilter);
});
document.querySelector("#project-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-project]");
  if (!button) return;
  const project = projects.find((item) => item.id === button.dataset.project);
  projectTrigger = button;
  document.querySelector("#dialog-content").innerHTML =
    `<p class="eyebrow">${project.label}</p><h2 id="dialog-title">${project.name}</h2><p class="dialog-outcome">${project.outcome}</p><div class="dialog-story"><h3>The problem</h3><p>${project.problem}</p><h3>The approach</h3><p>${project.approach}</p><h3>The outcome</h3><p>${project.result}</p></div><p class="dialog-stack">${project.stack.join(" / ")}</p><a class="button button-dark" href="mailto:mail2skm@icloud.com?subject=${encodeURIComponent(`Let's discuss: ${project.name}`)}">Discuss a similar workflow ${icon("arrow-up-right")}</a>`;
  paintIcons();
  dialog.showModal();
  document.body.classList.add("dialog-open");
});
document
  .querySelector(".dialog-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    dialog.close();
});
dialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  projectTrigger?.focus();
});
document.querySelector('#expertise-list').innerHTML = `<ul class="stack-cloud" aria-label="Tools and expertise">${expertise.flatMap(group => group.tools).map(tool => `<li>${tool}</li>`).join('')}</ul>`;
document.querySelector("#experience-list").innerHTML = experience
  .map(
    (job, index) =>
      `<details class="experience-item" ${index === 0 ? "open" : ""}><summary><span class="experience-date">${job.dates}</span><span class="experience-main"><strong>${job.company}</strong><span>${job.role}</span></span>${icon("plus")}</summary><div class="experience-detail"><p>${job.details}</p><span>${job.location}</span></div></details>`,
  )
  .join("");
document.querySelector("#certifications").innerHTML = certifications
  .map((certification) => `<li>${certification}</li>`)
  .join("");
document.querySelector("#year").textContent = new Date().getFullYear();
renderProjects();

const menuToggle = document.querySelector(".menu-toggle");
const mobileNav = document.querySelector("#mobile-nav");
function setMenu(open) {
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  menuToggle.innerHTML = icon(open ? "x" : "menu");
  mobileNav.hidden = !open;
  paintIcons();
}
menuToggle.addEventListener("click", () => setMenu(mobileNav.hidden));
window.matchMedia('(max-width: 760px)').addEventListener('change', () => setMenu(false));
mobileNav
  .querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !mobileNav.hidden) {
    setMenu(false);
    menuToggle.focus();
  }
});
document.addEventListener("click", (event) => {
  const path = event.composedPath();
  if (
    !mobileNav.hidden &&
    !path.includes(mobileNav) &&
    !path.includes(menuToggle)
  )
    setMenu(false);
});

let toastTimer;
function toast(message) {
  const element = document.querySelector(".toast");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 3200);
}
document.querySelector(".copy-email").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("mail2skm@icloud.com");
    toast("Email address copied.");
  } catch {
    toast("Email: mail2skm@icloud.com");
  }
});
const sectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      document.querySelectorAll(".desktop-nav a").forEach((link) => {
        if (link.hash === `#${entry.target.id}`)
          link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }
  },
  { rootMargin: "-15% 0px -55% 0px" },
);
document
  .querySelectorAll("main > section[id], .expertise-block[id]")
  .forEach((section) => sectionObserver.observe(section));

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const pageField = createPageField(document.querySelector('#page-field'));
const pageMotion = createPageMotion({ reducedMotion: motionPreference.matches });
const terminal = createHeroTerminal(document.querySelector('.code-atmosphere'), document.querySelector('#specialty'), { reducedMotion: motionPreference.matches });
window.__portfolioTerminal = terminal;
let atmosphere;
let pageActive = true;
const toggle = document.querySelector(".scene-toggle");
const reset = document.querySelector(".scene-reset");
const hero = document.querySelector(".hero");
const fallback = document.querySelector('.scene-fallback');
const fallbackResize = new ResizeObserver(() => {
  if (hero.dataset.renderer !== 'portrait' || !fallback.clientWidth || !fallback.clientHeight) return;
  const rect = getOwnedPortraitRect(fallback.clientWidth, fallback.clientHeight, innerWidth <= 900);
  const image = fallback.querySelector('img');
  for (const property of ['left', 'top', 'width', 'height']) image.style[property] = `${rect[property]}px`;
});
fallbackResize.observe(fallback);
let scene;
let scenePaused = motionPreference.matches;
let sceneMode = "automation";
function updateMotionButton() {
  pageMotion.setPaused(scenePaused);
  terminal.setPaused(scenePaused);
  atmosphere?.setPaused(scenePaused);
  document.body.dataset.motion = scenePaused ? "paused" : "playing";
  toggle.setAttribute(
    "aria-label",
    scenePaused ? "Play animation" : "Pause animation",
  );
  toggle.dataset.tooltip = scenePaused ? "Play animation" : "Pause animation";
  toggle.innerHTML = icon(scenePaused ? "play" : "pause");
  paintIcons();
}
toggle.disabled = true;
reset.disabled = true;
updateMotionButton();
toggle.addEventListener("click", () => {
  scenePaused = !scenePaused;
  if (!scenePaused) {
    scene?.setReducedMotion(false);
    terminal.setReducedMotion(false);
    atmosphere?.setReducedMotion(false);
  }
  scene?.setPaused(scenePaused);
  updateMotionButton();
});
reset.addEventListener("click", () => { scene?.reset(); terminal.reset(); atmosphere?.reset(); });
document.querySelectorAll("[data-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    sceneMode = button.dataset.mode;
    document
      .querySelectorAll("[data-mode]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
    scene?.setMode(sceneMode);
  }),
);
motionPreference.addEventListener("change", (event) => {
  pageMotion.setReducedMotion(event.matches);
  terminal.setReducedMotion(event.matches);
  atmosphere?.setReducedMotion(event.matches);
  scenePaused = event.matches;
  scene?.setReducedMotion(event.matches);
  scene?.setPaused(scenePaused);
  updateMotionButton();
});
async function initScene() {
  try {
    const parameters = new URLSearchParams(location.search);
    const portraitStudy = parameters.get("renderer") !== "character";
    const calibration =
      import.meta.env.DEV &&
      __REFERENCE_STUDY_AVAILABLE__ &&
      portraitStudy &&
      parameters.get("calibration") === "reference";
    hero.dataset.renderer = portraitStudy ? "portrait" : "character";
    hero.dataset.identity = calibration ? 'reference' : 'saleem';
    if (calibration) document.querySelector('#hero-canvas').setAttribute('aria-label', 'Reference portrait for private visual comparison');
    const { createPortfolioScene } = portraitStudy
      ? await import("./portrait-scene.js")
      : await import("./scene.js");
    scene = await createPortfolioScene({
      canvas: document.querySelector("#hero-canvas"),
      ...(portraitStudy
        ? {
            source: calibration
              ? "/__reference-study/portrait.png"
              : "/portrait-fallback.png",
            videoSource: calibration ? "/__reference-study/motion.mp4" : "/portrait-typing.mp4",
            videoOnMobile: false,
            ownedVideoFraming: !calibration,
            bakedScan: calibration,
          }
        : {}),
      reducedMotion: motionPreference.matches,
      onReady: () => {
        hero.dataset.scene = "ready";
      },
    });
    scene.setMode(sceneMode);
    if (scene.getDiagnostics().error)
      throw new Error(scene.getDiagnostics().error);
    scene.setPaused(scenePaused);
    scene.setScrollProgress?.(
      Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.65))),
    );
    hero.dataset.scene = "ready";
    toggle.disabled = false;
    reset.disabled = false;
    window.__portfolioScene = scene;
  } catch (error) {
    scene?.dispose();
    hero.dataset.scene = "fallback";
    scenePaused = true;
    updateMotionButton();
    console.warn(
      "The 3D scene is unavailable; the portrait fallback is active.",
      error,
    );
  }
}
initScene();
async function initAtmosphere() {
  try {
    const { createAtmosphere } = await import('./atmosphere.js');
    if (!pageActive) return;
    atmosphere = createAtmosphere({ gridCanvas: document.querySelector('#hero-grid'), flowCanvas: document.querySelector('#ambient-flow'), reducedMotion: motionPreference.matches });
    atmosphere.setPaused(scenePaused);
    window.__portfolioAtmosphere = atmosphere;
  } catch (error) { console.warn('Atmospheric background unavailable', error); }
}
initAtmosphere();
const studioClock = document.querySelector("#local-time");
function updateStudioClock() {
  studioClock.textContent = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}
updateStudioClock();
setInterval(updateStudioClock, 60000);
let scrollFrame;
window.addEventListener(
  "scroll",
  () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      document.body.dataset.scrolled = window.scrollY > 20 ? "true" : "false";
      scene?.setScrollProgress?.(
        Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.65))),
      );
    });
  },
  { passive: true },
);
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    pageActive = false;
    scene?.dispose();
    pageMotion.dispose();
    pageField.dispose();
    terminal.dispose();
    atmosphere?.dispose();
    fallbackResize.disconnect();
  }
});
