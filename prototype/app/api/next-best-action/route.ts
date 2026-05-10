// AI-5 — Next-best-action.
// Step 1: deterministic filter (haversine + capability + brand whitelist +
//         policy entitlements). Rule engine is the safety-critical layer.
// Step 2: gpt-5 ranks the survivors and picks the dispatch type.
// LLM failure → fall back to "nearest valid candidate" so the demo never stalls.

import { NextResponse } from "next/server";
import providersData from "@/data/providers.json";
import policiesData from "@/data/policies.json";
import { openaiJson, MODELS } from "@/lib/llm";
import { z } from "zod";
import { DispatchPlanSchema, RankerOutputSchema } from "@/lib/schemas";
import { NBA_SYSTEM_PROMPT, nbaUserPrompt } from "@/lib/prompts";
import { distanceAndEta } from "@/lib/haversine";
import type {
    Customer,
    DamageAssessment,
    DispatchType,
    IntakeData,
    Policy,
    Provider,
} from "@/lib/types";

export const runtime = "nodejs";

const providers = providersData as Provider[];
const policies = policiesData as Policy[];

// What dispatch types could this case need? Damage + policy decide.
function neededDispatchTypes(d: DamageAssessment, p: Policy): DispatchType[] {
    const types = new Set<DispatchType>();
    const notDrivable = d.drivability === "not-drivable" || d.severity >= 3;
    if (notDrivable) {
        types.add("tow");
        if (p.roadside.taxiOrRentalCovered) {
            if (d.severity >= 4) types.add("rental");
            types.add("taxi");
        }
    } else if (p.roadside.mobileRepairCovered) {
        types.add("mobile-repair");
        types.add("tow"); // always offer a tow alternate
    } else {
        types.add("tow");
    }
    return [...types];
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as {
            customer: Customer;
            intake: IntakeData;
            damage: DamageAssessment;
            policyId: string;
            customerLocation?: { lat: number; lng: number };
        };

        const policy = policies.find((p) => p.policyId === body.policyId);
        if (!policy) {
            return NextResponse.json(
                { error: `policy ${body.policyId} not found` },
                { status: 404 },
            );
        }

        const customerLocation = body.customerLocation ?? body.customer.currentLocation;
        const wantTypes = neededDispatchTypes(body.damage, policy);

        const filtered = providers
            .filter((p) => p.capabilities.some((c) => wantTypes.includes(c)))
            .filter(
                (p) =>
                    !p.brandWhitelist || p.brandWhitelist.includes(body.customer.vehicle.make),
            )
            .map((p) => {
                const d = distanceAndEta(customerLocation, p.location);
                return {
                    ...p,
                    distanceMi: d.roadMi,
                    etaMin: d.etaMin,
                    servesTypes: p.capabilities.filter((c) => wantTypes.includes(c)),
                };
            })
            .sort((a, b) => a.etaMin - b.etaMin)
            .slice(0, 6);

        if (filtered.length === 0) {
            return NextResponse.json(
                { error: "No providers match the required dispatch types." },
                { status: 422 },
            );
        }

        // LLM ranker. Failure → fall back to nearest with primary dispatch type.
        let ranker: z.infer<typeof RankerOutputSchema> | null = null;
        try {
            const raw = await openaiJson({
                agent: "nba",
                model: MODELS.nba,
                system: NBA_SYSTEM_PROMPT,
                user: nbaUserPrompt({
                    customer: body.customer,
                    intake: body.intake,
                    damage: body.damage,
                    policy,
                    candidates: filtered,
                }),
                reasoningEffort: "low",
            });
            ranker = RankerOutputSchema.parse(JSON.parse(raw));
        } catch (err) {
            console.warn("[nba] ranker failed, falling back to nearest:", err);
        }

        const primary =
            filtered.find((c) => c.id === ranker?.primaryProviderId) ?? filtered[0];
        const primaryType =
            ranker?.primaryDispatchType ?? primary.servesTypes[0] ?? wantTypes[0];

        const altIds =
            ranker?.alternateProviderIds ??
            filtered.filter((c) => c.id !== primary.id).slice(0, 2).map((c) => c.id);
        const alternates = altIds
            .map((id) => filtered.find((c) => c.id === id))
            .filter((c): c is (typeof filtered)[number] => Boolean(c))
            .slice(0, 3)
            .map((c) => ({
                providerId: c.id,
                providerName: c.name,
                dispatchType: c.servesTypes[0] ?? primaryType,
                distanceMi: c.distanceMi,
                etaMin: c.etaMin,
                rationale: `${c.servesTypes.join(" + ")} option, ETA ${c.etaMin} min.`,
            }));

        const plan = DispatchPlanSchema.parse({
            primary: {
                providerId: primary.id,
                providerName: primary.name,
                dispatchType: primaryType,
                distanceMi: primary.distanceMi,
                etaMin: primary.etaMin,
                rationale:
                    ranker?.rationale ??
                    `Closest provider that supports ${primaryType}; ETA ${primary.etaMin} min.`,
            },
            alternates,
            rationale:
                ranker?.rationale ??
                `Selected nearest provider that supports ${primaryType}.`,
        });

        return NextResponse.json(plan);
    } catch (err) {
        console.error("[/api/next-best-action]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "next-best-action failed" },
            { status: 500 },
        );
    }
}
