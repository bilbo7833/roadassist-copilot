// AI-1 — Voice intake agent (turn-based, gpt-5).
// Browser sends conversation history + last utterance + current intake.
// We return spoken replyText + tool calls (update_intake / complete_intake).

import { NextResponse } from "next/server";
import { openaiJson, MODELS } from "@/lib/llm";
import { IntakeTurnRequestSchema, IntakeTurnResponseSchema } from "@/lib/schemas";
import { INTAKE_SYSTEM_PROMPT, intakeUserBlock } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const body = IntakeTurnRequestSchema.parse(await req.json());
        const raw = await openaiJson({
            agent: "intake",
            model: MODELS.intake,
            system: INTAKE_SYSTEM_PROMPT,
            user: intakeUserBlock(body),
        });
        const parsed = IntakeTurnResponseSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return NextResponse.json(parsed.data);

        // If the model returns invalid JSON, the call doesn't hang; we just ask
        // the customer to repeat. The cockpit can edit fields manually.
        console.warn("[intake-turn] schema mismatch:", parsed.error.message);
        return NextResponse.json({
            replyText: "Sorry, could you say that again?",
            toolCalls: [],
        });
    } catch (err) {
        console.error("[/api/intake-turn]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "intake-turn failed" },
            { status: 500 },
        );
    }
}
