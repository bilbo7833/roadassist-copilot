import { CaseProvider } from "@/lib/case";
import { CustomerPanel } from "@/components/CustomerPanel";
import { CockpitPanel } from "@/components/CockpitPanel";

export default function Home() {
  return (
    <CaseProvider>
      <main className="flex h-screen flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-2">
          <div className="flex items-baseline gap-3">
            <h1 className="text-sm font-semibold tracking-tight">
              RoadAssist Co-Pilot
            </h1>
            <p className="text-xs text-zinc-500">
              Voice intake · damage · coverage · dispatch · SMS
            </p>
          </div>
          <span className="text-xs text-zinc-400">prototype · Chrome / Edge</span>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
          <section className="flex min-h-0 flex-col border-r border-zinc-200 bg-zinc-50">
            <CustomerPanel />
          </section>
          <section className="min-h-0 bg-zinc-100">
            <CockpitPanel />
          </section>
        </div>
      </main>
    </CaseProvider>
  );
}
