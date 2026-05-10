# RoadAssist Co-Pilot — case study

Take-home for an Insurance Co-Pilot product role. Two deliverables:

1. **PRD** — [`PRD.md`](PRD.md). 2-page max product spec.
2. **Prototype** — [`prototype/`](prototype). Functional Next.js 16 app
   demonstrating the end-to-end target flow: voice intake → damage assessment
   → coverage check → next-best-action dispatch → customer SMS.

Pitch and live demo will reference both.

## Repo layout

```
.
├── PRD.md                 — product requirements document
├── datasets/              — synthetic policies + licensed damage images
│   ├── synthetic-policies/
│   └── car-damage-images/
└── prototype/             — Next.js application (deploy this on Vercel)
    └── README.md          — local dev + deploy instructions
```

## Quick start

The prototype is a self-contained Next.js project. See
[`prototype/README.md`](prototype/README.md) for the full local-dev and
Vercel-deploy instructions. Short version:

```bash
cd prototype
cp .env.example .env.local      # fill in OPENAI_API_KEY + GOOGLE_GENERATIVE_AI_API_KEY
npm install
npm run dev                     # opens http://localhost:3000 (Chrome / Edge)
```

## Architecture overview

Six AI agents, one per server route, behind stable Zod schemas with explicit
guardrails (clause-substring validation, confidence-gated escalation,
cross-provider failover for vision). Frontend orchestrator is a small
explicit state machine; nothing dispatches without a human approval click.

See [`PRD.md` §6 "AI Integration"](PRD.md) for the per-agent breakdown.
