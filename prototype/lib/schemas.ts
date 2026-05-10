// All Zod schemas in one place. Each AI agent gets validated against the
// schema named after it. Inferred types are re-exported from lib/types.ts.

import { z } from "zod";

// -- AI-1 Voice intake --------------------------------------------------------

export const IntakeTurnRequestSchema = z.object({
    conversationHistory: z.array(
        z.object({ role: z.enum(["agent", "customer"]), text: z.string() }),
    ),
    lastUserUtterance: z.string().min(1),
    currentIntake: z.object({
        name: z.string().optional(),
        vehicle: z.string().optional(),
        policyId: z.string().optional(),
        registrationNumber: z.string().optional(),
        location: z.string().optional(),
        situation: z.string().optional(),
        damageDescription: z.string().optional(),
        drivability: z.enum(["drivable", "not-drivable", "unknown"]).optional(),
        cause: z
            .enum([
                "collision",
                "road-hazard",
                "mechanical-failure",
                "vandalism",
                "weather",
                "other",
                "unknown",
            ])
            .optional(),
        safetyConcerns: z.string().optional(),
        injuriesReported: z.boolean().optional(),
        photosRequested: z.boolean().optional(),
        photosUploaded: z.boolean().optional(),
        notes: z.string().optional(),
    }),
});

export const IntakeToolCallSchema = z.union([
    z.object({
        name: z.literal("update_intake"),
        arguments: z.object({
            field: z.enum([
                "name",
                "vehicle",
                "policyId",
                "registrationNumber",
                "location",
                "situation",
                "damageDescription",
                "drivability",
                "cause",
                "safetyConcerns",
                "injuriesReported",
                "photosRequested",
            ]),
            value: z.union([z.string(), z.boolean()]),
        }),
    }),
    z.object({
        name: z.literal("complete_intake"),
        arguments: z.object({}).passthrough().optional(),
    }),
]);

export const IntakeTurnResponseSchema = z.object({
    replyText: z.string(),
    toolCalls: z.array(IntakeToolCallSchema),
});

// -- AI-2 Damage assessment ---------------------------------------------------

export const DamageAssessmentSchema = z.object({
    type: z.string().min(2),
    severity: z.number().int().min(1).max(5),
    drivability: z.enum(["drivable", "not-drivable", "unknown"]),
    confidence: z.number().min(0).max(1),
    evidenceQuote: z.string().min(3),
    recommendedAction: z.enum(["mobile-repair", "tow", "tow-and-rental", "human-review"]),
    notes: z.string().optional(),
});

// -- AI-4 Coverage decision ---------------------------------------------------

export const CoverageDecisionSchema = z.object({
    covered: z.boolean(),
    deductibleUsd: z.number().nullable(),
    clauseQuote: z.string().min(5),
    clauseRef: z.string().min(2),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(5),
});

// -- AI-5 Next-best-action ----------------------------------------------------

export const DispatchTypeSchema = z.enum(["tow", "mobile-repair", "taxi", "rental"]);

export const DispatchCandidateSchema = z.object({
    providerId: z.string(),
    providerName: z.string(),
    dispatchType: DispatchTypeSchema,
    distanceMi: z.number(),
    etaMin: z.number(),
    rationale: z.string().min(3),
});

export const DispatchPlanSchema = z.object({
    primary: DispatchCandidateSchema,
    alternates: z.array(DispatchCandidateSchema).max(3),
    rationale: z.string().min(5),
});

// What the LLM ranker returns; the route merges it with the deterministic list.
export const RankerOutputSchema = z.object({
    primaryProviderId: z.string(),
    primaryDispatchType: DispatchTypeSchema,
    alternateProviderIds: z.array(z.string()).max(3),
    rationale: z.string().min(5),
});

// -- AI-6 Customer message draft ----------------------------------------------

export const MessageDraftSchema = z.object({
    body: z.string().min(20).max(480),
});

