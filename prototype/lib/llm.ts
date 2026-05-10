// Provider adapters + per-agent model registry.
// Both providers expose JSON-mode + (optionally) inline image input. Each
// route owns its own retry / Zod validation / guardrail.
//
// Every call is logged: provider, model, agent, duration, output length,
// and (on error) the error message. Logs land in `npm run dev` stdout.

import OpenAI from "openai";
import type { ResponseInput } from "openai/resources/responses/responses";
import { GoogleGenAI } from "@google/genai";

// -- Per-agent model registry. Override any of these via env. -----------------
export const MODELS = {
    intake: process.env.LLM_INTAKE_MODEL ?? "gpt-5",
    damagePrimary: process.env.LLM_DAMAGE_MODEL ?? "gemini-3.1-pro",
    damageFallback: process.env.LLM_DAMAGE_FALLBACK_MODEL ?? "gpt-5",
    coverage: process.env.LLM_COVERAGE_MODEL ?? "gpt-5",
    nba: process.env.LLM_NBA_MODEL ?? "gpt-5",
    message: process.env.LLM_MESSAGE_MODEL ?? "gpt-5",
} as const;

// Names of the AI agents from PRD §6 — used as a log tag so server output is
// trivially greppable per agent.
export type AgentTag =
    | "intake"
    | "damage-primary"
    | "damage-fallback"
    | "coverage"
    | "nba"
    | "message";

function logStart(agent: AgentTag, provider: "openai" | "gemini", model: string) {
    // ISO timestamp keeps lines greppable + sortable.
    console.log(
        `[llm] ▶ start  agent=${agent.padEnd(16)} provider=${provider.padEnd(7)} model=${model}`,
    );
    return Date.now();
}
function logEnd(
    agent: AgentTag,
    provider: "openai" | "gemini",
    model: string,
    startedAt: number,
    outputLen: number,
) {
    const ms = Date.now() - startedAt;
    console.log(
        `[llm] ✓ done   agent=${agent.padEnd(16)} provider=${provider.padEnd(7)} model=${model} duration=${ms}ms output=${outputLen}ch`,
    );
}
function logErr(
    agent: AgentTag,
    provider: "openai" | "gemini",
    model: string,
    startedAt: number,
    err: unknown,
) {
    const ms = Date.now() - startedAt;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(
        `[llm] ✗ error  agent=${agent.padEnd(16)} provider=${provider.padEnd(7)} model=${model} duration=${ms}ms error=${msg.slice(0, 200)}`,
    );
}

// -- OpenAI -------------------------------------------------------------------

let openai: OpenAI | null = null;
function openaiClient(): OpenAI {
    if (openai) return openai;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    return (openai = new OpenAI({ apiKey }));
}

export async function openaiJson(args: {
    agent: AgentTag;
    model: string;
    system: string;
    user: string | ResponseInput;
    reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh";
}): Promise<string> {
    const startedAt = logStart(args.agent, "openai", args.model);
    try {
        const input: ResponseInput =
            typeof args.user === "string"
                ? [
                    { role: "system", content: args.system },
                    { role: "user", content: args.user },
                ]
                : [{ role: "system", content: args.system }, ...args.user];
        const resp = await openaiClient().responses.create({
            model: args.model,
            input,
            reasoning: { effort: args.reasoningEffort ?? "low" },
            text: { format: { type: "json_object" } },
        });
        logEnd(args.agent, "openai", args.model, startedAt, resp.output_text.length);
        return resp.output_text;
    } catch (err) {
        logErr(args.agent, "openai", args.model, startedAt, err);
        throw err;
    }
}

export async function openaiVisionJson(args: {
    agent: AgentTag;
    model: string;
    system: string;
    userText: string;
    imageDataUrls: string[];
}): Promise<string> {
    const startedAt = logStart(args.agent, "openai", args.model);
    try {
        const resp = await openaiClient().responses.create({
            model: args.model,
            input: [
                { role: "system", content: args.system },
                {
                    role: "user",
                    content: [
                        { type: "input_text", text: args.userText },
                        ...args.imageDataUrls.map(
                            (url) =>
                                ({ type: "input_image", image_url: url, detail: "auto" }) as const,
                        ),
                    ],
                },
            ],
            reasoning: { effort: "low" },
            text: { format: { type: "json_object" } },
        });
        logEnd(args.agent, "openai", args.model, startedAt, resp.output_text.length);
        return resp.output_text;
    } catch (err) {
        logErr(args.agent, "openai", args.model, startedAt, err);
        throw err;
    }
}

// -- Gemini -------------------------------------------------------------------

let gemini: GoogleGenAI | null = null;
function geminiClient(): GoogleGenAI {
    if (gemini) return gemini;
    const apiKey =
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    return (gemini = new GoogleGenAI({ apiKey }));
}

export async function geminiVisionJson(args: {
    agent: AgentTag;
    model: string;
    system: string;
    userText: string;
    images: { base64: string; mimeType: string }[];
}): Promise<string> {
    const startedAt = logStart(args.agent, "gemini", args.model);
    try {
        const resp = await geminiClient().models.generateContent({
            model: args.model,
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: args.userText },
                        ...args.images.map((img) => ({
                            inlineData: { data: img.base64, mimeType: img.mimeType },
                        })),
                    ],
                },
            ],
            config: { systemInstruction: args.system, responseMimeType: "application/json" },
        });
        const text = resp.text ?? "";
        logEnd(args.agent, "gemini", args.model, startedAt, text.length);
        return text;
    } catch (err) {
        logErr(args.agent, "gemini", args.model, startedAt, err);
        throw err;
    }
}
