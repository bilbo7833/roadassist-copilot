// AI-6 — Customer SMS draft (gpt-5).
// One-shot under a tone-of-voice snippet; cockpit always edits + sends.
// On failure we return a safe template so the demo never stalls.

import { NextResponse } from "next/server";
import { openaiJson, MODELS } from "@/lib/llm";
import { MessageDraftSchema } from "@/lib/schemas";
import { MESSAGE_SYSTEM_PROMPT, messageUserPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        try {
            const raw = await openaiJson({
                agent: "message",
                model: MODELS.message,
                system: MESSAGE_SYSTEM_PROMPT,
                user: messageUserPrompt({
                    customer: body.customer,
                    coverage: body.coverage,
                    dispatch: body.dispatch,
                    damage: body.damage,
                }),
            });
            return NextResponse.json(MessageDraftSchema.parse(JSON.parse(raw)));
        } catch (err) {
            console.warn("[message] draft failed, using template:", err);
            const firstName = String(body.customer?.name ?? "").split(" ")[0] || "there";
            const d = body.dispatch ?? {};
            const damageType = body.damage?.type ? ` after the ${body.damage.type}` : "";
            const ded =
                body.coverage?.deductibleUsd != null
                    ? ` Deductible: $${body.coverage.deductibleUsd}.`
                    : "";
            return NextResponse.json({
                body:
                    `Hi ${firstName}, this is RoadAssist. We've dispatched ${d.providerName ?? "a provider"} ` +
                    `(${d.dispatchType ?? "service"})${damageType}. ETA about ${d.etaMin ?? "?"} minutes.` +
                    `${ded} You're covered. We'll keep you posted. — RoadAssist`,
            });
        }
    } catch (err) {
        console.error("[/api/draft-message]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "draft-message failed" },
            { status: 500 },
        );
    }
}
