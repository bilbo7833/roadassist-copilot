"use client";

// Browser ASR (Web Speech API, push-to-talk) + cloud TTS (OpenAI via
// /api/tts), with a browser-TTS fallback when the cloud route fails.
//
// ASR: click 🎙 → continuous recognition until click ■, then onFinal fires
// with the buffered transcript. Robotic-sounding browser voices are NOT used
// for the agent's replies — that's the cloud TTS path.
//
// TTS queue: every speak() call enqueues an utterance. A single shared
// HTMLAudioElement plays them in order — no overlap, no double-talk. We
// cancel + flush the queue when the user starts recording (so they can
// interrupt the agent intentionally).
//
// Trade-offs documented in PROTOTYPE_PLAN: turn-based, Chrome/Edge only,
// the /api/intake-turn boundary is the swap-in point for OpenAI Realtime
// later (which would replace both this ASR and this TTS in one shot).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionEvent = {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type SpeechRecognitionLike = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
};

type WindowWithSpeech = Window & {
    webkitSpeechRecognition?: { new(): SpeechRecognitionLike };
    SpeechRecognition?: { new(): SpeechRecognitionLike };
};

function getRecognitionCtor() {
    if (typeof window === "undefined") return null;
    const w = window as WindowWithSpeech;
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Browser-TTS fallback for the rare case the cloud route fails. Picks the
// least-bad voice and speaks the line.
function fallbackBrowserSpeak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const v =
        voices.find(
            (x) =>
                x.lang.startsWith("en-") &&
                /premium|enhanced|natural|neural|siri|google/i.test(x.name),
        ) ??
        voices.find((x) => x.lang === "en-US") ??
        null;
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
}

// Pipe an MP3 stream straight into the audio element via MediaSource so
// playback starts as soon as the first chunks arrive — ~200-400ms instead of
// waiting for the whole file. Resolves when playback finishes; rejects on
// stream / playback errors.
//
// Logs timing markers to the browser console under [tts] so we can see if
// the chain is actually streaming (look for "first-byte → first-audio").
async function playStreamedMp3(
    audio: HTMLAudioElement,
    stream: ReadableStream<Uint8Array>,
    startedAt: number,
): Promise<void> {
    const mediaSource = new MediaSource();
    audio.src = URL.createObjectURL(mediaSource);

    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (err?: unknown) => {
            if (settled) return;
            settled = true;
            URL.revokeObjectURL(audio.src);
            err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve();
        };

        mediaSource.addEventListener(
            "sourceopen",
            async () => {
                let sourceBuffer: SourceBuffer;
                try {
                    sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
                } catch (e) {
                    finish(e);
                    return;
                }

                audio.onended = () => {
                    console.log(`[tts] ended      +${Date.now() - startedAt}ms`);
                    finish();
                };
                audio.onerror = () => finish(new Error("audio playback failed"));
                audio.onplaying = () => {
                    console.log(`[tts] first-audio +${Date.now() - startedAt}ms`);
                };

                // Helper: append a chunk and wait for the buffer to be ready.
                const append = (chunk: Uint8Array) =>
                    new Promise<void>((res, rej) => {
                        const onUpdate = () => {
                            sourceBuffer.removeEventListener("updateend", onUpdate);
                            sourceBuffer.removeEventListener("error", onError);
                            res();
                        };
                        const onError = (e: Event) => {
                            sourceBuffer.removeEventListener("updateend", onUpdate);
                            sourceBuffer.removeEventListener("error", onError);
                            rej(e);
                        };
                        sourceBuffer.addEventListener("updateend", onUpdate);
                        sourceBuffer.addEventListener("error", onError);
                        // Copy into a fresh ArrayBuffer (some browsers reject
                        // a Uint8Array view backed by a SAB). Cast handles
                        // ArrayBufferLike vs ArrayBuffer in lib.dom typings.
                        sourceBuffer.appendBuffer(chunk.slice().buffer as ArrayBuffer);
                    });

                // Fire play() up front so the audio element can start the
                // moment it has enough data — don't wait for the first
                // updateend to come back before kicking off playback.
                audio.play().catch((e) => finish(e));

                const reader = stream.getReader();
                let firstByteLogged = false;
                let totalBytes = 0;
                let chunkCount = 0;
                try {
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (value && value.byteLength > 0) {
                            if (!firstByteLogged) {
                                firstByteLogged = true;
                                console.log(
                                    `[tts] first-byte +${Date.now() - startedAt}ms (${value.byteLength}B)`,
                                );
                            }
                            totalBytes += value.byteLength;
                            chunkCount += 1;
                            await append(value);
                        }
                    }
                    console.log(
                        `[tts] stream-end +${Date.now() - startedAt}ms total=${totalBytes}B chunks=${chunkCount}`,
                    );
                    if (mediaSource.readyState === "open") {
                        mediaSource.endOfStream();
                    }
                } catch (e) {
                    finish(e);
                }
            },
            { once: true },
        );
    });
}

export function useVoice() {
    const [supported, setSupported] = useState(false);
    const [listening, setListening] = useState(false);
    const [interim, setInterim] = useState("");
    const [error, setError] = useState<string | null>(null);

    const recRef = useRef<SpeechRecognitionLike | null>(null);
    const onFinalRef = useRef<(text: string) => void>(() => { });
    const finalBufferRef = useRef("");
    const userStoppedRef = useRef(false);

    // -- TTS queue. A single <audio> plays each line; the queue stores
    // pending object URLs so we can revoke them and so we can cancel
    // everything when the user starts recording.
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const queueRef = useRef<string[]>([]);
    const playingRef = useRef(false);
    const currentObjectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        setSupported(getRecognitionCtor() !== null);
        if (typeof window !== "undefined" && !audioRef.current) {
            audioRef.current = new Audio();
        }
        return () => {
            // Best-effort cleanup on unmount.
            audioRef.current?.pause();
            if (currentObjectUrlRef.current) {
                URL.revokeObjectURL(currentObjectUrlRef.current);
                currentObjectUrlRef.current = null;
            }
        };
    }, []);

    function clearTtsQueue() {
        queueRef.current = [];
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.removeAttribute("src");
            audioRef.current.load();
        }
        if (currentObjectUrlRef.current) {
            URL.revokeObjectURL(currentObjectUrlRef.current);
            currentObjectUrlRef.current = null;
        }
        playingRef.current = false;
        if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    async function playNext() {
        if (playingRef.current) return;
        const next = queueRef.current.shift();
        if (!next) return;
        playingRef.current = true;

        const startedAt = Date.now();
        console.log(`[tts] start      +0ms text=${JSON.stringify(next.slice(0, 60))}…`);

        try {
            const res = await fetch("/api/tts", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ text: next }),
            });
            console.log(`[tts] headers   +${Date.now() - startedAt}ms status=${res.status}`);
            if (!res.ok || !res.body) throw new Error(`tts ${res.status}`);

            const audio = audioRef.current;
            if (!audio) throw new Error("audio element unavailable");

            // Streaming path: pipe MP3 chunks into a MediaSource so playback
            // starts within ~200-400ms instead of waiting for the full file.
            // Falls back to the blob path on browsers without MediaSource
            // support for audio/mpeg (notably some Safari versions).
            const canStream =
                typeof MediaSource !== "undefined" &&
                MediaSource.isTypeSupported("audio/mpeg");

            if (canStream) {
                await playStreamedMp3(audio, res.body, startedAt);
            } else {
                console.log("[tts] streaming unavailable — falling back to blob");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                currentObjectUrlRef.current = url;
                audio.src = url;
                await new Promise<void>((resolve, reject) => {
                    audio.onended = () => resolve();
                    audio.onerror = () => reject(new Error("audio playback failed"));
                    audio.play().catch(reject);
                });
                URL.revokeObjectURL(url);
                currentObjectUrlRef.current = null;
            }
        } catch (err) {
            // Last-resort fallback so the demo never goes silent.
            console.warn("[voice] cloud TTS failed, using browser fallback:", err);
            fallbackBrowserSpeak(next);
        } finally {
            playingRef.current = false;
            // Drain whatever queued up while we were playing.
            if (queueRef.current.length > 0) playNext();
        }
    }

    const speak = useCallback((text: string) => {
        if (!text?.trim()) return;
        queueRef.current.push(text.trim());
        playNext();
    }, []);

    const start = useCallback((onFinal: (text: string) => void) => {
        const Ctor = getRecognitionCtor();
        if (!Ctor) {
            setError("Speech recognition not supported. Use Chrome or Edge.");
            return;
        }
        onFinalRef.current = onFinal;
        finalBufferRef.current = "";
        userStoppedRef.current = false;

        // User is taking the floor — stop whatever the agent is saying.
        clearTtsQueue();

        const rec = new Ctor();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;

        rec.onresult = (event) => {
            let interimText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                const text = r[0].transcript;
                if (r.isFinal) {
                    finalBufferRef.current += (finalBufferRef.current ? " " : "") + text.trim();
                } else {
                    interimText += text;
                }
            }
            setInterim(interimText);
        };

        rec.onerror = (e) => {
            if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
                setError(e.error);
            }
        };

        rec.onend = () => {
            if (!userStoppedRef.current) {
                try {
                    rec.start();
                    return;
                } catch {
                    // Falls through to flush below.
                }
            }
            setListening(false);
            setInterim("");
            const buffered = finalBufferRef.current.trim();
            finalBufferRef.current = "";
            if (buffered) onFinalRef.current(buffered);
        };

        try {
            rec.start();
            recRef.current = rec;
            setListening(true);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "failed to start mic");
        }
    }, []);

    const stop = useCallback(() => {
        userStoppedRef.current = true;
        recRef.current?.stop();
    }, []);

    return useMemo(
        () => ({ supported, listening, interim, error, start, stop, speak }),
        [supported, listening, interim, error, start, stop, speak],
    );
}
