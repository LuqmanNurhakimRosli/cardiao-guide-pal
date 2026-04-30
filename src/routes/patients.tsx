import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { listPatientsWithAlerts } from "@/cdss/server.functions";
import { AppShell } from "@/components/cdss/AppShell";
import { Search, AlertTriangle, Bell, Activity, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/patients")({
  loader: async () => {
    const patients = await listPatientsWithAlerts();
    return { patients };
  },
  component: PatientsPage,
});

type Filter = "all" | "high-risk" | "no-alerts";

function PatientsPage() {
  const { patients } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.patient_id.toLowerCase().includes(q))
        return false;
      if (filter === "high-risk" && p.alerts_count === 0) return false;
      if (filter === "no-alerts" && p.alerts_count > 0) return false;
      return true;
    });
  }, [patients, query, filter]);

  const counts = {
    all: patients.length,
    highRisk: patients.filter((p) => p.alerts_count > 0).length,
    noAlerts: patients.filter((p) => p.alerts_count === 0).length,
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] px-4 py-5">
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-xl font-bold">Patients</h1>
          <p className="text-xs text-muted-foreground">
            Select a patient to open their dashboard. CDSS runs automatically on selection.
          </p>
        </div>

        {/* Search + filters */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-1">
            <FilterBtn active={filter === "all"} onClick={() => setFilter("all")}>
              All ({counts.all})
            </FilterBtn>
            <FilterBtn
              active={filter === "high-risk"}
              onClick={() => setFilter("high-risk")}
            >
              🔴 High risk ({counts.highRisk})
            </FilterBtn>
            <FilterBtn
              active={filter === "no-alerts"}
              onClick={() => setFilter("no-alerts")}
            >
              No alerts ({counts.noAlerts})
            </FilterBtn>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Age</th>
                <th className="px-3 py-2">Sex</th>
                <th className="px-3 py-2">Clinic</th>
                <th className="px-3 py-2">AF</th>
                <th className="px-3 py-2">Alerts</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const highRisk = p.alerts_count > 0;
                return (
                  <tr
                    key={p.patient_id}
                    className={`border-b border-border last:border-0 transition hover:bg-muted/40 ${
                      highRisk ? "bg-[var(--clinical-alert-bg)]/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{p.patient_id}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-xs">{p.age}</td>
                    <td className="px-3 py-2 text-xs capitalize">{p.sex}</td>
                    <td className="px-3 py-2 text-xs">{p.clinic_location}</td>
                    <td className="px-3 py-2">
                      {p.af_status === "AF" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-[var(--clinical-alert-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--clinical-alert)]">
                          <Activity className="size-3" /> AF
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {p.af_status}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {p.alerts_count > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-[var(--clinical-alert-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--clinical-alert)]">
                            <AlertTriangle className="size-3" />
                            {p.alerts_count}
                          </span>
                        )}
                        {p.reminders_count > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-[var(--clinical-warn-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--clinical-warn)]">
                            <Bell className="size-3" />
                            {p.reminders_count}
                          </span>
                        )}
                        {p.alerts_count === 0 && p.reminders_count === 0 && (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to="/"
                        search={{ p: p.patient_id }}
                        className="inline-flex items-center gap-1 rounded bg-foreground px-2 py-1 text-[11px] font-medium text-background transition hover:opacity-90"
                      >
                        Open <ArrowRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    No patients match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded border px-2.5 py-1.5 text-xs font-medium transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground/70 hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
