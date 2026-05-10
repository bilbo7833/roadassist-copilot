"use client";

// Case orchestrator — the explicit state machine that runs AFTER the voice
// intake completes. Per the challenge spec:
//
//   1. Voice agent gathers info → call ends.
//   2. AI runs coverage check (silent backend step).
//   3. If covered, AI runs next-best-action (silent backend step).
//   4. Human approves dispatch (the only manual gate, covered branch only).
//   5. AI drafts SMS → SMS auto-sent.
//
// Trigger graph:
//   damage-assessed                  →  coverage-check
//   coverage-decided (covered=true)  →  next-best-action
//   coverage-decided (covered=false) →  draft "not covered" SMS (no auto-send)
//                                       → HUMAN: click Send to notify customer
//                                       → specialist follow-up off-screen
//   HUMAN: Approve dispatch          →  draft + auto-send "dispatched" SMS
//
// Each transition is guarded by a useRef so it fires once per case.

import { useEffect, useRef } from "react";
import { useCase } from "@/lib/case";
import { api } from "@/lib/api";
import type { IntakeData } from "@/lib/types";

export function useOrchestrator() {
    const { state, dispatch } = useCase();

    const coverageStartedRef = useRef(false);
    const nbaStartedRef = useRef(false);
    const messageStartedRef = useRef(false);

    // Reset guards when a new case is opened.
    useEffect(() => {
        coverageStartedRef.current = false;
        nbaStartedRef.current = false;
        messageStartedRef.current = false;
    }, [state.customer?.id]);

    // -- damage-assessed AND intake-complete → coverage-check.
    // Damage may run earlier (in parallel with the call) since photos are
    // valid mid-intake input, but coverage must wait until the voice agent
    // has finished gathering — per the challenge spec ("after voice agent
    // conversation, AI agent takes information…").
    useEffect(() => {
        if (
            state.damage &&
            state.intakeComplete &&
            !state.coverage &&
            !coverageStartedRef.current &&
            state.customer
        ) {
            coverageStartedRef.current = true;
            const intake: IntakeData = state.intake;
            (async () => {
                try {
                    const cov = await api.coverageCheck({
                        intake,
                        damage: state.damage!,
                        policyId: state.customer!.policyId,
                    });
                    dispatch({ type: "COVERAGE_DECIDED", coverage: cov });
                } catch (e) {
                    console.error("[orchestrator] coverage-check failed:", e);
                }
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.damage, state.coverage, state.intakeComplete]);

    // -- coverage-decided (covered) → next-best-action
    useEffect(() => {
        if (
            !state.coverage ||
            !state.coverage.covered ||
            state.coverage.needsHumanReview ||
            nbaStartedRef.current ||
            !state.customer ||
            !state.damage
        ) {
            return;
        }
        nbaStartedRef.current = true;
        (async () => {
            try {
                const plan = await api.nextBestAction({
                    customer: state.customer!,
                    intake: state.intake,
                    damage: state.damage!,
                    policyId: state.customer!.policyId,
                });
                dispatch({ type: "DISPATCH_PLANNED", dispatch: plan });
            } catch (e) {
                console.error("[orchestrator] nba failed:", e);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.coverage]);

    // -- Customer SMS — drafted automatically; sent only with human approval.
    //
    // Two trigger conditions for drafting, mutually exclusive within a case:
    //   - Covered:    fires when the human approves a dispatch candidate.
    //                 (Approval implies authorization to notify the customer
    //                 → SMS is auto-sent in this branch.)
    //   - Not covered: fires immediately when coverage lands as not-covered
    //                 (or low-confidence / human-review). Draft only — the
    //                 human must click Send. The agent gets a chance to
    //                 review what we tell the customer before the bad-news
    //                 SMS goes out.
    useEffect(() => {
        if (messageStartedRef.current) return;
        if (!state.coverage || !state.customer || !state.damage) return;

        const covered = state.coverage.covered && !state.coverage.needsHumanReview;
        // Wait for the human to approve a dispatch on the covered branch.
        if (covered && !state.approvedDispatch) return;

        messageStartedRef.current = true;
        const candidate = state.approvedDispatch;

        (async () => {
            try {
                const draft = await api.draftMessage({
                    customer: state.customer!,
                    coverage: state.coverage!,
                    damage: state.damage!,
                    dispatch: candidate
                        ? {
                            providerName: candidate.providerName,
                            dispatchType: candidate.dispatchType,
                            etaMin: candidate.etaMin,
                        }
                        : undefined,
                });
                dispatch({ type: "MESSAGE_DRAFTED", body: draft.body });
                // Auto-send on the covered branch only — see comment above.
                if (covered) {
                    dispatch({
                        type: "SMS_SENT",
                        sms: {
                            id: `sms-${Date.now()}`,
                            timestamp: new Date().toISOString(),
                            from: "carrier",
                            body: draft.body.trim(),
                        },
                    });
                }
            } catch (e) {
                console.error("[orchestrator] draft failed:", e);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.coverage, state.approvedDispatch]);
}
