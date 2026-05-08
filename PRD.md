# PRD — RoadAssist Co-Pilot

**Product:** AI co-pilot for roadside assistance claims
**Audience:** Mid-to-large auto insurance carriers running 24/7 roadside lines
**Status:** Prototype v0.1 / for client review

## 1. Vision

Roadside assistance is the moment of truth in auto insurance: the customer is stranded, anxious, and judges the carrier on every second of latency. Today, human agents spend most of a ~12-minute call gathering data and hunting through policy PDFs, leaving little capacity for empathy or judgment.

**RoadAssist Co-Pilot** turns that call into a guided rescue. A voice agent collects intake, an AI assistant adjudicates coverage against the policy with cited evidence, and a human supervisor approves the decision before the customer is updated. We compress time-to-reassurance from minutes to ~30 seconds while keeping a licensed human accountable for every decision.

**12-month goals:** −60% average handle time, −40% cost per claim, ≥95% coverage-decision accuracy vs. expert review, +15 NPS on roadside events.

## 2. Key Features

| # | Feature | Why it matters |
|---|---|---|
| F1 | **Multimodal intake** — browser voice (STT) with typed fallback + photo upload (damage / scene / VIN) | Captures structured claim data without a phone tree; demo path is robust |
| F2 | **Explainable coverage check** — LLM compares intake to the customer's policy and returns a decision with cited clauses and confidence | Agents verify in seconds; auditable for compliance |
| F3 | **Damage assessment** — VLM rates damage type, severity, and drivability from a photo | Drives the tow-vs-repair recommendation |
| F4 | **Next-best-action** — picks nearest in-network garage and dispatch type (tow / mobile repair / taxi / rental) | Closes the loop from assessment to action |
| F5 | **Human cockpit** — live transcript, extracted fields, missing info, decision evidence, editable customer message, one-click approve / override | Co-pilot, not autopilot: humans stay in the loop |
| F6 | **Customer status update** — fake SMS in the prototype; pluggable to Twilio / email / IVR in production | Closes the case for the customer with a clear ETA |

## 3. Prioritization

We optimized the prototype for the **trust chain** — proving that AI-driven adjudication is safe enough to ship — rather than for breadth. Anything not on the critical path of *stranded → approved action → customer notified* was cut.

- **P0 (in prototype):** F1–F6 on the happy path, plus one realistic edge case (towing covered, tire replacement excluded) to show partial-coverage handling and human override.
- **P1 (post-pilot):** real dispatch integration, real SMS/voice, multi-language, fraud signals, agent quality scoring, telematics ingestion.
- **P2 (scale):** authenticated customer portal, claims history, payment flows, automated subrogation, white-label theming.

Explicitly out of MVP: real maps/routing (synthetic garage list), auth, production policy ingestion, real SMS, and UI polish — per the brief, UX > UI for this exercise.

## 4. Milestones

1. **M0 — Prototype (this submission, ~5h):** End-to-end demo on synthetic policy + garage data; OpenAI handles both vision and adjudication; human approval gate before any "send."
2. **M1 — Assisted pilot (6–8 weeks):** Shadow mode on real calls. Agents see the recommendation but always send their own message. Calibrate prompts; build a labeled eval set (~200 cases).
3. **M2 — Dispatch integration (3 months):** Replace synthetic data with the carrier's dispatch system + CRM; real SMS / IVR; observability (latency, override rate, hallucination rate).
4. **M3 — Scaled automation (6 months):** Auto-approve high-confidence, low-dollar decisions; humans handle ambiguous or high-value cases. Continuous evals + red-teaming.

## 5. Technical Risks

| Risk | Mitigation |
|---|---|
| **Hallucinated coverage decisions** | Structured outputs with required clause citations; reject answers without a citation; human approval gate in M0–M2 |
| **Policy retrieval accuracy** | Per-customer policy index; chunk + embed clauses; eval set covering exclusions, deductibles, regional variants |
| **STT errors on noisy roadside audio** | Always-on typed fallback; agent can correct extracted fields before submission |
| **Liability for wrong dispatch** | Human approval before dispatch in M0–M2; auto-mode (M3) gated by confidence + dollar threshold; full audit log per decision |
| **PII / GDPR** | Redact transcripts at ingest; regional data residency; configurable retention; no training on customer data |
| **Latency & unit cost** | Stream partial responses; cache policy embeddings; route simple cases to a smaller model; per-call budget |
| **Legacy integrations** | Treat dispatch / CRM as adapters from day one; shadow-mode pilot before any write-back |

## 6. AI Integration — Damage Assessment Approach

Damage assessment is a constrained vision-language task with a strict structured contract:

1. **Inputs:** customer photo(s), transcript snippet describing the incident, vehicle metadata (make / model / year from policy).
2. **Model:** multimodal LLM. Prototype uses OpenAI `gpt-5.4-mini`; production will evaluate OpenAI, Anthropic Claude, Google Gemini, and a self-hosted fine-tune on cost / latency / accuracy. The carrier is not locked in to one provider — the assessment service is a single adapter behind a stable schema.
3. **Output (Zod-validated JSON):** `damageType`, `severity (1–5)`, `drivable (bool)`, `confidence (0–1)`, `evidenceFromImage`, `recommendedAction (tow | mobile-repair | drive-to-garage)`.
4. **Guardrails:** below a confidence threshold the system asks for another photo or escalates to a human; severity ≥ 4 always escalates regardless of confidence; missing or low-quality images never silently degrade — they trigger an explicit re-prompt.
5. **Eval loop:** ~200-case golden set per damage class; track precision / recall and false-tow rate; monthly A/B on prompts and models; weekly review of overrides as a leading indicator of regression.

Coverage adjudication uses the same structured-output pattern with retrieval over the customer's policy, returning `decision`, `coveredItems`, `excludedItems`, `citedClauses`, and `rationale` — all surfaced verbatim in the human cockpit so the agent can verify a citation in a single glance.

---

**Out of scope for this submission:** real dispatch, real SMS, authentication, payments, multi-tenant theming, UI polish.
