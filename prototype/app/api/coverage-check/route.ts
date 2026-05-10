// AI-3 + AI-4 — Policy retrieval (inline lookup) and coverage adjudication.
// Hard guardrail: the model's clauseQuote must be a verbatim substring of one
// of the policy's keyClauses[].text strings. Mirrors PRD §6 guardrails.

import { NextResponse } from "next/server";
import policiesData from "@/data/policies.json";
import { openaiJson, MODELS } from "@/lib/llm";
import { CoverageDecisionSchema } from "@/lib/schemas";
import { COVERAGE_SYSTEM_PROMPT, coverageUserPrompt } from "@/lib/prompts";
import type { Policy } from "@/lib/types";

export const runtime = "nodejs";

const policies = policiesData as Policy[];
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const policy = policies.find((p) => p.policyId === body.policyId);
        if (!policy) {
            return NextResponse.json(
                { error: `policy ${body.policyId} not found` },
                { status: 404 },
            );
        }

        const userBlock = coverageUserPrompt({
            intake: body.intake,
            damage: body.damage,
            policy,
        });

        // Two attempts: if the clause-substring guard fails, feed the failure
        // back into the prompt and retry once. The guard is the whole anti-
        // hallucination story, so this retry is worth its weight here.
        let lastError: string | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            const system = lastError
                ? `${COVERAGE_SYSTEM_PROMPT}\n\nLast attempt failed validation: ${lastError}\nReturn corrected JSON only.`
                : COVERAGE_SYSTEM_PROMPT;

            const raw = await openaiJson({
                agent: "coverage",
                model: MODELS.coverage,
                system,
                user: userBlock,
                reasoningEffort: "low",
            });

            const parsed = CoverageDecisionSchema.safeParse(JSON.parse(raw));
            if (!parsed.success) {
                lastError = parsed.error.message;
                continue;
            }

            const needle = norm(parsed.data.clauseQuote);
            const matched = policy.keyClauses.find((c) => norm(c.text).includes(needle));
            if (!matched) {
                lastError = `clauseQuote not found verbatim in any clause: "${parsed.data.clauseQuote.slice(0, 120)}…"`;
                continue;
            }

            return NextResponse.json({
                ...parsed.data,
                clauseRef: matched.clauseId,
                needsHumanReview: parsed.data.confidence < 0.6,
            });
        }

        return NextResponse.json({
            covered: false,
            deductibleUsd: null,
            clauseQuote: "",
            clauseRef: "",
            confidence: 0,
            reason: `Automated coverage check failed: ${lastError ?? "unknown error"}.`,
            needsHumanReview: true,
        });
    } catch (err) {
        console.error("[/api/coverage-check]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "coverage-check failed" },
            { status: 500 },
        );
    }
}
