# PRD — RoadAssist Co-Pilot

**Product:** AI co-pilot for roadside assistance claims
**Audience:** Mid-to-large auto insurance carriers running 24/7 roadside lines
**Status:** v1 product specification

## 1. Vision

Roadside assistance is the moment of truth in auto insurance: the customer is stranded, anxious, and judges the carrier on every second of latency. Today, human agents spend most of a ~12-minute call gathering data and hunting through policy PDFs, leaving little capacity for empathy or judgment.

**RoadAssist Co-Pilot** turns that call into a guided rescue. A voice agent collects information about the situation, an AI assistant judges coverage against the customer's policy with cited evidence, decides what action to take and dispatches the repair/tow truck. A human supervisor is looped in for low confidence/high claim amounts before the decision is made. The customer is automatically updated on the processing steps and the decision. We compress time-to-reassurance from minutes to ~30 seconds while keeping a licensed human accountable.

**12-month KPIs:** We use agent efficiency optimization and customer satisfaction as the main KPIs. The goal is to reduce costs for clients and increase customer retention.

- **Agent — productivity:** −50% average handle time.
- **Model — decision quality:** ≥ 90% coverage-decision accuracy vs. expert review.
- **Customer — satisfaction:** post-event CSAT ≥ 4.5 / 5.
- **Customer — outcome:** −25% time-to-dispatch (call open → truck dispatched).

## 2. Key Features

Two users with opposite UX needs: the **stranded customer** (stressed, worried — voice agent prioritizes empathy and one next step at a time) and the **carrier agent** (multi-tasking, accountable — cockpit prioritizes information density and one-click overrides). We split the features into **Customer Experience (CX)**, **AI Decisioning (AI)** and **Human in the Loop (HL)**

- **F1. Conversational voice intake(CX)** — speech-to-speech, barge-in, graceful degradation on poor connections.
- **F2. Multimodal evidence capture(CX)** — damage / scene / plate / odometer photos submitted mid-call.
- **F3. Damage assessment(AI)** — video model rates damage type, severity (1–5), and recoverability from photos.
- **F4. Explainable coverage check(AI)** — evaluates damage against the customer's policy with cited clauses, deductibles, and confidence.
- **F5. Next-best-action dispatch(AI)** — picks the closest in-network provider with the right dispatch type (tow / mobile repair / taxi / rental) and ETA.
- **F6. Agent cockpit(HL)** — live transcript, evidence at a glance, editable customer message, one-click approve / override, full audit log.
- **F7. Customer status update(CX)** — SMS / email / app notification with decision, dispatched provider, and ETA.
- **F8. Multi-language(CX)** — auto-detected at call open, scoped to the carrier's served markets; voice, messages, and cockpit follow the same locale.
- **F9. Fraud detection(AI)** — risk-scores cases and routes high-risk ones to a specialist queue.
- **F10. Live human transfer(HL)** — by request, low confidence, high severity, sensitive scenarios, or fraud risk; full context handed off so the customer never repeats themselves.
- **F11. White-label customer portal(CX)** — self-service claim creation, live status timeline, evidence upload, claims history; white label CI branding for UI and voice.

## 3. Prioritization

We optimize v1 around the **trust chain** — proving that AI-driven adjudication is safe and auditable enough for carriers to put in front of real customers. Optimize the core features.

- **v1 (foundational MVP) — deployed through M1 → M2 → M3:** F1–F7 plus F10 (live transfer). All claims go through a human in the loop while we earn system trust. Scope is limited to the carrier's primary language and the most common case types (mechanical breakdown, flat tire, accident-without-injury).
- **v1.5 (post-pilot expansion) — kicks off when M2 is stable, ships during M3:** F8 (multi-language) and F9 (fraud detection). Also include edge-cases for damages.
- **v2 (customer-facing scale) — post-M3:** F11 (white-label customer portal with claims history), plus payment flows and automated third-party cost recovery. This shifts the product from an internal carrier tool to a customer-facing self-service surface and requires authentication, multi-tenant isolation, and stronger compliance controls.

## 4. Milestones & Quality Gates

0. **M0 - Build Phase**: the coverage check model is trained on policy data from client, the damage assessment model trained on licensed automotive damage dataset (~10–50k labeled photos).
1. **M1 — v1 MVP shadow pilot in production (months 2–4):** v1 runs alongside human agents on real calls; agents always send their own message and correct AI extractions inline. **Gate:** **model** ≥ 80% AI / agent agreement on coverage; **agent** and **customer** KPIs baselined (no regression vs. pre-AI); AI-2 precision / recall on real photos within 5% of the licensed baseline; override rate stable two weeks; 0 unauthorized auto-sends.
2. **M2 — v1 production write-back (months 5–7):** AI drives the suggested message and dispatch; agents approve / edit and click "send." **Gate:** **model** ≥ 90% coverage-decision accuracy; **agent** −25% handle time; **customer** CSAT ≥ 4.3 / 5 and −15% time-to-resolution; P95 latency under target; no Sev-1 incidents in two weeks; full audit log per case. v1.5 (F8, F9) work begins in parallel.
3. **M3 — v1 scaled automation; v1.5 in parallel (months 8–12):** auto-approve high-confidence, low-dollar v1 decisions; humans handle ambiguous, sensitive, or high-value cases. **Gate:** **model** ≥ 90% sustained accuracy and ≥ 98% precision on auto-approved cases; **agent** −50% handle time; **customer** CSAT ≥ 4.5 / 5 and −25% time-to-resolution. F8 / F9 deploy gated by their own eval sets; v2 (F11) work begins toward the end.

## 5. Technical Risks & Mitigation

- **Hallucinated coverage decisions** — required clause citations + structured outputs + human approval through M2.
- **Policy retrieval accuracy** — per-customer chunked / embedded policy index; eval set covers exclusions, deductibles, regional variants.
- **Voice agent quality on noisy roadsides** — domain ASR with custom vocabulary, typed fallback, and inline agent correction.
- **Wrong dispatch** — human approval through M2; M3 auto-mode gated by confidence + dollar threshold; full audit log per decision.
- **PII / GDPR** — redact at ingest, regional residency, configurable retention, no training on customer data, DPA with providers.
- **Damage-model dataset & drift** — licensed dataset must cover the carrier's vehicle mix and jurisdictions; immutable held-out set; per-class drift tracked and re-fine-tuned on cadence.

## 6. AI Integration

Each AI touchpoint sits behind a stable schema with its own eval loop and guardrails; outputs are JSON-schema validated server-side, and failures route to "needs human review."

- **AI-1 — Voice agent (F1).** Real-time speech-to-speech populating the intake schema; OpenAI Realtime, ElevenLabs Conversational AI, or Pipecat / LiveKit Agents (open source).
- **AI-2 — Damage assessment (F3).** Self-hosted multimodal VLM (Qwen-VL, InternVL, or a licensed closed-weight base), fine-tuned on a licensed dataset in the build phase and regularly re-fine-tuned on production overrides;
- **AI-3 — Policy retrieval (RAG, supports F4).** Per-customer vector index returns top-k policy clauses relevant to the claim query; any current-generation embeddings model (e.g. OpenAI `text-embedding-3-large`) or a self-hosted equivalent.
- **AI-4 — Coverage adjudication (F4).** Frontier LLM with strict JSON schema validation and required clause citations over the retrieved clauses; (OpenAI / Anthropic / Gemini). Distill into a smaller task-specific model at ~5k labeled cases.
- **AI-5 — Next-best-action (F5).** Deterministic rule engine first (in-network filter, distance, hours, capacity), then an LLM ranks top candidates with case context; the rule engine carries the safety-critical filtering.
- **AI-6 — Customer message draft (F7).** Text LLM drafts the customer message under the carrier's tone-of-voice guide; always human-approved; a smaller LLM (GPT-4o-mini class) suffices.

### Damage assessment (AI-2) — closer look

The one AI touchpoint where we own labeled training data, so the one we fine-tune. **Inputs:** photo(s), transcript snippet, vehicle metadata. **Output (validated JSON):** damage type, severity (1–5), drivability, confidence, evidence, recommended action. **Approach:** supervised-fine-tune an open-weights VLM in the build phase on the licensed dataset (≥ 10k stratified images), then re-fine-tune at end of M1 on ~200 real cases and every ~1k thereafter. **Why here, not elsewhere:** narrow schema, expensive multimodal inference, sensitive customer photos — self-hosting wins on accuracy, cost, latency, and data residency; the other touchpoints stay on frontier closed APIs where broad reasoning matters more. **Limitations:** rare damage, occlusion, fraud (re-used images), poor lighting, OOD vehicles. **Eval:** held-out 10% of the licensed set + real-case golden set; precision / recall, false-tow rate, per-class drift; weekly override review.

### Trade-offs we accept

LLMs hallucinate — mitigated by required citations, structured outputs, and the human gate. Multimodal calls cost ~5–10× text-only — used only where vision is unavoidable. Real-time voice has provider lock-in — mitigated, not eliminated, by the adapter layer. We rejected a long-context "stuff the policy in" approach on cost, citation reliability, and per-customer isolation grounds.

### Guardrails

All AI outputs are JSON-schema validated server-side; failures route to "needs human review." Coverage decisions require a clause citation or are rejected and retried. Confidence thresholds gate auto-action; below threshold, missing data, or low-quality images trigger re-prompt or escalation. Severity ≥ 4, sensitive scenarios (injury, minors, vulnerable customers), and high fraud-risk scores always escalate. Each AI touchpoint has an independent kill-switch back to the pre-AI workflow.

### Improvement strategy

1. **Build phase:** AI-2 supervised fine-tune on the licensed dataset; prompt and retrieval iteration on all other touchpoints against the synthetic eval set.
2. **End of M1+:** re-fine-tune AI-2 on accumulated real cases (~200 at end of M1, every ~1k thereafter), gated by CI eval against the licensed held-out + real golden set.
3. **Production months 4–6:** fine-tune AI-6 on approved messages for carrier-specific tone-of-voice.
4. **Production months 7–12:** distill AI-4 into a smaller task-specific model at ~5k labeled cases; re-evaluate providers quarterly via the adapter layer.
5. **Always-on:** human override rate is the leading regression signal; weekly eval re-runs gate every prompt / fine-tune / provider change.
