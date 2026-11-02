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
import { createAccountResponseScene } from './account-response-scene.js';

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
let accountResponseScene;

function accountResponseMarkup(project) {
  return `
    <section class="response-case" data-response-case>
      <header class="response-hero">
        <div class="response-hero__meta"><span>${project.label}</span><span>INTERACTIVE CASE STUDY</span></div>
        <h2 id="dialog-title">${project.name}</h2>
        <p class="response-hero__lede">An analyst-gated identity response that turns a high-confidence risk signal into controlled, fully evidenced containment.</p>
        <div class="response-metrics" aria-label="Project outcomes">
          <div><strong>4 → 1</strong><span>consoles</span></div>
          <div><strong>&lt; 10 min</strong><span>containment</span></div>
          <div><strong>100%</strong><span>approval-gated</span></div>
          <div><strong>Full</strong><span>audit trail</span></div>
        </div>
      </header>

      <section class="response-lab" aria-labelledby="response-lab-title">
        <header class="response-lab__header">
          <div><p class="response-kicker">IDENTITY CONTAINMENT LAB</p><h3 id="response-lab-title">Trace signal → decision → action</h3></div>
          <div class="response-case-state"><span>CASE IAM-0247</span><strong data-case-state>READY</strong></div>
        </header>
        <div class="response-hologram">
          <canvas data-response-canvas tabindex="0" aria-label="Interactive 3D identity containment workflow. Drag to orbit, scroll to zoom, or select a station for details."></canvas>
          <div class="response-hologram__hud"><span>HOLOGRAPHIC / LIVE</span><span>DRAG TO ORBIT · SCROLL TO ZOOM · DOUBLE-CLICK TO RESET</span></div>
          <div class="response-hologram__detail" data-scene-detail><span>LIVE CASE / IAM-0247</span><strong>Compromised identity detected</strong><p>Select any station to inspect its role, or run the governed response.</p></div>
        </div>
        <div class="response-command">
          <span data-response-execution aria-disabled="true" hidden></span>
          <div class="response-command__status"><span>CASE CONTROL</span><strong data-response-announcement aria-live="polite">Run the scenario to prepare the analyst recommendation.</strong><small data-response-time>Awaiting analyst decision</small></div>
          <div class="response-command__buttons" data-response-decision>
            <button class="response-button response-button--primary" type="button" data-response-run>Run response ${icon("play")}</button>
            <button class="response-button response-button--approve" type="button" data-response-approve disabled>Approve containment</button>
            <button class="response-button response-button--reject" type="button" data-response-reject disabled>Reject</button>
            <button class="response-button" type="button" data-response-reset>Reset ${icon("rotate-ccw")}</button>
          </div>
          <div class="response-command__result" data-response-rejected hidden><strong>No containment</strong><span>Ticket closed · decision and reason logged</span></div>
        </div>
      </section>
      <footer class="response-footer"><p>${project.stack.join(" · ")} · Entra ID · ServiceDesk Plus</p><a class="button button-dark" href="mailto:mail2skm@icloud.com?subject=${encodeURIComponent(`Let's discuss: ${project.name}`)}">Discuss a similar workflow ${icon("arrow-up-right")}</a></footer>
    </section>`;
}

function initialiseAccountResponse() {
  const root = document.querySelector("[data-response-case]");
  if (!root) return;
  const state = root.querySelector("[data-case-state]");
  const announcement = root.querySelector("[data-response-announcement]");
  const approve = root.querySelector("[data-response-approve]");
  const reject = root.querySelector("[data-response-reject]");
  const execution = root.querySelector("[data-response-execution]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = root.querySelector("[data-response-canvas]");
  const sceneDetail = root.querySelector("[data-scene-detail]");
  try {
    accountResponseScene?.dispose();
    accountResponseScene = createAccountResponseScene({ canvas, onSelect: station => {
      sceneDetail.innerHTML = `<span>${station.number} / WORKFLOW STATION</span><strong>${station.title}</strong><p>${station.detail}</p>`;
    }});
  } catch (error) {
    canvas.parentElement.classList.add("is-fallback");
    canvas.setAttribute("aria-label", "3D preview unavailable. The accessible workflow remains available below.");
    console.warn("Identity response 3D scene unavailable:", error.message);
  }
  let timers = [];
  const after = (callback, delay) => {
    const timer = window.setTimeout(callback, reducedMotion ? 0 : delay);
    timers.push(timer);
  };
  const updateNode = (id, phase, label) => {
    const element = root.querySelector(`[data-response-node="${id}"]`);
    if (element) {
      element.dataset.phase = phase;
      element.querySelector("[data-node-status]").textContent = label;
    }
    accountResponseScene?.setNodePhase(id, phase);
  };
  const pulseConnector = (id) => root.querySelector(`[data-connector="${id}"]`)?.classList.add("is-active");
  const clearTimers = () => { timers.forEach(window.clearTimeout); timers = []; };
  const reset = () => {
    clearTimers();
    state.textContent = "READY";
    announcement.textContent = "Run the scenario to prepare the analyst recommendation.";
    approve.disabled = true;
    reject.disabled = true;
    execution.setAttribute("aria-disabled", "true");
    root.querySelector("[data-response-decision]").dataset.phase = "waiting";
    accountResponseScene?.setNodePhase("decision", "locked");
    accountResponseScene?.setNodePhase("audit", "locked");
    root.querySelector("[data-response-rejected]").hidden = true;
    root.querySelector("[data-response-time]").textContent = "Awaiting analyst decision";
    root.querySelectorAll("[data-connector]").forEach(item => item.classList.remove("is-active"));
    updateNode("alert", "ready", "Alert received");
    updateNode("recommendation", "waiting", "Waiting");
    ["trigger", "sessions", "password", "signin", "ticket"].forEach(id => updateNode(id, "locked", id === "sessions" || id === "password" || id === "signin" ? "Queued" : "Locked"));
  };
  root.querySelector("[data-response-run]").addEventListener("click", () => {
    reset();
    state.textContent = "ANALYSING";
    announcement.textContent = "Risk signal received. Pulling identity context.";
    updateNode("alert", "complete", "Alert received");
    pulseConnector("alert");
    after(() => {
      updateNode("recommendation", "running", "Scoring 87 / 100");
      announcement.textContent = "AI recommendation prepared from sign-in and session context.";
    }, 420);
    after(() => {
      updateNode("recommendation", "complete", "Contain recommended");
      pulseConnector("recommendation");
      root.querySelector("[data-response-decision]").dataset.phase = "active";
      accountResponseScene?.setNodePhase("decision", "running");
      state.textContent = "ANALYST REVIEW";
      announcement.textContent = "Automation paused. Analyst approval is required.";
      approve.disabled = false;
      reject.disabled = false;
      approve.focus({ preventScroll: true });
    }, 950);
  });
  approve.addEventListener("click", () => {
    clearTimers();
    approve.disabled = true;
    reject.disabled = true;
    root.querySelector("[data-response-decision]").dataset.phase = "approved";
    accountResponseScene?.setNodePhase("decision", "complete");
    execution.setAttribute("aria-disabled", "false");
    state.textContent = "CONTAINING";
    announcement.textContent = "Approved by analyst. Running three containment actions in parallel.";
    updateNode("trigger", "running", "Executing");
    pulseConnector("trigger");
    after(() => {
      updateNode("trigger", "complete", "Playbook started");
      ["sessions", "password", "signin"].forEach(id => updateNode(id, "running", "Running"));
    }, 360);
    after(() => {
      ["sessions", "password", "signin"].forEach(id => updateNode(id, "complete", "Complete"));
      pulseConnector("actions");
      updateNode("ticket", "running", "Writing evidence");
    }, 980);
    after(() => {
      updateNode("ticket", "complete", "Evidence captured");
      accountResponseScene?.setNodePhase("audit", "complete");
      root.querySelector("[data-response-time]").textContent = "Containment completed in 08:42";
      state.textContent = "CONTAINED";
      announcement.textContent = "Containment complete. The evidence trail is ready for review.";
    }, 1520);
  });
  reject.addEventListener("click", () => {
    clearTimers();
    approve.disabled = true;
    reject.disabled = true;
    root.querySelector("[data-response-decision]").dataset.phase = "rejected";
    accountResponseScene?.setNodePhase("decision", "rejected");
    root.querySelector("[data-response-rejected]").hidden = false;
    state.textContent = "CLOSED — NO ACTION";
    announcement.textContent = "Recommendation rejected. No containment ran; the reason was logged.";
  });
  root.querySelector("[data-response-reset]").addEventListener("click", reset);
  reset();
}

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
  if (["governance", "malware-triage"].includes(project.id)) {
    location.assign("./containment-lab.html");
    return;
  }
  projectTrigger = button;
  dialog.classList.toggle("account-response-dialog", project.id === "account-response");
  document.querySelector("#dialog-content").innerHTML =
    project.id === "account-response"
      ? accountResponseMarkup(project)
      : `<p class="eyebrow">${project.label}</p><h2 id="dialog-title">${project.name}</h2><p class="dialog-outcome">${project.outcome}</p><div class="dialog-story"><h3>The problem</h3><p>${project.problem}</p><h3>The approach</h3><p>${project.approach}</p><h3>The outcome</h3><p>${project.result}</p></div><p class="dialog-stack">${project.stack.join(" / ")}</p><a class="button button-dark" href="mailto:mail2skm@icloud.com?subject=${encodeURIComponent(`Let's discuss: ${project.name}`)}">Discuss a similar workflow ${icon("arrow-up-right")}</a>`;
  paintIcons();
  initialiseAccountResponse();
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
  accountResponseScene?.dispose();
  accountResponseScene = undefined;
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
