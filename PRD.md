# PRD — RoadAssist Co-Pilot

**Product:** AI co-pilot for roadside assistance claims
**Audience:** Mid-to-large auto insurance carriers running 24/7 roadside lines
**Status:** v1 product specification

## 1. Vision

Roadside assistance is the moment of truth in auto insurance: the customer is stranded, anxious, and judges the carrier on every second of latency. Today, human agents spend most of a ~12-minute call gathering data and hunting through policy PDFs, leaving little capacity for empathy or judgment.

**RoadAssist Co-Pilot** turns that call into a guided rescue. A voice agent collects information about the situation, an AI assistant judges coverage against the customer's policy with cited evidence, decides what action to take and dispatches the repair/tow truck. A human supervisor is looped in for low confidence/high claim amounts before the decision is made. The customer is automatically updated on the processing steps and the decision. We compress time-to-reassurance from minutes to ~30 seconds while keeping a licensed human accountable.

**12-month goals:** −60% average handle time, ≥ 95% coverage-decision accuracy vs. expert review, +15 NPS on roadside events.

## 2. Key Features

The product has two users with very different UX needs. The **stranded customer** is single-task and stressed: the voice agent prioritizes empathy, slow clear speech, immediate reassurance ("help is on the way"), and a single next step at a time. The **carrier agent** is multi-tasking and accountable: the cockpit prioritizes information density, evidence-at-a-glance (cited clauses, confidence, photos in the same viewport), and one-click overrides. Every feature below is shaped by which persona it serves, and §6 describes the AI behind them.

### F1 — Conversational voice intake

A speech-to-speech voice agent answers the customer's call, gathers structured intake (identity, vehicle, location, damage), handles barge-in, and degrades gracefully on poor connections.

### F2 — Multimodal evidence capture

The customer can submit photos of the damage, scene, license plate, and odometer mid-conversation. The agent prompts for missing or low-quality images.

### F3 — AI damage assessment

A vision-language model rates damage type, severity (1–5), and drivability from the photos, driving the tow-vs-mobile-repair recommendation. See §6 for the full approach.

### F4 — Explainable coverage check

The AI compares the structured intake to the customer's policy and returns a decision with cited clauses, included / excluded items, deductibles, and a confidence score. Every decision is auditable end-to-end.

### F5 — Next-best-action dispatch

Selects the nearest in-network garage, picks the dispatch type (tow / mobile repair / taxi / rental), and surfaces ETAs. Integrates with the carrier's existing dispatch and CRM systems.

### F6 — Human Agent cockpit

Live transcript, extracted fields, flagged missing info, progress updates, editable customer message, one-click approve / override, and a full audit log. The carrier's licensed agents stay accountable for every customer-facing action.

### F7 — Customer status update

Once approved, the customer receives an SMS / email / App notification with the coverage decision, the dispatched provider, and an ETA.

### F8 — Multi-language support

The voice agent, message drafts, and human cockpit operate in the customer's language, detected automatically.

### F9 — Fraud detection

Lightweight fraud signals run in parallel with adjudication: repeat-caller patterns, location–vehicle mismatches, suspicious image metadata (re-used or stock photos), inconsistent intake answers, and known-bad-actor lists. Signals attach a risk score to the case and route high-risk claims to human specialist.

### F10 — Live transfer to a human

At any point — by customer request, low confidence, high severity, sensitive scenarios (injury, minors, vulnerable customers), or a fraud-risk threshold — the call hands off to a licensed human. The transfer carries the full context (transcript, extracted fields, current AI recommendation, photos) so the customer never has to repeat themselves.

### F11 — White-label customer portal

A white-label web/mobile portal where customers can self-serve: open a new claim, watch a live status timeline of a case, upload additional evidence, chat with the AI agent, and request a callback. The portal also exposes the customer's full claims history. The brand guidelines drive the voice agent (F1) and customer messages (F7) so the customer experiences one consistent brand across channels.

## 3. Prioritization

We optimize v1 around the **trust chain** — proving that AI-driven adjudication is safe and auditable enough for carriers to put in front of real customers. Optimize the core features.

- **v1 (foundational MVP) — built in M0, deployed through M1 → M2 → M3:** F1–F7 plus F10 (live transfer). All claims go through a human in the loop while we earn system trust. Scope is limited to the carrier's primary language and the most common case types (mechanical breakdown, flat tire, accident-without-injury).
- **v1.5 (post-pilot expansion) — kicks off when M2 is stable, ships during M3:** F8 (multi-language) and F9 (fraud detection). Both ride on the v1 architecture but need their own eval sets and operational playbooks before they can be trusted in production.
- **v2 (customer-facing scale) — post-M3:** F11 (white-label customer portal with claims history), plus payment flows and automated subrogation. This shifts the product from an internal carrier tool to a customer-facing self-service surface and requires authentication, multi-tenant isolation, and stronger compliance controls.

## 4. Milestones & Quality Gates

1. **M0 — v1 build on synthetic data + damage-model fine-tune (weeks 1–6):** Build v1 end-to-end on synthetic policies and garage data. Buy a licensed automotive damage dataset (~10–50k labeled photos) and supervised-fine-tune AI-2 on it; hold out 10% as the damage eval set. **Gate:** AI-2 macro-F1 ≥ 0.85 on the held-out set, ≥ 90% AI/expert agreement on a 50-case synthetic coverage eval, latency < 4 s, 100% citation coverage; carrier sponsor signed for M1.
2. **M1 — v1 MVP shadow pilot in production (weeks 7–16):** v1 runs alongside human agents on real calls; agents always send their own message and correct AI extractions inline. Real overrides grow the eval set (~200 cases) and become the first real-data fine-tune for AI-2. **Gate:** ≥ 90% AI/agent agreement, AI-2 precision/recall on real photos within 5% of the licensed baseline, override rate stable two weeks, 0 unauthorized auto-sends.
3. **M2 — v1 production write-back (months 5–7):** AI drives the suggested message and dispatch; agents approve / edit and click "send." Real CRM + dispatch + SMS / IVR / email integrations. **Gate:** P95 latency under target, no Sev-1 incidents in two weeks, full audit log. v1.5 (F8, F9) work begins in parallel.
4. **M3 — v1 scaled automation; v1.5 in parallel (months 8–12):** auto-approve high-confidence, low-dollar v1 decisions; humans handle ambiguous, sensitive, or high-value cases. F8 and F9 deploy gated by their own eval sets. v2 (F11) work begins toward end of M3.

## 5. Technical Risks

**Hallucinated coverage decisions.** Structured outputs require a clause citation; uncited answers are rejected and retried, and a human approves every decision through M2.

**Policy retrieval accuracy.** Per-customer policy index with chunked, embedded clauses; the eval set covers exclusions, deductibles, and regional variants.

**Voice agent quality on noisy roadsides.** Domain ASR with custom vocabulary (car models, license plates) and a typed fallback; agents can correct extracted fields inline.

**Wrong dispatch.** Human approval gates dispatch through M2; auto-mode in M3 is gated by confidence and a dollar threshold; full audit log per decision.

**PII / GDPR.** Redact transcripts at ingest, regional data residency, configurable retention, no training on customer data, DPA with all upstream providers.

**Latency & unit cost.** Stream partial responses, cache policy embeddings, route simple cases to a smaller model, per-call budget.

**Multi-tenancy retrofit.** Even though the customer-facing white-label portal (F11) ships in v2, v1 is built tenant-ready: scoped data model, per-tenant config and secrets, branding / persona / locale as configuration, no shared mutable state across carriers, isolation tests in CI.

**Damage-model dataset & drift.** The licensed dataset must cover the carrier's vehicle mix and jurisdictions; license terms (commercial use, derivative models, retention) reviewed up front; per-class drift tracked and re-fine-tuned on a fixed cadence; the licensed held-out set is immutable so accuracy is comparable across model versions.

## 6. AI Integration

AI runs at several discrete touchpoints in the workflow. Each one sits behind a stable schema so the carrier is never locked in to a single provider, and each has its own eval loop and guardrails. Every AI output is validated against a JSON schema server-side; failures fall back to a "needs human review" state rather than silently degrading.

**AI-1 — Voice agent (F1).** Real-time speech-to-speech that runs the customer conversation: STT, dialogue, TTS, and tool calls that populate the intake schema. Models: OpenAI Realtime, ElevenLabs Conversational AI, or a Deepgram ASR + LLM + Cartesia / ElevenLabs TTS pipeline, fronted by Twilio or LiveKit telephony.

**AI-2 — Damage assessment (F3).** Multimodal vision-language model that scores customer photos against a strict schema, self-hosted so photos stay on carrier infrastructure. Supervised-fine-tuned on a licensed automotive damage dataset in M0 and re-fine-tuned periodically on production overrides. Models: an open-weights VLM base (Qwen-VL, InternVL) or a licensed closed-weight model that supports vision fine-tuning. See the deeper-dive subsection below.

**AI-3 — Policy retrieval (supports F4).** Embedding model + per-customer vector index over the policy text; returns the top-k relevant clauses for AI-4. Models: a current-generation embeddings model (e.g. OpenAI `text-embedding-3-large`) or a self-hosted alternative.

**AI-4 — Coverage adjudication (F4).** Text LLM that adjudicates the case against the retrieved clauses, with strict JSON schema validation and required clause citations. Models: a frontier text LLM — OpenAI, Anthropic, or Gemini — chosen on cost / latency / accuracy and swappable through the adapter layer.

**AI-5 — Next-best-action (F5).** Deterministic rule engine first (in-network filter, distance, hours, capacity), then a text LLM that ranks the top candidates with case context (severity, language, special needs). Models: any frontier text LLM is sufficient — the rule engine carries the safety-critical filtering.

**AI-6 — Customer message draft (F7).** Text LLM that drafts the SMS / email / app notification under the carrier's tone-of-voice guide and the approved decision. Models: a smaller, cheaper text LLM is sufficient (GPT-4o-mini class today, a fine-tuned variant after several months of production); always human-approved before send.

### Damage assessment (AI-2) — closer look

Damage assessment is a constrained vision-language task with a strict schema and is the one AI touchpoint where we own labeled training data, so it is also the one we fine-tune.

**Inputs:** customer photo(s), transcript snippet, vehicle metadata.
**Output (validated JSON):** `damageType`, `severity (1–5)`, `drivable`, `confidence (0–1)`, `evidenceFromImage`, `recommendedAction`.
**Approach:** start from an open-weights multimodal base (e.g. Qwen-VL, InternVL, or a licensed closed-weight model that supports vision fine-tuning). Supervised-fine-tune in M0 on the licensed automotive damage dataset (≥ 10k images, stratified across damage class, severity, vehicle type, and lighting / occlusion conditions). Re-fine-tune at the end of M1 on the first ~200 real cases plus their human-corrected labels, then on every ~1k accumulated real cases thereafter.
**Why fine-tune AI-2 specifically (and not the others):** we have a labeled corpus, the task is narrow and bounded by a tight schema, multimodal inference is the most expensive call in the system, and customer photos are the most sensitive payload — self-hosting a fine-tuned model gives us all four wins (accuracy, cost, latency, data residency). The other touchpoints (AI-1, AI-3 to AI-6) keep using frontier closed APIs because their value is broad reasoning and language understanding, which fine-tuning a smaller model would degrade.
**Limitations we plan around:** misclassification of rare damage, occluded photos, intentional fraud (re-used images), poor lighting, and out-of-distribution vehicles relative to the licensed dataset. **Eval:** held-out 10% of the licensed dataset plus the growing real-case golden set, tracking precision / recall, false-tow rate, and per-class drift; weekly review of human overrides as the leading regression indicator.
_Prototype note: the case-study demo uses an off-the-shelf multimodal call (OpenAI `gpt-5.4-mini`) instead of a fine-tune — fine-tuning is out of scope for a 5–6h prototype but is the M0 deliverable in production._

### Model choices and trade-offs

We deliberately use different model classes per touchpoint because the constraints differ. **Real-time speech-to-speech** (AI-1) is required for natural conversation — sub-500 ms first-token latency is what makes the difference between "talking to the carrier" and "talking to a chatbot." A **multimodal VLM** (AI-2) is required because the evidence is visual; a text-only model would be guessing. **Embeddings + structured-output text LLM** (AI-3, AI-4) for adjudication isolates the customer's policy in scope and produces auditable citations. We considered stuffing the policy into a single long-context LLM call but rejected it: cost grows with every call, citation reliability degrades, and per-customer policy isolation becomes a security argument we don't want to have.

The trade-offs we accept openly: LLMs hallucinate (mitigated by required citations + structured outputs + human gate); multimodal calls cost ~5–10× text-only (used only where vision is unavoidable); real-time voice has provider lock-in risk (mitigated, not eliminated, by the adapter layer).

### Guardrails

Every AI output is JSON-schema validated server-side; any failure routes the case to "needs human review" rather than silently degrading. Every coverage decision must include a clause citation; uncited answers are rejected and retried. Confidence thresholds gate auto-action — below threshold, missing data, or low-quality images trigger an explicit re-prompt or human escalation. Severity ≥ 4, sensitive scenarios (injury, minors, vulnerable customers), and high fraud-risk scores always escalate to a human regardless of confidence. Every AI touchpoint has an independent kill-switch that falls back to the pre-AI workflow.

### Improvement strategy

1. **M0:** AI-2 supervised fine-tune on the licensed damage dataset (above). For all other touchpoints, prompt and retrieval iteration against the synthetic eval set.
2. **End of M1 onward:** re-fine-tune AI-2 on accumulated real cases (~200 at end of M1, every ~1k thereafter), with each new model gated by a CI eval against the licensed held-out set + the real golden set.
3. **Months 4–6 of production:** fine-tune the customer-message-draft model (AI-6) on approved messages to match each carrier's tone-of-voice without prompt bloat.
4. **Months 7–12 of production:** distill the coverage-adjudication model (AI-4) into a smaller, cheaper task-specific model once we have ~5k labeled cases. Re-evaluate model providers quarterly on cost / latency / accuracy; the adapter layer makes a swap a configuration change.
5. **Always-on:** human override rate is the leading regression signal; weekly eval re-runs gate any prompt, fine-tune, or provider change. LLM-as-judge against the golden set runs in CI.
