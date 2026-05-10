"use client";

// Browser-native ASR + TTS via the Web Speech API, push-to-talk style:
// - Click 🎙 → recognition stays on (continuous=true), interim text streams.
// - Click ■ → we stop recognition, take the buffered final text, and fire
//   onFinal once with the whole utterance. Button color reflects state.
// - We never auto-fire onFinal in the middle of speaking, even on long pauses.
//
// Honest trade-offs vs. OpenAI Realtime: turn-based, no barge-in, OS-dependent
// voice quality, Chrome/Edge only. The /api/intake-turn boundary is the
// swap-in point for Realtime later.

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

export function useVoice() {
    const [supported, setSupported] = useState(false);
    const [listening, setListening] = useState(false);
    const [interim, setInterim] = useState("");
    const [error, setError] = useState<string | null>(null);

    const recRef = useRef<SpeechRecognitionLike | null>(null);
    const onFinalRef = useRef<(text: string) => void>(() => { });
    const finalBufferRef = useRef("");
    // Set when the user clicks Stop, so the onend handler knows to flush.
    const userStoppedRef = useRef(false);

    useEffect(() => {
        setSupported(getRecognitionCtor() !== null);
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

        if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        const rec = new Ctor();
        rec.lang = "en-US";
        // Push-to-talk: keep mic open until the user clicks stop.
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
            // "no-speech" fires after a long silence; don't treat it as a real error.
            if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
                setError(e.error);
            }
        };

        rec.onend = () => {
            // The browser sometimes ends recognition on its own (e.g. Chrome's
            // ~60s soft cap). If the user hasn't clicked Stop, restart silently.
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

    const speak = useCallback((text: string) => {
        if (typeof window === "undefined" || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        u.rate = 1.05;
        const voices = window.speechSynthesis.getVoices();
        const v =
            voices.find((x) => x.lang === "en-US" && /natural|samantha|google/i.test(x.name)) ??
            voices.find((x) => x.lang === "en-US") ??
            null;
        if (v) u.voice = v;
        window.speechSynthesis.speak(u);
    }, []);

    return useMemo(
        () => ({ supported, listening, interim, error, start, stop, speak }),
        [supported, listening, interim, error, start, stop, speak],
    );
}
