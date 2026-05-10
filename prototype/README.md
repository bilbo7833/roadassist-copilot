# RoadAssist Co-Pilot — prototype

AI co-pilot for roadside-assistance claims. The voice agent gathers
information from the customer; the AI runs damage assessment, coverage check,
next-best-action dispatch, and drafts the customer SMS; the human operator
approves dispatch.

See [`PROTOTYPE_PLAN.md`](../PROTOTYPE_PLAN.md) and [`PRD.md`](../PRD.md) at
the repo root for product/architecture context.

## Local development

Requirements: Node 20.18+, Chrome or Edge (browser-native ASR).

```bash
cp .env.example .env.local
# fill in OPENAI_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY
npm install
npm run dev
```

Open <http://localhost:3000>. Pick a customer, click 🎙 to start the call,
upload a damage photo when asked, and the cockpit on the right will run
damage → coverage → next-best-action automatically. Approve the dispatch and
the SMS is auto-sent into the fake phone pane on the left.

Useful scripts:

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm run build       # production build (also what Vercel runs)
```

## Deploy on Vercel

Easiest path. ~5 minutes start to finish.

1. Push this repo to GitHub.
2. <https://vercel.com/new> → import the repo.
3. **Set Root Directory to `prototype`.** Framework auto-detects as Next.js.
4. Add environment variables (Production + Preview):
   - `OPENAI_API_KEY` — required.
   - `GOOGLE_GENERATIVE_AI_API_KEY` — required (or `GEMINI_API_KEY`).
   - Any of `LLM_INTAKE_MODEL`, `LLM_DAMAGE_MODEL`,
     `LLM_DAMAGE_FALLBACK_MODEL`, `LLM_COVERAGE_MODEL`, `LLM_NBA_MODEL`,
     `LLM_MESSAGE_MODEL`, `LLM_TTS_MODEL`, `LLM_TTS_VOICE` — optional
     overrides; defaults are sensible.
5. Deploy. Build takes ~90s.

Notes:

- `vercel.json` pins functions to the `iad1` region (closest to OpenAI's API
  endpoints). Override only if you have a strong reason.
- Each API route declares its own `maxDuration` (60s for vision and coverage,
  30s for the rest) so slow LLM calls don't get killed. Hobby plan supports up
  to 60s; no Pro upgrade needed.
- The mic requires HTTPS — Vercel gives you that automatically. `localhost`
  is also allowed by browsers as a special case.
- If you want the deployment private (recommended — the running app spends
  real OpenAI/Gemini money), enable Vercel's "Deployment Protection" in the
  project settings.

## Architecture

5 server routes, one per AI agent (PRD §6):

| Route                    | Agent              | Default model                |
| ------------------------ | ------------------ | ---------------------------- |
| `/api/intake-turn`       | AI-1 voice intake  | `gpt-5`                      |
| `/api/damage-assess`     | AI-2 damage        | `gemini-3.1-pro` → `gpt-5`   |
| `/api/coverage-check`    | AI-3 + AI-4        | `gpt-5`                      |
| `/api/next-best-action`  | AI-5 dispatch      | `gpt-5` (haversine + ranker) |
| `/api/draft-message`     | AI-6 SMS           | `gpt-5`                      |
| `/api/tts`               | (TTS for AI-1)     | `gpt-4o-mini-tts`, voice nova |

Frontend state machine in [`lib/orchestrator.ts`](lib/orchestrator.ts):

```
intake-complete + damage-assessed   → coverage-check
coverage-decided (covered)          → next-best-action
human approves dispatch             → draft-message → SMS auto-sent
```

Damage assessment may run as soon as the customer uploads a photo (parallel
with intake), but coverage and downstream steps are gated on
`state.intakeComplete` so we never adjudicate against partial information.

## Trade-offs documented in code

- Browser Web Speech API for ASR (Chrome/Edge only). Swap-in point for OpenAI
  Realtime is the `/api/intake-turn` boundary.
- TTS streams MP3 chunks via `MediaSource` for ~200-400ms time-to-first-audio.
- Single-policy lookup by `policyId` instead of vector retrieval (PRD §6 AI-3
  — embeddings are the production design but unnecessary at 10 policies).
- Haversine + circuity factor for ETA (production replaces with OSRM /
  Distance Matrix).
- Clause-substring guardrail prevents hallucinated coverage citations.
