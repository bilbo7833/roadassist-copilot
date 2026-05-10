# PRD — RoadAssist Co-Pilot

**Product:** AI co-pilot for roadside assistance claims
**Audience:** Large auto insurance carriers running 24/7 roadside lines
**Status:** v1 product specification

## 1. Vision

Roadside assistance is the moment of truth in auto insurance: the customer is stranded, anxious, and judges the carrier on every second of latency. Today, human agents spend most of a ~12-minute call gathering data and hunting through policy PDFs, leaving little capacity for empathy or judgment.

**RoadAssist Co-Pilot** turns that call into a guided rescue. A voice agent collects information about the situation, an AI assistant judges coverage against the customer's policy with cited evidence, picks a dispatch action, and notifies the customer. The end-state is gated automation: high-confidence, low-dollar cases auto-resolve while ambiguous, sensitive, or high-value cases escalate to a carrier agent — and we ship there only after earning trust through phases where humans review every decision. We compress dispatch time from minutes to a fast first-touch while keeping a licensed human accountable for any non-trivial call.

**12-month KPIs:** We use agent efficiency optimization and customer satisfaction as the main KPIs. The goal is to reduce costs for clients and increase customer retention.

- **Agent — productivity:** −50% average handle time.
- **Model — decision quality:** ≥ 90% coverage-decision accuracy vs. expert review.
- **Customer — satisfaction:** post-event CSAT ≥ 4.5 / 5.
- **Customer — outcome:** −40% time-to-dispatch (call started → truck dispatched).

## 2. Key Features

Two users with opposite UX needs: the **stranded customer** (stressed, worried — voice agent gathers information through empathetic communication) and the **carrier agent** (multi-tasking, accountable — cockpit prioritizes information density and one-click overrides). We split the features into **Customer Experience (CX)**, **AI Decisioning (AI)**, and **Human in the Loop (HL)**.

- **F1. Conversational voice intake (CX)** — speech-to-speech, barge-in, graceful degradation on poor connections.
- **F2. Multimodal evidence capture (CX)** — damage / scene / plate / odometer photos submitted mid-call.
- **F3. Damage assessment (AI)** — vision model rates damage type, severity (1–5), and drivability from photos.
- **F4. Explainable coverage check (AI)** — evaluates damage against the customer's policy with cited clauses, deductibles, and confidence.
- **F5. Next-best-action dispatch (AI)** — picks the closest in-network provider with the right dispatch type (tow / mobile repair / taxi / rental) and ETA.
- **F6. Agent cockpit (HL)** — live transcript, evidence at a glance, editable customer message, one-click approve / override, full audit log.
- **F7. Customer status update (CX)** — SMS / email / app notification with decision, dispatched provider, and ETA.
- **F8. Multi-language (CX)** — auto-detected at call open, scoped to the carrier's served markets; voice, messages, and cockpit follow the same locale.
- **F9. Fraud detection (AI)** — risk-scores cases and flags high-risk ones for specialist handoff (via F10).
- **F10. Live human transfer (HL)** — by request, low confidence, high severity, sensitive scenarios, or fraud risk; full context handed off so the customer never repeats themselves; routes fraud-flagged cases to a specialist queue.
- **F11. White-label customer portal (CX)** — self-service claim creation, live status timeline, evidence upload, claims history; carrier branding for UI and voice.

## 3. Prioritization

We optimize v1 around the **trust chain** — proving that AI-driven adjudication is safe and auditable enough for carriers to put in front of real customers.

- **v1 (foundational MVP) — deployed through M1 → M2 with humans on every decision; M3 introduces gated auto-approval for high-confidence, low-dollar cases:** F1–F7 plus F10 (live transfer). Scope is limited to the carrier's primary language and the most common case types (mechanical breakdown, flat tire, accident-without-injury).
- **v1.5 (post-pilot expansion) — kicks off when M2 is stable, ships during M3:** F8 (multi-language), F9 (fraud detection), and expanded AI-2 coverage of rare damage types (hail, flood, EV battery, exotic body styles).
- **v2 (customer-facing scale) — post-M3:** F11 (white-label customer portal with claims history), plus payment flows and automated third-party cost recovery. This shifts the product from an internal carrier tool to a customer-facing self-service surface and requires authentication, multi-tenant isolation, and stronger compliance controls.

## 4. Milestones & Quality Gates

Each milestone defines what is deployed and the **exit gate** that must hold before promoting to the next milestone.

0. **M0 — Build phase (pre-pilot).** Coverage policy RAG setup; damage assessment fine-tuned on a licensed automotive damage dataset (~10–50k labeled photos). **Exit gate:** AI-1 intake-schema completeness ≥ 95% on simulated calls; AI-2 precision/recall ≥ 0.85; AI-3 retrieval recall@5 ≥ 0.95; AI-4 ≥ 95% decision accuracy.
1. **M1 — Shadow pilot in production.** v1 runs alongside human agents on real calls; AI suggestions are visible in the cockpit but the agent authors the message and takes 100% of final decisions. Models are refined against real overrides. **Exit gate:** ≥ 80% AI/agent agreement on coverage and dispatch option; agent handle time −10%; time-to-dispatch −10%; override rate stable across two consecutive review cycles.
2. **M2 — Production write-back.** AI drafts the customer message and dispatch decision; the agent approves/edits and clicks "send." **Exit gate:** ≥ 90% coverage-decision accuracy; agent handle time −20%; CSAT ≥ 4.3/5; time-to-dispatch −20%.
3. **M3 — Scaled automation.** Auto-approve high-confidence, low-dollar decisions; humans handle ambiguous, sensitive, or high-value cases. **Exit gate:** ≥ 90% sustained coverage accuracy and ≥ 98% precision on the auto-approved subset; agent handle time −50%; CSAT ≥ 4.5/5; time-to-dispatch −40%.

## 5. Technical Risks & Mitigation

- **Hallucinated coverage decisions** — required clause citations, structured outputs and human approval through M2.
- **Policy retrieval accuracy** — per-customer chunked / embedded policy index; eval set covers exclusions, deductibles, regional variants.
- **Voice agent quality on noisy roadsides** — typed text fallback, and inline agent correction.
- **Wrong dispatch** — human approval through M2; M3 auto-mode gated by confidence & dollar threshold; full audit log per decision.
- **PII / GDPR** — redact at ingest, regional residency, configurable retention, no training on customer data, DPA with providers.
- **Damage-model dataset & drift** — licensed dataset must cover the carrier's vehicle mix and jurisdictions; per-class drift tracked and re-fine-tuned on cadence.

## 6. AI Integration

Each AI touchpoint sits behind a stable schema with its own eval loop and guardrails; outputs are JSON-schema validated server-side, and failures route to "needs human review." All models accessed through APIs can be exchanged by flexible platform.

- **AI-1 — Voice agent (F1).** Real-time speech-to-speech populating the intake schema; OpenAI Realtime, ElevenLabs Conversational AI, or Pipecat / LiveKit Agents (open source).
- **AI-2 — Damage assessment (F3).** Self-hosted multimodal VLM (Qwen-VL, InternVL, or an on-prem-licensed equivalent), fine-tuned on a licensed dataset in the build phase and regularly re-fine-tuned on production overrides.
- **AI-3 — Policy retrieval (RAG, supports F4).** Per-customer vector index returns top-k policy clauses relevant to the claim query; OpenAI `text-embedding-3-large` (or similar cloud solution) or a self-hosted embedding equivalent.
- **AI-4 — Coverage adjudication (F4).** Frontier LLM with strict JSON schema validation and required clause citations over the retrieved clauses; (OpenAI / Anthropic / Gemini). Distill into a smaller task-specific model at ~5k labeled cases.
- **AI-5 — Next-best-action (F5).** Deterministic rule engine first (in-network filter, distance, hours, capacity), then an LLM ranks top candidates with case context; the rule engine carries the safety-critical filtering.
- **AI-6 — Customer message draft (F7).** Text LLM drafts the customer message under the carrier's tone-of-voice guide; always human-approved; a smaller LLM (e.g. GPT-4o-mini) suffices.

### Damage assessment (AI-2) — closer look

The one AI touchpoint where we own labeled training data, so the one we fine-tune. **Inputs:** photo(s), transcript snippet, vehicle metadata. **Output (validated JSON):** damage type, severity (1–5), drivability, confidence, evidence, recommended action. **Approach:** supervised-fine-tune an open-weights VLM in the build phase on the licensed dataset (≥ 10k stratified images), then re-fine-tune at end of M1 on ~200 real cases and every ~1k thereafter. **Why here, not elsewhere:** narrow schema, expensive multimodal inference, sensitive customer photos — self-hosting wins on accuracy, cost, latency, and data residency; the other touchpoints stay on frontier closed APIs where broad reasoning matters more. **Limitations:** rare damage, occlusion, fraud (re-used images), poor lighting, OOD vehicles. **Eval:** held-out 10% of the licensed set + real-case golden set; precision / recall, false-tow rate, per-class drift; weekly override review.

### Trade-offs we accept

LLMs hallucinate — mitigated by required citations, structured outputs, and the human gate. Multimodal calls cost ~5–10× text-only — used only where vision is unavoidable. Real-time voice has provider lock-in — mitigated, not eliminated, by the adapter layer. We rejected a long-context "stuff the policy in" approach on cost, citation reliability, and per-customer isolation grounds.

### Guardrails

All AI outputs are JSON-schema validated server-side; failures route to "needs human review." Coverage decisions require a clause citation or are rejected and retried. Confidence thresholds gate auto-action; below threshold, missing data, or low-quality images trigger re-prompt or escalation. Severity ≥ 4 and sensitive scenarios (injury, minors, vulnerable customers) always escalate. From v1.5 onward, high fraud-risk scores also force escalation. Each AI touchpoint has an independent kill-switch back to the pre-AI workflow.

### Improvement strategy

1. **Build phase (M0):** AI-2 supervised fine-tune on the licensed dataset; prompt and retrieval iteration on all other touchpoints against the synthetic eval set.
2. **From M1 onward:** re-fine-tune AI-2 on accumulated real cases (~200 at end of M1, every ~1k thereafter), gated by CI eval against the licensed held-out + real golden set.
3. **From M2 onward:** fine-tune AI-6 on approved messages for carrier-specific tone-of-voice once ~2k approved drafts have accumulated.
4. **From M3 onward:** distill AI-4 into a smaller task-specific model once ~5k labeled cases are available; re-evaluate providers quarterly via the adapter layer.
5. **Always-on:** human override rate is the leading regression signal; weekly eval re-runs gate every prompt / fine-tune / provider change.
