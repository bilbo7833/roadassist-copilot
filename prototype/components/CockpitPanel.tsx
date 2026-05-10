"use client";

// Agent cockpit (right column).
//
// Three cards top-to-bottom:
//   1. Intake       — single editable textarea, populated by the voice agent.
//   2. AI workspace — shows damage → coverage → dispatch → SMS as the AI
//                     orchestrator finishes each step. Two human gates live
//                     here: "Approve dispatch" and "Send SMS".
//   3. Audit log    — fills the remaining vertical space with its own scroll.
//
// The orchestrator (`useOrchestrator`) is the explicit state machine: when
// damage lands it auto-runs coverage; when coverage lands it auto-runs NBA;
// when the human approves a dispatch it auto-drafts the SMS.

import { useEffect, useMemo, useState } from "react";
import { useCase } from "@/lib/case";
import { useOrchestrator } from "@/lib/orchestrator";
import type {
    CoverageDecision,
    DamageAssessment,
    DispatchCandidate,
    DispatchPlan,
    IntakeData,
} from "@/lib/types";

// Render the structured intake (filled by voice tool calls) as an editable
// plain-text summary. Edits flow into intake.notes so coverage + NBA see them.
function buildIntakeSummary(intake: IntakeData): string {
    const lines: string[] = [];
    if (intake.name) lines.push(`Caller: ${intake.name}`);
    if (intake.vehicle) lines.push(`Vehicle: ${intake.vehicle}`);
    if (intake.registrationNumber) lines.push(`Registration: ${intake.registrationNumber}`);
    if (intake.policyId) lines.push(`Policy: ${intake.policyId}`);
    if (intake.location) lines.push(`Location: ${intake.location}`);
    if (intake.situation) lines.push(`Situation: ${intake.situation}`);
    if (intake.damageDescription) lines.push(`Damage: ${intake.damageDescription}`);
    if (intake.drivability) lines.push(`Drivability: ${intake.drivability}`);
    if (intake.cause) lines.push(`Cause: ${intake.cause.replace("-", " ")}`);
    if (intake.safetyConcerns) lines.push(`Safety concerns: ${intake.safetyConcerns}`);
    if (intake.injuriesReported) lines.push(`⚠ Injuries reported — escalate to live specialist.`);
    if (intake.photosUploaded) lines.push(`📎 Photos attached.`);
    else if (intake.photosRequested) lines.push(`📎 Agent requested photos — awaiting upload.`);
    return lines.join("\n");
}

export function CockpitPanel() {
    const { state, dispatch } = useCase();
    const [error, setError] = useState<string | null>(null);
    const [notesEdited, setNotesEdited] = useState(false);
    const [notes, setNotes] = useState("");

    // Drive the auto-pipeline (silent backend steps after intake).
    useOrchestrator();

    const customer = state.customer;
    const intake = state.intake;
    const damage = state.damage;
    const coverage = state.coverage;
    const plan = state.dispatch;

    const autoSummary = useMemo(
        () => (customer ? buildIntakeSummary(intake) : ""),
        [customer, intake],
    );
    useEffect(() => {
        if (!notesEdited) setNotes(autoSummary);
    }, [autoSummary, notesEdited]);

    // The auto-pipeline runs without manual buttons; the human still gates
    // the irreversible actions (dispatch + SMS).
    function approveDispatch(candidate: DispatchCandidate) {
        if (!customer || !coverage) return;
        dispatch({ type: "DISPATCH_APPROVED", candidate });
    }

    function sendSms() {
        if (!state.draftMessage.trim()) return;
        dispatch({
            type: "SMS_SENT",
            sms: {
                id: `sms-${Date.now()}`,
                timestamp: new Date().toISOString(),
                from: "carrier",
                body: state.draftMessage.trim(),
            },
        });
    }

    if (!customer) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-sm text-zinc-500">
                Pick a customer on the left to open a case.
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-3 p-4">
            {error && (
                <div className="shrink-0 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {error}
                </div>
            )}

            {/* Intake summary — editable textarea */}
            <Card
                title="Intake"
                subtitle={
                    state.intakeComplete
                        ? "complete"
                        : Object.values(intake).some(Boolean)
                            ? "in progress"
                            : "awaiting voice intake"
                }
                action={
                    notesEdited ? (
                        <button
                            onClick={() => {
                                setNotesEdited(false);
                                setNotes(autoSummary);
                            }}
                            className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
                        >
                            Reset to AI extraction
                        </button>
                    ) : null
                }
            >
                <textarea
                    value={notes}
                    onChange={(e) => {
                        setNotes(e.target.value);
                        setNotesEdited(true);
                    }}
                    rows={6}
                    placeholder="Voice intake will fill this in. You can edit it before the AI runs coverage."
                    className="w-full resize-none rounded border border-zinc-200 bg-white p-2 font-mono text-xs text-zinc-800"
                />
            </Card>

            {/* Single AI decisioning card with sections that light up in order. */}
            <Card title="AI decisioning" subtitle="auto-running…">
                <div className="space-y-3">
                    <DamageSection damage={damage} />
                    <Divider />
                    <CoverageSection coverage={coverage} ready={Boolean(damage)} />
                    <Divider />
                    <DispatchSection
                        plan={plan}
                        ready={Boolean(coverage?.covered)}
                        approvedId={state.approvedDispatch?.providerId}
                        onApprove={approveDispatch}
                    />
                    <Divider />
                    <MessageSection
                        draft={state.draftMessage}
                        sent={state.smsMessages.length > 0}
                        onChange={(body) =>
                            dispatch({ type: "MESSAGE_EDITED", body })
                        }
                        onSend={sendSms}
                        ready={Boolean(state.approvedDispatch)}
                    />
                </div>
            </Card>

            {/* Audit log — flex-1, internal scroll */}
            <AuditCard />
        </div>
    );
}

// -- Sections of the AI decisioning card -------------------------------------

function StepHeader({
    step,
    title,
    state,
}: {
    step: number;
    title: string;
    state: "waiting" | "running" | "done" | "fail";
}) {
    const dot = {
        waiting: "bg-zinc-300",
        running: "bg-amber-400 animate-pulse",
        done: "bg-emerald-500",
        fail: "bg-red-500",
    }[state];
    return (
        <div className="flex items-center gap-2">
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${dot}`}>
                {step}
            </span>
            <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-400">
                {state === "running" ? "running…" : state === "done" ? "done" : state === "fail" ? "failed" : "waiting"}
            </span>
        </div>
    );
}

function DamageSection({ damage }: { damage: DamageAssessment | null }) {
    const status = damage ? "done" : "waiting";
    return (
        <section>
            <StepHeader step={1} title="Damage assessment" state={status} />
            <div className="mt-1 pl-7 text-sm">
                {!damage && (
                    <p className="text-xs text-zinc-500">Will run when the customer uploads a photo.</p>
                )}
                {damage && (
                    <div className="space-y-1">
                        <p>
                            <strong>{damage.type}</strong>{" "}
                            <SeverityBadge severity={damage.severity} />{" "}
                            <DrivabilityBadge drivability={damage.drivability} />
                        </p>
                        <p className="text-xs italic text-zinc-600">“{damage.evidenceQuote}”</p>
                        <p className="text-[11px] text-zinc-500">
                            Recommendation: <em>{damage.recommendedAction}</em> · confidence {Math.round(damage.confidence * 100)}% · via {damage.provider}
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}

function CoverageSection({
    coverage,
    ready,
}: {
    coverage: CoverageDecision | null;
    ready: boolean;
}) {
    const status: "waiting" | "running" | "done" | "fail" = coverage
        ? coverage.covered ? "done" : "fail"
        : ready ? "running" : "waiting";
    return (
        <section>
            <StepHeader step={2} title="Coverage decision" state={status} />
            <div className="mt-1 pl-7 text-sm">
                {!ready && (
                    <p className="text-xs text-zinc-500">Waits for the damage assessment.</p>
                )}
                {ready && !coverage && (
                    <p className="text-xs text-zinc-500">Reading the policy now…</p>
                )}
                {coverage && (
                    <div className="space-y-1">
                        <p>
                            <CoverageBadge covered={coverage.covered} />{" "}
                            <span className="text-zinc-700">·</span>{" "}
                            <span className="text-zinc-800">
                                Deductible{" "}
                                <strong>
                                    {coverage.deductibleUsd != null ? `$${coverage.deductibleUsd}` : "n/a"}
                                </strong>
                            </span>{" "}
                            <span className="text-zinc-700">·</span>{" "}
                            <span className="text-[11px] text-zinc-500">
                                clause <strong>{coverage.clauseRef}</strong> · confidence {Math.round(coverage.confidence * 100)}%
                            </span>
                        </p>
                        <p className="text-xs text-zinc-700">{coverage.reason}</p>
                        {coverage.clauseQuote && (
                            <p className="rounded bg-zinc-100 px-2 py-1 text-[11px] italic text-zinc-700">
                                “{coverage.clauseQuote}”
                            </p>
                        )}
                        {coverage.needsHumanReview && (
                            <p className="rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-800">
                                Low confidence — flagged for human review.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

function DispatchSection({
    plan,
    ready,
    approvedId,
    onApprove,
}: {
    plan: DispatchPlan | null;
    ready: boolean;
    approvedId?: string;
    onApprove: (c: DispatchCandidate) => void;
}) {
    const status: "waiting" | "running" | "done" | "fail" = plan
        ? approvedId ? "done" : "running"
        : ready ? "running" : "waiting";
    return (
        <section>
            <StepHeader step={3} title="Dispatch" state={status} />
            <div className="mt-1 pl-7 text-sm">
                {!ready && (
                    <p className="text-xs text-zinc-500">Waits for a covered claim.</p>
                )}
                {ready && !plan && (
                    <p className="text-xs text-zinc-500">Locating the closest provider…</p>
                )}
                {plan && (
                    <div className="space-y-2">
                        <CandidateRow
                            candidate={plan.primary}
                            tag="Recommended"
                            approved={approvedId === plan.primary.providerId}
                            onApprove={() => onApprove(plan.primary)}
                            disabled={!!approvedId}
                        />
                        {plan.alternates.length > 0 && (
                            <details className="text-xs">
                                <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700">
                                    Show {plan.alternates.length} alternate{plan.alternates.length > 1 ? "s" : ""}
                                </summary>
                                <div className="mt-1 space-y-1">
                                    {plan.alternates.map((alt) => (
                                        <CandidateRow
                                            key={alt.providerId}
                                            candidate={alt}
                                            tag="Alternate"
                                            approved={approvedId === alt.providerId}
                                            onApprove={() => onApprove(alt)}
                                            disabled={!!approvedId}
                                        />
                                    ))}
                                </div>
                            </details>
                        )}
                        <p className="text-[11px] italic text-zinc-500">{plan.rationale}</p>
                    </div>
                )}
            </div>
        </section>
    );
}

function MessageSection({
    draft,
    sent,
    onChange,
    onSend,
    ready,
}: {
    draft: string;
    sent: boolean;
    onChange: (b: string) => void;
    onSend: () => void;
    ready: boolean;
}) {
    const status: "waiting" | "running" | "done" | "fail" = sent
        ? "done"
        : draft
            ? "running"
            : ready ? "running" : "waiting";
    return (
        <section>
            <StepHeader step={4} title="Customer SMS" state={status} />
            <div className="mt-1 pl-7">
                {!ready && (
                    <p className="text-xs text-zinc-500">Waits for dispatch approval.</p>
                )}
                {ready && !draft && (
                    <p className="text-xs text-zinc-500">Drafting the message…</p>
                )}
                {draft && (
                    <>
                        <textarea
                            value={draft}
                            onChange={(e) => onChange(e.target.value)}
                            rows={3}
                            disabled={sent}
                            className="w-full resize-none rounded border border-zinc-300 bg-white p-2 text-sm disabled:bg-zinc-50"
                        />
                        <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-zinc-500">{draft.length} chars</span>
                            <button
                                disabled={sent}
                                onClick={onSend}
                                className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {sent ? "✓ Sent" : "Send SMS"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}

// -- Audit log card ----------------------------------------------------------

function AuditCard() {
    const { state } = useCase();
    return (
        <section className="flex min-h-0 flex-1 flex-col rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
            <header className="mb-2 flex shrink-0 items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-zinc-800">Audit log</h2>
                    <p className="text-xs text-zinc-500">{state.audit.length} events</p>
                </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto rounded border border-zinc-100 bg-zinc-50 p-2">
                <ul className="space-y-1 text-xs">
                    {state.audit.length === 0 && (
                        <li className="text-zinc-400">No events yet.</li>
                    )}
                    {state.audit.map((e) => (
                        <li key={e.id} className="flex gap-2">
                            <span className="font-mono text-zinc-400">
                                {new Date(e.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="font-medium text-zinc-600">{e.type}</span>
                            <span className="text-zinc-700">{e.detail}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

// -- Small presentational helpers --------------------------------------------

function Card({
    title,
    subtitle,
    action,
    children,
}: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="shrink-0 rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
            <header className="mb-2 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
                    {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
                </div>
                {action}
            </header>
            {children}
        </section>
    );
}

function Divider() {
    return <div className="h-px bg-zinc-100" />;
}

function SeverityBadge({ severity }: { severity: number }) {
    const tone =
        severity >= 4 ? "bg-red-100 text-red-700"
            : severity >= 3 ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800";
    return (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
            severity {severity}/5
        </span>
    );
}

function DrivabilityBadge({ drivability }: { drivability: string }) {
    const label = drivability.replace("-", " ");
    const tone =
        drivability === "drivable" ? "bg-emerald-100 text-emerald-800"
            : drivability === "not-drivable" ? "bg-red-100 text-red-700"
                : "bg-zinc-200 text-zinc-700";
    return (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
            {label}
        </span>
    );
}

function CoverageBadge({ covered }: { covered: boolean }) {
    return (
        <span
            className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${covered ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                }`}
        >
            {covered ? "Covered" : "Not covered"}
        </span>
    );
}

function CandidateRow({
    candidate,
    tag,
    approved,
    onApprove,
    disabled,
}: {
    candidate: DispatchCandidate;
    tag: string;
    approved: boolean;
    onApprove: () => void;
    disabled: boolean;
}) {
    return (
        <div
            className={`rounded border p-2 text-sm ${approved ? "border-emerald-500 bg-emerald-50" : "border-zinc-200"
                }`}
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">{tag}</span>
                <button
                    disabled={disabled && !approved}
                    onClick={onApprove}
                    className={`rounded px-2 py-0.5 text-xs font-medium ${approved
                        ? "bg-emerald-600 text-white"
                        : "border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                    {approved ? "✓ Approved" : "Approve dispatch"}
                </button>
            </div>
            <p className="font-medium text-zinc-800">
                <strong>{candidate.dispatchType}</strong> · {candidate.providerName}
            </p>
            <p className="text-xs text-zinc-600">
                {candidate.distanceMi} mi · ETA <strong>{candidate.etaMin} min</strong>
            </p>
            <p className="text-xs italic text-zinc-500">{candidate.rationale}</p>
        </div>
    );
}
