// /api/tts — synthesizes the agent's reply with OpenAI TTS and streams it
// straight back to the browser as MP3. The browser pipes the chunks into a
// MediaSource so playback starts before the file is complete (see lib/voice.ts).
//
// Falls back path: if this route fails, lib/voice.ts uses the browser's
// built-in speechSynthesis as a last resort so the demo never goes silent.

import { openaiTtsStream } from "@/lib/llm";

export const runtime = "nodejs";
// TTS is streamed; the function only stays alive while bytes are flowing.
// 60s is plenty for the longest agent reply.
export const maxDuration = 60;

// Tone-of-voice instructions baked into every TTS call. Kept here (not in
// MODELS) so it stays close to the route that uses it.
const TONE = `Warm, calm, empathetic. Speak as a roadside-assistance agent talking to a stressed customer on the phone. Slightly slower than conversational pace. Reassuring. Avoid corporate filler.`;

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as { text: string; voice?: string };
        if (!body.text?.trim()) {
            return new Response("text is required", { status: 400 });
        }
        // Hard cap to keep TTS bills predictable in the demo.
        const text = body.text.slice(0, 1000);

        const { body: stream, contentType } = await openaiTtsStream({
            text,
            voice: body.voice,
            instructions: TONE,
        });

        return new Response(stream, {
            status: 200,
            headers: {
                "content-type": contentType,
                "cache-control": "no-store",
                // Hint to any proxy that this is a streaming response.
                "transfer-encoding": "chunked",
            },
        });
    } catch (err) {
        console.error("[/api/tts]", err);
        return new Response(
            err instanceof Error ? err.message : "tts failed",
            { status: 500 },
        );
    }
}
