export const services = [
  {
    title: "AI & workflow automation",
    description: "Connect your tools with n8n, APIs, and AI agents. Replace repetitive steps with clear workflows and human approval where it matters.",
    tags: ["n8n", "AI agents", "APIs"],
    icon: "workflow",
    filter: "automation",
  },
  {
    title: "Security orchestration",
    description: "Connect security alerts, enrichment, and containment in one governed workflow, with analyst approval and a complete action trail.",
    tags: ["Sentinel", "Defender XDR", "Graph API"],
    icon: "shield-check",
    filter: "security",
  },
  {
    title: "AI-assisted reporting",
    description: "Turn investigation evidence into structured summaries and reports, with controlled prompts and analyst review before delivery.",
    tags: ["Claude", "GPT", "Reporting"],
    icon: "file-text",
    filter: "ai",
  },
];

export const projects = [
  {
    id: "account-response",
    category: "security",
    label: "SECURITY ORCHESTRATION",
    icon: "shield-check",
    title: "From compromised account to contained incident.",
    name: "Compromised Account Response Orchestrator",
    summary:
      "One governed workflow replaces manual work across four security consoles.",
    outcome: "Containment in under 10 minutes",
    stack: ["n8n", "Microsoft Sentinel", "Defender XDR", "Graph API"],
    steps: ["Detect", "Approve", "Contain"],
    tone: "coral",
    problem:
      "Responding to an identity compromise meant up to an hour of manual work across four consoles.",
    approach:
      "Connected Sentinel, Defender XDR, Entra ID, Microsoft Graph API and ServiceDesk Plus through n8n. An analyst approval gate separates the decision from execution, with every containment action logged.",
    result:
      "Reduced compromised-account containment to under 10 minutes while retaining analyst approval and an auditable action trail.",
  },
  {
    id: "ai-reports",
    category: "ai",
    label: "AI-ASSISTED REPORTING",
    icon: "file-text",
    title: "Clear incident reports. Less time writing them.",
    name: "AI-Assisted Incident Summaries & Reports",
    summary:
      "Raw investigation evidence becomes structured reporting, ready for analyst review.",
    outcome: "70% less reporting effort",
    stack: ["n8n", "Claude", "GPT", "Structured prompts"],
    steps: ["Evidence", "Draft", "Review"],
    tone: "mint",
    problem: "Incident reporting consumed roughly 15 analyst hours each month.",
    approach:
      "Used controlled prompts and agentic steps to structure raw evidence into summaries and reports. Mandatory analyst review remains in place before a report is used or shared.",
    result:
      "Reduced reporting effort by 70%, with people responsible for the final review.",
  },
  {
    id: "governance",
    category: "automation",
    label: "AUTOMATION GOVERNANCE",
    icon: "git-branch",
    title: "Automation with accountability built in.",
    name: "Automation Governance Framework",
    summary:
      "A reusable control pattern for approval, execution, and audit logging.",
    outcome: "Human judgment at the decision point",
    stack: ["n8n", "Approval gates", "Audit logging"],
    steps: ["Request", "Approve", "Audit"],
    tone: "mint",
    problem:
      "High-risk security actions need clear ownership, traceability, and controlled access as automation expands.",
    approach:
      "Designed a shared pattern for human-in-the-loop approval, separate approval and execution steps, scoped credentials, and full audit logging. Secrets stay outside content stores.",
    result:
      "A governance foundation used by other security workflows, so automated execution remains accountable.",
  },
  {
    id: "bulk-remediation",
    category: "automation",
    label: "BATCH REMEDIATION",
    icon: "users",
    title: "One approved response. Across every affected user.",
    name: "Bulk Compromised Users CSV Remediation",
    summary:
      "A whole set of compromised users moves through one approved, auditable pass.",
    outcome: "Up to 90% fewer manual steps",
    stack: ["n8n", "Microsoft Graph API", "CSV"],
    steps: ["Import", "Approve", "Remediate"],
    tone: "coral",
    problem:
      "During mass-compromise events, analysts repeated the same response steps for each affected user.",
    approach:
      "Built batch remediation from a CSV input through n8n and Microsoft Graph API, keeping approval and auditability in the process.",
    result:
      "Removed up to 90% of manual remediation steps across the affected user set.",
  },
  {
    id: "malware-triage",
    category: "security",
    label: "ALERT ENRICHMENT",
    icon: "scan-line",
    title: "Better context before the investigation begins.",
    name: "Malware Alert Response Workflow",
    summary:
      "Endpoint and indicator context become a consistent first-pass triage summary.",
    outcome: "Consistent, investigation-ready context",
    stack: ["n8n", "Defender XDR", "Threat intelligence"],
    steps: ["Alert", "Enrich", "Investigate"],
    tone: "coral",
    problem:
      "First-pass triage varied depending on which analyst picked up an alert.",
    approach:
      "Automated enrichment using Defender XDR and threat intelligence APIs, combining endpoint and indicator context into an investigation-ready summary.",
    result:
      "A consistent starting point for analysts before they open the case.",
  },
  {
    id: "vulnerability-routing",
    category: "automation",
    label: "VULNERABILITY OPERATIONS",
    icon: "route",
    title: "Get findings to the people who can fix them.",
    name: "Vulnerability Assessment Findings Automation",
    summary:
      "Enrichment, routing, and tracking connect security findings to remediation owners.",
    outcome: "Measurable remediation follow-through",
    stack: ["n8n", "Qualys", "Workflow routing"],
    steps: ["Find", "Route", "Track"],
    tone: "mint",
    problem:
      "Vulnerability findings stalled between the scan and the owner responsible for remediation.",
    approach:
      "Connected Qualys findings to automated enrichment, ownership routing, and tracking through n8n.",
    result:
      "Remediation follow-through can be measured instead of depending on repeated manual chasing.",
  },
];
export const expertise = [
  {
    icon: "workflow",
    title: "AI & automation",
    tools: [
      "n8n",
      "AI agents",
      "ChatGPT / Claude / Gemini",
      "APIs & webhooks",
      "Prompt engineering",
      "Lovable",
      "JavaScript",
    ],
  },
  {
    icon: "shield-check",
    title: "Microsoft security",
    tools: [
      "Microsoft Sentinel",
      "Defender XDR",
      "Microsoft Entra ID",
      "Microsoft Graph API",
      "Microsoft Intune",
      "Microsoft 365 Security",
    ],
  },
  {
    icon: "radar",
    title: "Detection & response",
    tools: [
      "KQL & threat hunting",
      "ArcSight / Splunk",
      "FortiSOAR",
      "EDR & incident response",
      "Threat intelligence",
      "Malware analysis",
    ],
  },
  {
    icon: "fingerprint",
    title: "Risk & governance",
    tools: [
      "Approval workflows",
      "Qualys",
      "Remediation governance",
      "ISO/IEC 27001",
      "NESA",
      "Audit support",
    ],
  },
];
export const experience = [
  {
    company: "Khalifa University",
    role: "Cybersecurity Specialist",
    dates: "Nov 2022 - Present",
    location: "Abu Dhabi, UAE",
    details:
      "Senior technical escalation point for high-severity incidents across approximately 5,000 users, 6,000 endpoints, and 500 servers. Leads Level 3 response for around 1,500 alerts each month and builds governed n8n security automations.",
  },
  {
    company: "Etisalat",
    role: "Senior SOC & Cybersecurity Engineer",
    dates: "Jun 2017 - Oct 2022",
    location: "Abu Dhabi, UAE",
    details:
      "Led triage, containment, and stakeholder communication for high-impact incidents. Optimized ArcSight, Sentinel, and Splunk with correlation rules, dashboards, and threat-hunting content.",
  },
  {
    company: "Wipro Infotech",
    role: "IT Security Engineer - SOC",
    dates: "Dec 2015 - Jun 2017",
    location: "Abu Dhabi, UAE",
    details:
      "Monitored and investigated enterprise SOC threats, supporting use-case tuning, evidence collection, and validated escalation.",
  },
  {
    company: "Implemer Technologies",
    role: "Network Support Engineer",
    dates: "Nov 2014 - Sep 2015",
    location: "Qatar & India",
    details:
      "Provided network support, secure connectivity, and troubleshooting across customer environments.",
  },
  {
    company: "Amiantit Oman Co. LLC",
    role: "Technical Support Engineer",
    dates: "Jul 2012 - Sep 2014",
    location: "Muscat, Oman",
    details:
      "Supported enterprise systems, networks, and business applications with a focus on service continuity.",
  },
  {
    company: "Thoughts Technologies",
    role: "System Engineer",
    dates: "Oct 2010 - May 2012",
    location: "Bangalore, India",
    details:
      "Built a foundation in systems administration, security, and network operations.",
  },
];
export const certifications = [
  "CISM",
  "CEH",
  "ISO/IEC 27001:2022 Lead Auditor",
  "AZ-500",
  "AZ-104",
  "AZ-900",
  "SC-200",
  "Fortinet NSE 7",
  "CCNP Security",
  "CCNA Security",
];
