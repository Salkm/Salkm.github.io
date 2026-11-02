export const stations = [
  {
    id: "detect",
    number: "01",
    title: "Detect",
    icon: "radar",
    x: -12,
    z: -1.1,
    description:
      "Receive the endpoint alert and preserve the original event, device identity and indicator context.",
  },
  {
    id: "orchestrate",
    number: "02",
    title: "Orchestrate",
    icon: "workflow",
    x: -6.8,
    z: -1.1,
    description:
      "Normalize the event, deduplicate it, check endpoint availability and evaluate the response policy.",
  },
  {
    id: "investigate",
    number: "03",
    title: "Investigate",
    icon: "scan-line",
    x: -1.5,
    z: -1.1,
    description:
      "Correlate hash reputation, signature, process behavior and endpoint evidence. Unknown is not a clean verdict.",
  },
  {
    id: "decision",
    number: "04",
    title: "Decide",
    icon: "git-branch",
    x: 3.1,
    z: -1.1,
    description:
      "Combine evidence and asset context with explicit policies. AI may summarize evidence; it does not authorize actions.",
  },
  {
    id: "benign",
    number: "05",
    title: "Benign",
    icon: "badge-check",
    x: 7.4,
    z: -5.8,
    description:
      "Close a supported false positive after analyst review. Do not create broad exclusions or allow rules automatically.",
  },
  {
    id: "review",
    number: "06",
    title: "Analyst review",
    icon: "user-round-check",
    x: 7.4,
    z: -0.9,
    description:
      "Uncertain evidence pauses the workflow. An analyst can authorize a scoped quarantine or escalate the incident.",
  },
  {
    id: "malware",
    number: "07",
    title: "Quarantine",
    icon: "file-lock-2",
    x: 7.4,
    z: 3.8,
    description:
      "After authorization, stop and quarantine the target file on a supported endpoint, then scan. Retain investigation evidence; a separate block rule is not implied.",
  },
  {
    id: "isolate",
    number: "08",
    title: "Isolation",
    icon: "shield-alert",
    x: 13.1,
    z: -1.4,
    description:
      "High-confidence active ransomware takes a pre-authorized emergency containment path, before waiting for enrichment or a scan.",
  },
  {
    id: "audit",
    number: "09",
    title: "Verify + audit",
    icon: "clipboard-check",
    x: 0.5,
    z: 7.4,
    description:
      "Confirm action completion, retain evidence, update the incident and notify its owner. Recovery and release need separate checks.",
  },
];

export const scenarios = {
  malware: {
    title: "Malware detected",
    severity: "High",
    file: "invoice-loader.exe",
    reputation: "Known malicious",
    signature: "Unsigned",
    behavior: "Suspicious child process",
    verdict: "Corroborated malware",
    outcome: "Remediated",
    policy:
      "Scoped file response pre-authorized. Retain evidence before response where feasible; quarantine is not an evidence backup.",
  },
  ransomware: {
    title: "Active ransomware",
    severity: "Critical",
    file: "encryptor-sim.exe",
    reputation: "Enrichment pending",
    signature: "Untrusted",
    behavior: "Mass file writes + recovery tampering",
    verdict: "High-confidence active attack",
    outcome: "Contained",
    policy:
      "Emergency isolation pre-authorized for this lab workstation. Release requires recovery approval.",
  },
  benign: {
    title: "Potential false positive",
    severity: "Low",
    file: "inventory-agent.exe",
    reputation: "Known internal application",
    signature: "Verified internal publisher",
    behavior: "Expected inventory activity",
    verdict: "Benign evidence; review required",
    outcome: "Closed as benign",
    policy:
      "Analyst confirms the evidence. No automatic exclusion or allow-list change.",
  },
  uncertain: {
    title: "Unclassified executable",
    severity: "Medium",
    file: "utility-unknown.exe",
    reputation: "Unknown / not previously seen",
    signature: "Unsigned",
    behavior: "Insufficient endpoint context",
    verdict: "Undetermined",
    outcome: "Contained for investigation",
    policy:
      "Unknown is not safe. Analyst approval is required before a scoped response.",
  },
};

const step = (id, node, title, description, duration = 4) => ({
  id,
  node,
  title,
  description,
  duration,
});
export function buildSteps(
  scenario,
  { online = true, resolution = null } = {},
) {
  if (!scenarios[scenario]) throw new Error(`Unknown scenario: ${scenario}`);
  const start = [
    step(
      "detect",
      "detect",
      "Endpoint alert received",
      "A fictional endpoint event enters the workflow. Source context and the event ID are preserved.",
    ),
    step(
      "orchestrate",
      "orchestrate",
      "Validate alert and response authority",
      "The AI automation workflow deduplicates the antivirus or SIEM alert and checks device identity, connectivity, supported actions, permissions and prior requests. Emergency ransomware isolation requires an existing policy that covers this workstation before execution.",
    ),
  ];
  if (!online)
    return [
      ...start,
      step(
        "offline",
        "audit",
        "Endpoint unreachable",
        "No endpoint action is marked successful. The failure is recorded and escalated to an analyst.",
        5,
      ),
    ];
  const investigation = step(
    "investigate",
    "investigate",
    "Correlate evidence with AI assistance",
    "AI structures the process tree, file reputation, signature and device context for review. Evidence content cannot authorize tools or override policy. Unknown reputation or a signature alone cannot establish a benign verdict.",
    5,
  );
  const decision = step(
    "decision",
    "decision",
    "Response policy evaluated",
    "The response follows explicit evidence thresholds, asset scope and authorization. It is not an autonomous AI decision.",
  );
  const quarantine = step(
    "quarantine",
    "malware",
    "Stop and quarantine target file",
    scenario === "uncertain"
      ? "Analyst-approved precautionary containment, not a malware verdict. Submit a scoped file action and monitor its result. The file remains under investigation; no allow or block rule is created."
      : "Submit the authorized stop-and-quarantine action for the identified file on the supported workstation. Retain available evidence and monitor the returned action until success; an accepted request is not completion.",
  );
  quarantine.completedTitle = "File response confirmed";
  const scan = step(
    "scan",
    "malware",
    "Run and verify antivirus scan",
    "Monitor the scan action until completion and review its result alongside endpoint telemetry. A clean scan alone does not prove recovery or establish that an unknown file is benign.",
    5,
  );
  scan.completedTitle = "Antivirus scan completed";
  const verify = step(
    "verify",
    "audit",
    scenario === "benign" ? "Verify benign closure evidence" : "Verify response results",
    scenario === "benign"
      ? "Check the analyst decision, expected process behavior and supporting evidence. No quarantine, isolation, scan or exclusion change was performed."
      : scenario === "uncertain"
        ? "Verify the approved containment action and scan results. Keep the investigation open: precautionary quarantine does not establish maliciousness or recovery."
        : "Check action status and the resulting endpoint state. Pending, failed, timed-out or cancelled actions must not be reported as success; they require investigation and escalation.",
  );
  const audit = step(
    "audit",
    "audit",
    "Record evidence and notify incident owner",
    scenario === "uncertain"
      ? "Record the analyst authorization, containment results and evidence. Assign further investigation; the incident remains open with an undetermined verdict."
      : scenario === "ransomware"
        ? "Record containment results and notify the incident owner. The incident remains open for recovery checks, with the workstation isolated until an authorized release."
        : "Record evidence, policy decisions, action results and closure rationale. Notify the incident owner. These are fictional results, not live endpoint actions.",
  );
  audit.completedTitle = "Response evidence recorded";
  if (scenario === "ransomware")
    return [
      ...start,
      { ...step(
        "isolate",
        "isolate",
        "Execute emergency isolation",
        "After the orchestration policy check, submit isolation for this in-scope workstation and monitor the action result. Verify management connectivity; VPN and product configuration can affect it. Investigation follows confirmed isolation, not a scan-first delay.",
        5,
      ), completedTitle: "Emergency isolation confirmed" },
      investigation,
      decision,
      quarantine,
      scan,
      {
        ...verify,
        description:
          "Isolation and remediation results are verified. The workstation remains isolated pending recovery checks and an authorized release.",
      },
      audit,
    ];
  if (scenario === "malware")
    return [...start, investigation, decision, quarantine, scan, verify, audit];
  const review = {
    ...step(
      "review",
      scenario === "benign" ? "benign" : "review",
      "Waiting for analyst decision",
      scenario === "benign"
        ? "The evidence supports an internal application. An analyst must confirm the benign classification before closure."
        : "Evidence is incomplete. The analyst can authorize a scoped quarantine for investigation or escalate without taking an endpoint action.",
    ),
    gate: true,
  };
  if (resolution === "escalated")
    return [
      ...start,
      investigation,
      decision,
      review,
      step(
        "escalated",
        "audit",
        "Escalated for investigation",
        "The analyst escalated this incident. No quarantine, block or isolation action was performed.",
        4,
      ),
    ];
  return [
    ...start,
    investigation,
    decision,
    review,
    ...(scenario === "uncertain" ? [quarantine, scan] : []),
    verify,
    audit,
  ];
}

export class IncidentRun {
  constructor({ scenario = "malware", online = true, running = true } = {}) {
    this.reset(scenario, online, running);
  }
  reset(scenario = this.scenario, online = this.online, running = false) {
    if (!scenarios[scenario]) throw new Error(`Unknown scenario: ${scenario}`);
    this.scenario = scenario;
    this.online = online;
    this.resolution = null;
    this.steps = buildSteps(scenario, { online });
    this.index = 0;
    this.elapsed = 0;
    this.waiting = false;
    this.complete = false;
    this.running = running;
    this.events = [
      {
        stage: this.current.id,
        node: this.current.node,
        title: this.current.title,
        status: "started",
      },
    ];
  }
  get current() {
    return this.steps[this.index];
  }
  get progress() {
    return this.complete
      ? 1
      : (this.index + this.elapsed / this.current.duration) / this.steps.length;
  }
  get outcome() {
    return !this.online
      ? "Escalated: endpoint offline"
      : this.resolution === "escalated"
        ? "Escalated: analyst investigation"
        : scenarios[this.scenario].outcome;
  }
  advance() {
    if (this.waiting || this.complete) return false;
    this.events[this.events.length - 1].status = "completed";
    this.events[this.events.length - 1].title = this.current.completedTitle || this.current.title;
    if (this.index === this.steps.length - 1) {
      this.complete = true;
      this.running = false;
      this.elapsed = this.current.duration;
      return true;
    }
    this.index++;
    this.elapsed = 0;
    this.events.push({
      stage: this.current.id,
      node: this.current.node,
      title: this.current.title,
      status: "started",
    });
    if (this.current.gate && !this.resolution) {
      this.waiting = true;
      this.running = false;
      this.events.at(-1).status = "awaiting approval";
    }
    return true;
  }
  tick(delta) {
    if (!this.running || this.waiting || this.complete) return false;
    if (!Number.isFinite(delta) || delta <= 0) return false;
    this.elapsed = Math.min(this.current.duration, this.elapsed + delta);
    if (this.elapsed >= this.current.duration) return this.advance();
    return false;
  }
  decide(resolution) {
    if (!this.waiting || !["approved", "escalated"].includes(resolution))
      return false;
    this.resolution = resolution;
    this.events.at(-1).decision = resolution;
    this.waiting = false;
    this.steps = buildSteps(this.scenario, { online: this.online, resolution });
    this.running = true;
    return this.advance();
  }
  toggle() {
    if (this.waiting) return;
    if (this.complete) this.reset(this.scenario, this.online, true);
    else this.running = !this.running;
  }
  snapshot() {
    return {
      scenario: this.scenario,
      online: this.online,
      resolution: this.resolution,
      stage: this.current.id,
      node: this.current.node,
      index: this.index,
      elapsed: this.elapsed,
      progress: this.progress,
      running: this.running,
      waiting: this.waiting,
      complete: this.complete,
      outcome: this.complete ? this.outcome : null,
      events: this.events.map((event) => ({ ...event })),
    };
  }
}
