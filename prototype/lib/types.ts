// Shared domain types for the cockpit + customer panel + audit log.
// Per-AI output shapes are Zod-inferred in lib/schemas.ts and re-exported here
// so callers have one import for the whole domain.

import type { z } from "zod";
import type {
    DamageAssessmentSchema,
    CoverageDecisionSchema,
    DispatchPlanSchema,
    DispatchCandidateSchema,
    DispatchTypeSchema,
    IntakeTurnResponseSchema,
} from "@/lib/schemas";

export type DispatchType = z.infer<typeof DispatchTypeSchema>;
export type DamageAssessment = z.infer<typeof DamageAssessmentSchema> & {
    // Tagged with whichever provider served this response, so the cockpit can show it.
    provider?: "gemini" | "openai" | "human-review";
};
export type CoverageDecision = z.infer<typeof CoverageDecisionSchema> & {
    needsHumanReview?: boolean;
};
export type DispatchCandidate = z.infer<typeof DispatchCandidateSchema>;
export type DispatchPlan = z.infer<typeof DispatchPlanSchema>;
export type IntakeTurnResponse = z.infer<typeof IntakeTurnResponseSchema>;

export type Customer = {
    id: string;
    name: string;
    phone: string;
    vehicle: { year: number; make: string; model: string; registration: string };
    policyId: string;
    // Where the customer's car is currently stranded. NYC tri-state for the
    // demo so haversine ETAs land in a believable 5-30 min range.
    currentLocation: { lat: number; lng: number; label: string };
};

export type Policy = {
    policyId: string;
    customerName: string;
    vehicle: { year: number; make: string; model: string; vinLast4: string };
    plan: string;
    effectiveDates: { start: string; end: string };
    roadside: {
        towMilesIncluded: number;
        mobileRepairCovered: boolean;
        lockoutCovered: boolean;
        batteryJumpCovered: boolean;
        fuelDeliveryCovered: boolean;
        taxiOrRentalCovered: boolean;
    };
    accidentCoverage: {
        collisionDeductibleUsd: number | null;
        glassDeductibleUsd: number | null;
        tireReplacementCovered: boolean;
        cosmeticScratchCovered: boolean;
    };
    keyClauses: { clauseId: string; title: string; text: string }[];
};

export type Provider = {
    id: string;
    name: string;
    location: { lat: number; lng: number; label?: string };
    capabilities: DispatchType[];
    hours: string;
    brandWhitelist?: string[];
};

export type IntakeData = {
    name?: string;
    vehicle?: string;
    policyId?: string;
    registrationNumber?: string;
    location?: string;
    situation?: string;
    damageDescription?: string;
    drivability?: "drivable" | "not-drivable" | "unknown";
    cause?: "collision" | "road-hazard" | "mechanical-failure" | "vandalism" | "weather" | "other" | "unknown";
    safetyConcerns?: string;
    injuriesReported?: boolean;
    // Photo flow. The agent asks for photos but does NOT analyze them; a
    // separate vision pass (AI-2) handles that. The two flags let the agent
    // know when to ask vs. when to move on.
    photosRequested?: boolean;
    photosUploaded?: boolean;
    notes?: string;
};

export type CaseStatus =
    | "idle"
    | "intake"
    | "intake-complete"
    | "damage-assessed"
    | "coverage-decided"
    | "dispatch-ready"
    | "dispatched"
    | "notified";

export type AuditEntry = {
    id: string;
    timestamp: string;
    type: string;
    detail: string;
};

export type SmsMessage = {
    id: string;
    timestamp: string;
    from: "carrier" | "customer";
    body: string;
};

export type TranscriptTurn = {
    id: string;
    timestamp: string;
    // "system" represents non-spoken context surfaced to the agent — e.g. the
    // CRM caller-ID lookup that fires the moment a customer is selected.
    role: "agent" | "customer" | "system";
    text: string;
    partial?: boolean;
};

export type CaseState = {
    customer: Customer | null;
    status: CaseStatus;
    intake: IntakeData;
    intakeComplete: boolean;
    transcript: TranscriptTurn[];
    damage: DamageAssessment | null;
    damageImageUrls: string[];
    coverage: CoverageDecision | null;
    dispatch: DispatchPlan | null;
    approvedDispatch: DispatchCandidate | null;
    draftMessage: string;
    smsMessages: SmsMessage[];
    audit: AuditEntry[];
};
