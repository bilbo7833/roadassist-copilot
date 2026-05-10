"use client";

import { useCase } from "@/lib/case";

export function FakeSmsPane() {
    const { state } = useCase();
    return (
        <div className="rounded-md border border-zinc-200 bg-zinc-100 p-3">
            <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Phone — Messages
                </h3>
                <span className="text-xs text-zinc-500">
                    {state.customer?.phone ?? "—"}
                </span>
            </div>
            <ul className="space-y-2">
                {state.smsMessages.length === 0 && (
                    <li className="text-xs italic text-zinc-400">
                        Carrier SMS will land here once the agent clicks Send.
                    </li>
                )}
                {state.smsMessages.map((m) => (
                    <li key={m.id} className="flex flex-col items-start">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                            RoadAssist · {new Date(m.timestamp).toLocaleTimeString()}
                        </span>
                        <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm">
                            {m.body}
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
}
