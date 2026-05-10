"use client";

// Customer panel (left column) — customer picker + voice call transcript
// (the bulk of the column), a small photo-upload strip pinned above, and
// the fake SMS pane pinned at the bottom.

import { useEffect, useRef, useState } from "react";
import customers from "@/data/customers.json";
import { useCase } from "@/lib/case";
import { useVoice } from "@/lib/voice";
import { api } from "@/lib/api";
import type { Customer, IntakeData } from "@/lib/types";
import { FakeSmsPane } from "@/components/FakeSmsPane";

export function CustomerPanel() {
    const { state, dispatch } = useCase();
    const voice = useVoice();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detailsProvided, setDetailsProvided] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Pre-warm TTS voices (Chrome loads them async).
    useEffect(() => {
        if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.getVoices();
        }
    }, []);

    // Auto-scroll transcript to bottom on new turns.
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [state.transcript.length]);

    const customer = state.customer;

    function selectCustomer(id: string) {
        const c = (customers as Customer[]).find((x) => x.id === id);
        if (c) {
            dispatch({ type: "SELECT_CUSTOMER", customer: c });
            setDetailsProvided(false);
        }
    }

    // Simulates the customer answering Q1 (identity) and Q2 (location) by
    // reading the profile and pushing it into the call as a customer-spoken
    // line. The agent processes it as any other answer.
    function provideMyDetails() {
        if (!customer || busy) return;
        const utterance =
            `My name is ${customer.name}. ` +
            `My policy number is ${customer.policyId}. ` +
            `My vehicle registration is ${customer.vehicle.registration}. ` +
            `I'm at ${customer.currentLocation.label}.`;
        setDetailsProvided(true);
        handleUserTurn(utterance);
    }

    async function handleUserTurn(utterance: string) {
        if (!customer) return;
        dispatch({
            type: "TRANSCRIPT_APPEND",
            turn: {
                id: `t-${Date.now()}`,
                timestamp: new Date().toISOString(),
                role: "customer",
                text: utterance,
            },
        });

        setBusy(true);
        setError(null);
        try {
            const intakeForRequest: IntakeData = state.intake;
            const reply = await api.intakeTurn({
                conversationHistory: state.transcript
                    .filter((t) => t.role !== "system")
                    .map((t) => ({ role: t.role as "agent" | "customer", text: t.text })),
                lastUserUtterance: utterance,
                currentIntake: intakeForRequest,
            });

            for (const tc of reply.toolCalls) {
                if (tc.name === "update_intake") {
                    dispatch({
                        type: "INTAKE_UPDATED",
                        field: tc.arguments.field as keyof IntakeData,
                        value: tc.arguments.value,
                        source: "voice",
                    });
                } else if (tc.name === "complete_intake") {
                    dispatch({ type: "INTAKE_COMPLETED" });
                }
            }

            dispatch({
                type: "TRANSCRIPT_APPEND",
                turn: {
                    id: `t-${Date.now()}-a`,
                    timestamp: new Date().toISOString(),
                    role: "agent",
                    text: reply.replyText,
                },
            });
            voice.speak(reply.replyText);
        } catch (e) {
            setError(e instanceof Error ? e.message : "intake-turn failed");
        } finally {
            setBusy(false);
        }
    }

    // Run damage assessment whenever the photo set changes. We accumulate
    // user-uploaded data URLs in component state and re-run once per change
    // (debounced by react's microtask). The model picks the worst case across
    // all photos in a single call — see DAMAGE_SYSTEM_PROMPT.
    async function runDamageAssessment(dataUrls: string[]) {
        if (!customer || dataUrls.length === 0) return;
        // Tell the intake agent that photos are now in hand (boolean only —
        // the photos themselves are processed by AI-2, not by intake).
        dispatch({
            type: "INTAKE_UPDATED",
            field: "photosUploaded",
            value: true,
            source: "agent",
        });
        setBusy(true);
        setError(null);
        try {
            const transcriptSnippet = state.transcript
                .filter((t) => t.role === "customer")
                .map((t) => t.text)
                .slice(-3)
                .join(" ");
            const damage = await api.damageAssess({
                imageDataUrls: dataUrls,
                transcriptSnippet,
                vehicle: state.intake.vehicle ?? `${customer.vehicle.year} ${customer.vehicle.make} ${customer.vehicle.model}`,
            });
            dispatch({ type: "DAMAGE_ASSESSED", damage, imageUrls: dataUrls });
        } catch (e) {
            setError(e instanceof Error ? e.message : "damage-assess failed");
        } finally {
            setBusy(false);
        }
    }

    function readAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    // Cap mirrors the server-side MAX_PHOTOS in /api/damage-assess.
    const MAX_PHOTOS = 3;

    async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        e.target.value = ""; // allow re-uploading the same file later
        if (files.length === 0) return;

        const newDataUrls = await Promise.all(files.map(readAsDataUrl));
        const merged = [...state.damageImageUrls, ...newDataUrls].slice(0, MAX_PHOTOS);
        await runDamageAssessment(merged);
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-3 p-3">
            {/* Customer picker — slim */}
            <section className="shrink-0 rounded-md border border-zinc-200 bg-white p-3">
                <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Pretend you are calling as
                </label>
                <select
                    className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                    value={customer?.id ?? ""}
                    onChange={(e) => selectCustomer(e.target.value)}
                >
                    <option value="" disabled>
                        Pick a customer…
                    </option>
                    {(customers as Customer[]).map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name} — {c.vehicle.year} {c.vehicle.make} {c.vehicle.model} ({c.policyId})
                        </option>
                    ))}
                </select>
            </section>

            {/* Voice + transcript card — fills the column */}
            <section className="flex min-h-0 flex-1 flex-col rounded-md border border-zinc-200 bg-white p-3">
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                        disabled={!customer || !voice.supported || busy}
                        onClick={() => (voice.listening ? voice.stop() : voice.start(handleUserTurn))}
                        aria-pressed={voice.listening}
                        className={`rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-zinc-300 ${voice.listening
                            ? "animate-pulse bg-red-600 shadow-lg shadow-red-600/40 ring-2 ring-red-300 hover:bg-red-700"
                            : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                    >
                        {voice.listening ? "■ Stop recording" : "🎙 Start recording"}
                    </button>
                    <button
                        type="button"
                        disabled={!customer || busy || voice.listening || detailsProvided}
                        onClick={provideMyDetails}
                        className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Auto-answer the agent's identity question with this customer's profile."
                    >
                        {detailsProvided ? "✓ Details sent" : "Provide my details"}
                    </button>
                    <span className="text-xs text-zinc-500">
                        {!voice.supported
                            ? "Chrome or Edge required for voice."
                            : voice.listening
                                ? "Recording — press Stop when you're done."
                                : busy
                                    ? "Thinking…"
                                    : customer
                                        ? "Press Start to talk."
                                        : "Pick a customer first."}
                    </span>
                </div>

                {voice.error && <p className="mt-2 shrink-0 text-xs text-red-600">{voice.error}</p>}
                {error && <p className="mt-2 shrink-0 text-xs text-red-600">{error}</p>}

                <div className="mt-3 flex-1 overflow-y-auto rounded border border-zinc-100 bg-zinc-50 p-2">
                    {state.transcript.length === 0 && (
                        <p className="text-xs text-zinc-400">
                            Transcript will appear here once the call starts.
                        </p>
                    )}
                    <ul className="space-y-2 text-sm">
                        {state.transcript.map((t) =>
                            t.role === "system" ? (
                                <li
                                    key={t.id}
                                    className="rounded border border-dashed border-zinc-300 bg-white px-2 py-1 text-xs italic text-zinc-600"
                                >
                                    ⓘ {t.text}
                                </li>
                            ) : (
                                <li key={t.id}>
                                    <span
                                        className={
                                            t.role === "agent"
                                                ? "font-semibold text-emerald-700"
                                                : "font-semibold text-zinc-700"
                                        }
                                    >
                                        {t.role === "agent" ? "Agent" : customer?.name?.split(" ")[0] ?? "You"}:
                                    </span>{" "}
                                    <span className="text-zinc-800">{t.text}</span>
                                </li>
                            ),
                        )}
                        {voice.interim && (
                            <li className="italic text-zinc-500">
                                <span className="font-semibold text-zinc-700">
                                    {customer?.name?.split(" ")[0] ?? "You"}:
                                </span>{" "}
                                {voice.interim}…
                            </li>
                        )}
                        <div ref={transcriptEndRef} />
                    </ul>
                </div>

                {/* Photo upload — small strip pinned at the bottom of the call card.
                    Up to MAX_PHOTOS images. The model picks the worst case
                    across all of them in a single AI-2 call. */}
                <div className="mt-3 flex shrink-0 items-center gap-2 rounded border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                            Damage photos ({state.damageImageUrls.length}/{MAX_PHOTOS})
                        </p>
                        {state.damageImageUrls.length > 0 ? (
                            <p className="truncate text-xs text-zinc-700">
                                {state.damageImageUrls.length === 1
                                    ? "1 photo attached — AI-2 has assessed it."
                                    : `${state.damageImageUrls.length} photos attached — AI-2 reasoned across all of them.`}
                            </p>
                        ) : (
                            <p className="text-xs text-zinc-400">Optional — attach 1 to {MAX_PHOTOS} photos to run damage AI.</p>
                        )}
                    </div>
                    {state.damageImageUrls.length > 0 && (
                        <div className="flex items-center gap-1">
                            {state.damageImageUrls.map((url, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    key={i}
                                    src={url}
                                    alt={`damage thumbnail ${i + 1}`}
                                    className="h-10 w-10 rounded border border-zinc-200 object-cover"
                                />
                            ))}
                        </div>
                    )}
                    <button
                        disabled={!customer || busy || state.damageImageUrls.length >= MAX_PHOTOS}
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50"
                    >
                        {state.damageImageUrls.length === 0
                            ? "Upload…"
                            : state.damageImageUrls.length >= MAX_PHOTOS
                                ? "Max reached"
                                : "Add more…"}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={onFileChange}
                    />
                </div>
            </section>

            {/* SMS pinned at the bottom of the column */}
            <section className="shrink-0">
                <FakeSmsPane />
            </section>
        </div>
    );
}
