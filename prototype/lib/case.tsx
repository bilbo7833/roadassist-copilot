"use client";

// Case store — React Context + useReducer.
// The reducer doubles as the audit-log source: every action that mutates the
// case also appends a human-readable line to state.audit, so we get the
// "full audit log per case" requirement (PRD §2 F6) for free.

import {
    createContext,
    useContext,
    useMemo,
    useReducer,
    type ReactNode,
} from "react";
import type {
    AuditEntry,
    CaseState,
    CoverageDecision,
    Customer,
    DamageAssessment,
    DispatchCandidate,
    DispatchPlan,
    IntakeData,
    SmsMessage,
    TranscriptTurn,
} from "@/lib/types";

const initialState: CaseState = {
    customer: null,
    status: "idle",
    intake: {},
    intakeComplete: false,
    transcript: [],
    damage: null,
    damageImageUrls: [],
    coverage: null,
    dispatch: null,
    approvedDispatch: null,
    draftMessage: "",
    smsMessages: [],
    audit: [],
};

type Action =
    | { type: "SELECT_CUSTOMER"; customer: Customer }
    | { type: "RESET" }
    | { type: "TRANSCRIPT_APPEND"; turn: TranscriptTurn }
    | { type: "INTAKE_UPDATED"; field: keyof IntakeData; value: unknown; source: "voice" | "agent" }
    | { type: "INTAKE_COMPLETED" }
    | { type: "DAMAGE_ASSESSED"; damage: DamageAssessment; imageUrls: string[] }
    | { type: "COVERAGE_DECIDED"; coverage: CoverageDecision }
    | { type: "DISPATCH_PLANNED"; dispatch: DispatchPlan }
    | { type: "DISPATCH_APPROVED"; candidate: DispatchCandidate }
    | { type: "MESSAGE_DRAFTED"; body: string }
    | { type: "MESSAGE_EDITED"; body: string }
    | { type: "SMS_SENT"; sms: SmsMessage };

function audit(state: CaseState, type: string, detail: string): AuditEntry[] {
    return [
        ...state.audit,
        {
            id: `${Date.now()}-${state.audit.length}`,
            timestamp: new Date().toISOString(),
            type,
            detail,
        },
    ];
}

function reducer(state: CaseState, action: Action): CaseState {
    switch (action.type) {
        case "SELECT_CUSTOMER": {
            const c = action.customer;
            const vehicle = `${c.vehicle.year} ${c.vehicle.make} ${c.vehicle.model}`;
            // We DON'T pre-fill the cockpit intake or push a system note here.
            // The agent on the call is supposed to ask Q1 (name, policy,
            // registration); the demo-er can simulate answering Q1 with the
            // "Provide my details" button which dispatches PROVIDE_DETAILS.
            return {
                ...initialState,
                customer: c,
                status: "intake",
                audit: audit(
                    initialState,
                    "case.opened",
                    `Case opened for ${c.name} (${vehicle}, policy ${c.policyId}, plate ${c.vehicle.registration}).`,
                ),
            };
        }

        case "RESET":
            return initialState;

        case "TRANSCRIPT_APPEND":
            return { ...state, transcript: [...state.transcript, action.turn] };

        case "INTAKE_UPDATED":
            return {
                ...state,
                intake: { ...state.intake, [action.field]: action.value },
                audit: audit(
                    state,
                    "intake.updated",
                    `${action.source === "voice" ? "Voice agent" : "Human agent"} set ${action.field} = ${JSON.stringify(action.value)}`,
                ),
            };

        case "INTAKE_COMPLETED":
            return {
                ...state,
                intakeComplete: true,
                status: "intake-complete",
                audit: audit(state, "intake.completed", "Intake marked complete."),
            };

        case "DAMAGE_ASSESSED":
            return {
                ...state,
                damage: action.damage,
                damageImageUrls: action.imageUrls,
                status: "damage-assessed",
                audit: audit(
                    state,
                    "damage.assessed",
                    `Damage: ${action.damage.type} (severity ${action.damage.severity}, ${action.damage.drivability}, conf ${action.damage.confidence.toFixed(2)}, via ${action.damage.provider}).`,
                ),
            };

        case "COVERAGE_DECIDED":
            return {
                ...state,
                coverage: action.coverage,
                status: "coverage-decided",
                audit: audit(
                    state,
                    "coverage.decided",
                    `${action.coverage.covered ? "COVERED" : "NOT COVERED"} — clause ${action.coverage.clauseRef}, deductible ${action.coverage.deductibleUsd ?? "N/A"}.`,
                ),
            };

        case "DISPATCH_PLANNED":
            return {
                ...state,
                dispatch: action.dispatch,
                status: "dispatch-ready",
                audit: audit(
                    state,
                    "dispatch.planned",
                    `Recommendation: ${action.dispatch.primary.dispatchType} via ${action.dispatch.primary.providerName}, ETA ${action.dispatch.primary.etaMin} min.`,
                ),
            };

        case "DISPATCH_APPROVED":
            return {
                ...state,
                approvedDispatch: action.candidate,
                status: "dispatched",
                audit: audit(
                    state,
                    "dispatch.approved",
                    `Agent approved dispatch: ${action.candidate.dispatchType} via ${action.candidate.providerName}.`,
                ),
            };

        case "MESSAGE_DRAFTED":
            return {
                ...state,
                draftMessage: action.body,
                audit: audit(state, "message.drafted", "AI drafted customer SMS."),
            };

        case "MESSAGE_EDITED":
            return { ...state, draftMessage: action.body };

        case "SMS_SENT":
            return {
                ...state,
                smsMessages: [...state.smsMessages, action.sms],
                status: "notified",
                audit: audit(
                    state,
                    "sms.sent",
                    `Sent SMS to ${state.customer?.phone ?? "customer"}.`,
                ),
            };
    }
}

const CaseContext = createContext<{
    state: CaseState;
    dispatch: React.Dispatch<Action>;
} | null>(null);

export function CaseProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const value = useMemo(() => ({ state, dispatch }), [state]);
    return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase() {
    const ctx = useContext(CaseContext);
    if (!ctx) throw new Error("useCase must be used inside <CaseProvider>");
    return ctx;
}
