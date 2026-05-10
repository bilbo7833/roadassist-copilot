// AI-6 — Customer SMS draft (gpt-5).
// Two branches:
//   - COVERED   → drafts a dispatch confirmation (provider, ETA, deductible).
//   - NOT-COVERED → drafts a plain-language explanation + specialist-handoff
//                   message. No dispatch present.
// Cockpit auto-sends after dispatch approval (covered) or as soon as
// coverage lands as not-covered.

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
                    damage: body.damage,
                    dispatch: body.dispatch,
                }),
            });
            return NextResponse.json(MessageDraftSchema.parse(JSON.parse(raw)));
        } catch (err) {
            console.warn("[message] draft failed, using template:", err);
            const firstName = String(body.customer?.name ?? "").split(" ")[0] || "there";
            const damageType = body.damage?.type ? ` after the ${body.damage.type}` : "";

            if (body.coverage?.covered && body.dispatch) {
                const d = body.dispatch;
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

            // Not-covered template fallback.
            const reason = body.coverage?.reason
                ? ` ${String(body.coverage.reason).replace(/\.$/, "")}.`
                : "";
            return NextResponse.json({
                body:
                    `Hi ${firstName}, this is RoadAssist. Thanks for the call${damageType}. ` +
                    `Unfortunately this isn't covered under your current policy.${reason} ` +
                    `A specialist will reach out shortly to walk you through your options. — RoadAssist`,
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
