"use client";

// Typed thin client over the 5 /api routes. Throws on non-2xx so callers can
// try/catch — every server route already routes failures to a safe shape, so
// most errors here mean network/permission issues.

import type {
    CoverageDecision,
    Customer,
    DamageAssessment,
    DispatchPlan,
    IntakeData,
    IntakeTurnResponse,
} from "@/lib/types";

async function post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${url} ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export const api = {
    intakeTurn(args: {
        conversationHistory: { role: "agent" | "customer"; text: string }[];
        lastUserUtterance: string;
        currentIntake: IntakeData;
    }) {
        return post<IntakeTurnResponse>("/api/intake-turn", args);
    },

    damageAssess(args: {
        imageDataUrls: string[];
        transcriptSnippet: string;
        vehicle: string;
    }) {
        return post<DamageAssessment>("/api/damage-assess", args);
    },

    coverageCheck(args: {
        intake: IntakeData;
        damage: DamageAssessment;
        policyId: string;
    }) {
        return post<CoverageDecision>("/api/coverage-check", args);
    },

    nextBestAction(args: {
        customer: Customer;
        intake: IntakeData;
        damage: DamageAssessment;
        policyId: string;
    }) {
        return post<DispatchPlan>("/api/next-best-action", args);
    },

    draftMessage(args: {
        customer: Customer;
        coverage: CoverageDecision;
        dispatch: { providerName: string; dispatchType: string; etaMin: number };
    }) {
        return post<{ body: string }>("/api/draft-message", args);
    },
};
