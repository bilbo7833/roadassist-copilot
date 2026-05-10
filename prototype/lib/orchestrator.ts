"use client";

// Case orchestrator — the explicit state machine that runs AFTER the voice
// intake completes. Per the challenge spec:
//
//   1. Voice agent gathers info → call ends.
//   2. AI runs coverage check (silent backend step).
//   3. If covered, AI runs next-best-action (silent backend step).
//   4. Human approves dispatch (the only manual gate).
//   5. AI drafts SMS → human approves → SMS sent.
////
// Trigger graph:
//   damage-assessed                  →  coverage-check
//   coverage-decided (covered=true)  →  next-best-action
//   coverage-decided (covered=false) →  STOP (cockpit shows "needs review")
//   HUMAN: Approve dispatch          →  draft-message
//   HUMAN: Send SMS                  →  end
//
// Each transition is guarded by a useRef so it fires once per case.

import { useEffect, useRef } from "react";
import { useCase } from "@/lib/case";
import { api } from "@/lib/api";
import type { DispatchCandidate, IntakeData } from "@/lib/types";

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

    // -- damage-assessed → coverage-check
    useEffect(() => {
        if (
            state.damage &&
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
    }, [state.damage, state.coverage]);

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

    // -- dispatch approved → draft-message
    useEffect(() => {
        if (!state.approvedDispatch || messageStartedRef.current) return;
        messageStartedRef.current = true;

        const candidate: DispatchCandidate = state.approvedDispatch;
        (async () => {
            try {
                const draft = await api.draftMessage({
                    customer: state.customer!,
                    coverage: state.coverage!,
                    dispatch: {
                        providerName: candidate.providerName,
                        dispatchType: candidate.dispatchType,
                        etaMin: candidate.etaMin,
                    },
                });
                dispatch({ type: "MESSAGE_DRAFTED", body: draft.body });
            } catch (e) {
                console.error("[orchestrator] draft failed:", e);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.approvedDispatch]);
}
