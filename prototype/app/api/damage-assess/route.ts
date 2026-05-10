// AI-2 — Damage assessment.
// Primary: Gemini 3.1 Pro vision. Fallback: OpenAI GPT-5 vision.
// Cross-provider failover is the explicit hedge for demo day.
//
// Accepts 1..MAX_PHOTOS images and produces ONE consolidated assessment.
// The model reasons across all photos in a single call (worst-case severity,
// strongest evidence wins). See DAMAGE_SYSTEM_PROMPT in lib/prompts.ts.

import { NextResponse } from "next/server";
import { geminiVisionJson, openaiVisionJson, MODELS } from "@/lib/llm";
import { DamageAssessmentSchema } from "@/lib/schemas";
import { DAMAGE_SYSTEM_PROMPT, damageUserPrompt } from "@/lib/prompts";

export const runtime = "nodejs";

// Cap to keep token cost predictable + UI uncluttered.
const MAX_PHOTOS = 3;

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as {
            imageDataUrls: string[];
            transcriptSnippet?: string;
            vehicle?: string;
        };

        const urls = (body.imageDataUrls ?? []).slice(0, MAX_PHOTOS);
        if (urls.length === 0) {
            return NextResponse.json(
                { error: "imageDataUrls must contain at least one base64 data URL" },
                { status: 400 },
            );
        }

        const images: { base64: string; mimeType: string }[] = [];
        for (const url of urls) {
            const match = url.match(/^data:([^;]+);base64,(.*)$/);
            if (!match) {
                return NextResponse.json(
                    { error: "imageDataUrls entries must be base64 data URLs" },
                    { status: 400 },
                );
            }
            images.push({ mimeType: match[1], base64: match[2] });
        }

        const userText = damageUserPrompt(
            body.transcriptSnippet ?? "",
            body.vehicle,
            urls.length,
        );

        // 1. Primary: Gemini.
        try {
            const raw = await geminiVisionJson({
                agent: "damage-primary",
                model: MODELS.damagePrimary,
                system: DAMAGE_SYSTEM_PROMPT,
                userText,
                images,
            });
            const parsed = DamageAssessmentSchema.parse(JSON.parse(raw));
            return NextResponse.json({ ...parsed, provider: "gemini" });
        } catch (err) {
            console.warn("[damage] Gemini primary failed:", err);
        }

        // 2. Fallback: OpenAI vision.
        try {
            const raw = await openaiVisionJson({
                agent: "damage-fallback",
                model: MODELS.damageFallback,
                system: DAMAGE_SYSTEM_PROMPT,
                userText,
                imageDataUrls: urls,
            });
            const parsed = DamageAssessmentSchema.parse(JSON.parse(raw));
            return NextResponse.json({ ...parsed, provider: "openai" });
        } catch (err) {
            console.warn("[damage] OpenAI fallback failed:", err);
        }

        // 3. Both providers failed — escalate to human review.
        return NextResponse.json({
            type: "unknown",
            severity: 3,
            drivability: "unknown",
            confidence: 0,
            evidenceQuote: "automated assessment unavailable",
            recommendedAction: "human-review",
            notes: "Both vision providers failed — escalated for human review.",
            provider: "human-review",
        });
    } catch (err) {
        console.error("[/api/damage-assess]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "damage-assess failed" },
            { status: 500 },
        );
    }
}
