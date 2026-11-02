import "./lab.css";
import {
  createIcons,
  ArrowUpLeft,
  ArrowUpRight,
  FileWarning,
  ShieldAlert,
  BadgeCheck,
  UserRoundSearch,
  UserRoundCheck,
  ShieldCheck,
  Download,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  Plus,
  Minus,
  Scan,
  Maximize,
  Minimize,
  LocateFixed,
  Radar,
  Workflow,
  ScanLine,
  GitBranch,
  FileLock2,
  ClipboardCheck,
  RefreshCw,
} from "lucide";
import { IncidentRun, scenarios, stations } from "./workflow.js";

const icons = {
  ArrowUpLeft,
  ArrowUpRight,
  FileWarning,
  ShieldAlert,
  BadgeCheck,
  UserRoundSearch,
  UserRoundCheck,
  ShieldCheck,
  Download,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  Plus,
  Minus,
  Scan,
  Maximize,
  Minimize,
  LocateFixed,
  Radar,
  Workflow,
  ScanLine,
  GitBranch,
  FileLock2,
  ClipboardCheck,
  RefreshCw,
};
const $ = (selector) => document.querySelector(selector);
const paintIcons = () =>
  createIcons({ icons, attrs: { "stroke-width": 1.6, "aria-hidden": "true" } });
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const run = new IncidentRun({ running: !reducedMotion.matches });
let scene = null,
  selectedStation = null,
  speed = 1,
  motion = !reducedMotion.matches,
  disposed = false,
  initializing = false,
  rendererRecoveryAttempts = 0,
  rendererRecoveryTimer = null;
let source = "antivirus",
  animationFrame,
  previous = performance.now(),
  lastPaint = 0;
const sources = {
  antivirus: { name: "Antivirus solution", code: "AV" },
  siem: { name: "SIEM", code: "SIEM" },
  endpoint: { name: "Endpoint detection", code: "EDR" },
};
const sourceName = () => sources[source].name;
const incidentId = () =>
  `SIM-${sources[source].code}-${Object.keys(scenarios).indexOf(run.scenario) + 2401}`;
$("#motion-enabled").checked = motion;
$("#station-directory").innerHTML = stations
  .map(
    (s) =>
      `<button data-inspect="${s.id}" aria-pressed="false"><i data-lucide="${s.icon}"></i>${s.title}</button>`,
  )
  .join("");

function inspectStation(id) {
  if (!stations.some((s) => s.id === id)) return;
  selectedStation = id;
  render();
}
function renderEvidence() {
  const scenario = scenarios[run.scenario];
  const hash =
    run.scenario === "benign"
      ? "4be1...c918"
      : run.scenario === "ransomware"
        ? "f941...8a36"
        : run.scenario === "uncertain"
          ? "90df...0bc1"
          : "7ac4...e281";
  const evidence = [
    ["Source", sourceName()],
    ["File", scenario.file],
    ["SHA-256", `${hash} (sample)`],
    [
      "Reputation",
      run.scenario === "ransomware" && run.events.some(e => e.stage === "investigate" && e.status === "completed")
        ? "Corroborated threat indicators"
        : scenario.reputation,
    ],
    ["Signature", scenario.signature],
    ["Behavior", scenario.behavior],
    ["AI assessment", run.events.some(e => e.stage === "investigate" && e.status === "completed") ? scenario.verdict : "Awaiting evidence correlation"],
  ];
  $("#evidence-list").innerHTML = evidence
    .map(
      ([label, value]) =>
        `<div><dt>${label}</dt><dd${label === "File" || label === "SHA-256" ? ' class="mono"' : ""}>${value}</dd></div>`,
    )
    .join("");
}
function render() {
  const state = run.snapshot(),
    scenario = scenarios[run.scenario],
    current = run.current;
  const station = stations.find(
    (s) => s.id === (selectedStation || current.node),
  );
  document.body.dataset.incidentScenario = run.scenario;
  $("#incident-id").textContent = incidentId();
  $("#incident-title").textContent = scenario.title;
  $("#severity").textContent = scenario.severity.toUpperCase();
  $("#severity").dataset.level = scenario.severity;
  $("#endpoint-name").textContent = run.online
    ? "LAB-WKS-042"
    : "LAB-WKS-042 / OFFLINE";
  $("#inspector-kicker").textContent = selectedStation
    ? `STATION ${station.number}`
    : run.complete
      ? "FINAL STATUS"
      : "CURRENT STAGE";
  $("#stage-title").textContent = selectedStation
    ? station.title
    : run.complete
      ? run.outcome
      : current.title;
  $("#stage-description").textContent = selectedStation
    ? station.description
    : current.description;
  $("#follow-stage").hidden = !selectedStation;
  $("#approval-gate").hidden = !run.waiting;
  $("#approve-action").textContent =
    run.scenario === "benign" ? "Confirm benign" : "Approve quarantine";
  $("#policy-note").textContent = run.online
    ? scenario.policy
    : "The endpoint is offline. Response actions require confirmed connectivity; escalate instead of claiming success.";
  $("#action-log").innerHTML = run.events
    .map(
      (event) =>
        `<li data-status="${event.status}">${event.title}<span>${event.decision ? `Analyst: ${event.decision}` : event.status}</span></li>`,
    )
    .join("");
  $("#active-stage-number").textContent = stations.find(
    (s) => s.id === current.node,
  ).number;
  $("#active-stage-caption").textContent = run.complete
    ? run.outcome
    : current.title;
  $("#play-pause").innerHTML =
    `<i data-lucide="${run.running ? "pause" : run.complete ? "rotate-ccw" : "play"}"></i><span>${run.running ? "Pause" : run.complete ? "Replay" : "Play"}</span>`;
  $("#play-pause").setAttribute(
    "aria-label",
    run.running
      ? "Pause incident"
      : run.complete
        ? "Replay incident"
        : "Play incident",
  );
  $("#play-pause").disabled = run.waiting;
  $("#next-step").disabled = run.waiting || run.complete;
  $("#playback-status").textContent = run.waiting
    ? "Awaiting analyst decision"
    : run.complete
      ? run.outcome
      : run.running
        ? "Incident in progress"
        : "Incident paused";
  $("#step-counter").textContent = `${run.index + 1} / ${run.steps.length}`;
  $("#incident-progress").value = run.progress;
  document
    .querySelectorAll("[data-scenario]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.scenario === run.scenario),
      ),
    );
  document
    .querySelectorAll("[data-inspect]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.inspect === (selectedStation || current.node)),
      ),
    );
  $("#lab-announcement").textContent = run.complete
    ? run.outcome
    : current.title;
  renderEvidence();
  scene?.setState(state, selectedStation);
  scene?.setPaused(!motion);
  paintIcons();
}
function reset({
  scenario = run.scenario,
  online = run.online,
  running = !reducedMotion.matches,
} = {}) {
  run.reset(scenario, online, running);
  selectedStation = null;
  render();
}
document
  .querySelectorAll("[data-scenario]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      reset({ scenario: button.dataset.scenario }),
    ),
  );
$("#source").addEventListener("change", (event) => {
  source = event.target.value;
  reset();
});
$("#endpoint-online").addEventListener("change", (event) =>
  reset({ online: event.target.checked }),
);
$("#station-directory").addEventListener("click", (event) => {
  const button = event.target.closest("[data-inspect]");
  if (button) inspectStation(button.dataset.inspect);
});
$("#follow-stage").addEventListener("click", () => {
  selectedStation = null;
  render();
});
$("#play-pause").addEventListener("click", () => {
  run.toggle();
  render();
});
$("#restart").addEventListener("click", () => reset({ running: true }));
$("#next-step").addEventListener("click", () => {
  run.running = false;
  run.advance();
  render();
});
$("#playback-speed").addEventListener("change", (event) => {
  speed = Number(event.target.value);
});
$("#motion-enabled").addEventListener("change", (event) => {
  motion = event.target.checked;
  render();
});
$("#approve-action").addEventListener("click", () => {
  run.decide("approved");
  selectedStation = null;
  render();
});
$("#escalate-action").addEventListener("click", () => {
  run.decide("escalated");
  selectedStation = null;
  render();
});
$("#zoom-in").addEventListener("click", () => scene?.zoom(0.12));
$("#zoom-out").addEventListener("click", () => scene?.zoom(-0.12));
$("#reset-view").addEventListener("click", () => scene?.reset());
$("#fullscreen").hidden = !document.fullscreenEnabled;
$("#fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("#lab-workspace").requestFullscreen();
  } catch {
    $("#lab-announcement").textContent =
      "Fullscreen is unavailable in this browser.";
  }
});
document.addEventListener("fullscreenchange", () => {
  const active = Boolean(document.fullscreenElement);
  $("#fullscreen").innerHTML =
    `<i data-lucide="${active ? "minimize" : "maximize"}"></i>`;
  $("#fullscreen").setAttribute(
    "aria-label",
    active ? "Exit fullscreen" : "Enter fullscreen",
  );
  paintIcons();
});
$("#download-audit").addEventListener("click", () => {
  const audit = {
    notice:
      "SIMULATED INCIDENT. Fictional evidence and response actions. No live endpoint action was performed.",
    incidentId: incidentId(),
    source: sourceName(),
    endpoint: "LAB-WKS-042",
    ...run.snapshot(),
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${incidentId()}-simulated-audit.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
reducedMotion.addEventListener("change", (event) => {
  motion = !event.matches;
  $("#motion-enabled").checked = motion;
  if (event.matches) run.running = false;
  render();
});
function showFallback(error) {
  scene?.dispose();
  scene = null;
  console.warn("Containment Lab renderer unavailable:", error.message);
  $("#scene-fallback").hidden = false;
  $("#station-labels").hidden = true;
  $("#scene-state").textContent = "STATIC REFERENCE";
  ["#zoom-in", "#zoom-out", "#reset-view"].forEach((id) => {
    $(id).disabled = true;
  });
  // A WebGL context can be briefly interrupted while the browser changes GPU state.
  // Retry once automatically, then leave the explicit Retry 3D control available.
  if (!disposed && rendererRecoveryAttempts < 1) {
    rendererRecoveryAttempts += 1;
    $("#scene-state").textContent = "RECOVERING 3D";
    clearTimeout(rendererRecoveryTimer);
    rendererRecoveryTimer = setTimeout(initScene, 650);
  }
}
async function initScene() {
  if (initializing || disposed) return;
  initializing = true;
  $("#scene-state").textContent = "INITIALIZING SCENE";
  ["#zoom-in", "#zoom-out", "#reset-view"].forEach((id) => {
    $(id).disabled = true;
  });
  try {
    scene?.dispose();
    scene = null;
    const { createLabScene } = await import("./scene.js");
    if (disposed) return;
    const candidate = await createLabScene({
      canvas: $("#lab-canvas"),
      labels: $("#station-labels"),
      onSelect: inspectStation,
      onError: showFallback,
    });
    if (disposed) { candidate.dispose(); return; }
    scene = candidate;
    rendererRecoveryAttempts = 0;
    $("#scene-fallback").hidden = true;
    $("#station-labels").hidden = false;
    $("#scene-state").textContent = "HOLOGRAPHIC / LIVE";
    ["#zoom-in", "#zoom-out", "#reset-view"].forEach((id) => {
      $(id).disabled = false;
    });
    render();
  } catch (error) {
    showFallback(error);
  } finally {
    initializing = false;
  }
}
$("#retry-renderer").addEventListener("click", initScene);
function animate(now) {
  if (disposed) return;
  const delta = Math.min(0.25, (now - previous) / 1000);
  previous = now;
  if (!document.hidden) {
    if (run.tick(delta * speed)) render();
    else if (now - lastPaint > 120) {
      $("#incident-progress").value = run.progress;
      lastPaint = now;
    }
  }
  animationFrame = requestAnimationFrame(animate);
}
document.addEventListener("visibilitychange", () => {
  previous = performance.now();
});
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    disposed = true;
    clearTimeout(rendererRecoveryTimer);
    cancelAnimationFrame(animationFrame);
    scene?.dispose();
  }
});
window.__containmentLab = {
  getDiagnostics: () => ({
    ...run.snapshot(),
    selectedStation,
    source,
    view: "interactive",
    motion,
    speed,
    scene: scene?.getDiagnostics() || null,
    fallback: !$("#scene-fallback").hidden,
  }),
};
render();
initScene();
animationFrame = requestAnimationFrame(animate);
