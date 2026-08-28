import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { listPatientsWithAlerts } from "@/cdss/server.functions";
import { AppShell } from "@/components/cdss/AppShell";
import {
  Search,
  AlertTriangle,
  Bell,
  Activity,
  ArrowRight,
  RotateCcw,
  Database,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Pill,
  HeartPulse,
  ShieldAlert,
  ArrowUpDown,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/patients")({
  loader: async () => {
    const patients = await listPatientsWithAlerts();
    return { patients };
  },
  component: PatientsPage,
});

type CohortFilter = "all" | "benchmark" | "hospital";
type ClinicalFilter = "all" | "stroke-risk" | "bleeding-risk" | "dose-alert" | "valvular" | "no-alerts";
type SortOption = "latest-visit" | "highest-alerts" | "highest-stroke" | "highest-bleed" | "id";

interface PatientRow {
  patient_id: string;
  mrn?: string;
  name: string;
  age: number;
  sex: string;
  clinic_location: string;
  cohort?: "benchmark" | "hospital";
  af_status: string;
  cha2ds2va_score?: number;
  has_bled_score?: number;
  is_valvular?: boolean;
  active_drug?: string;
  has_dose_alert?: boolean;
  alerts_count: number;
  reminders_count: number;
  visit_date?: string;
  visit_id?: string;
  executed: boolean;
}

const PAGE_SIZE = 25;

function PatientsPage() {
  const { patients } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>("benchmark");
  const [clinicalFilter, setClinicalFilter] = useState<ClinicalFilter>("all");
  const [drugFilter, setDrugFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("latest-visit");
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to default benchmark system view
  const handleResetToBenchmark = () => {
    setCohortFilter("benchmark");
    setClinicalFilter("all");
    setDrugFilter("all");
    setSortBy("latest-visit");
    setQuery("");
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = patients.filter((p: PatientRow) => {
      // Cohort check
      const cohort = p.cohort ?? (p.patient_id.startsWith("REAL-") ? "hospital" : "benchmark");
      if (cohortFilter === "benchmark" && cohort !== "benchmark") return false;
      if (cohortFilter === "hospital" && cohort !== "hospital") return false;

      // Text search (name, patient_id, mrn)
      if (q) {
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesId = p.patient_id.toLowerCase().includes(q);
        const matchesMrn = p.mrn ? p.mrn.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesId && !matchesMrn) return false;
      }

      // Clinical Smart Filters
      if (clinicalFilter === "stroke-risk" && (p.cha2ds2va_score ?? 0) < 2) return false;
      if (clinicalFilter === "bleeding-risk" && (p.has_bled_score ?? 0) < 3) return false;
      if (clinicalFilter === "dose-alert" && !p.has_dose_alert) return false;
      if (clinicalFilter === "valvular" && !p.is_valvular) return false;
      if (clinicalFilter === "no-alerts" && p.alerts_count > 0) return false;

      // Drug filter
      if (drugFilter !== "all") {
        if (!p.active_drug?.toLowerCase().includes(drugFilter.toLowerCase())) return false;
      }

      return true;
    });

    // Sorting (Defaults to latest visit date on top)
    return result.sort((a: PatientRow, b: PatientRow) => {
      if (sortBy === "latest-visit") {
        const dateA = a.visit_date ?? "1970-01-01";
        const dateB = b.visit_date ?? "1970-01-01";
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return a.patient_id.localeCompare(b.patient_id);
      }
      if (sortBy === "highest-alerts") {
        return b.alerts_count - a.alerts_count;
      }
      if (sortBy === "highest-stroke") {
        return (b.cha2ds2va_score ?? 0) - (a.cha2ds2va_score ?? 0);
      }
      if (sortBy === "highest-bleed") {
        return (b.has_bled_score ?? 0) - (a.has_bled_score ?? 0);
      }
      if (sortBy === "id") {
        return a.patient_id.localeCompare(b.patient_id);
      }
      return 0;
    });
  }, [patients, query, cohortFilter, clinicalFilter, drugFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const cohortPatients = useMemo(() => {
    return patients.filter((p: PatientRow) => {
      const cohort = p.cohort ?? (p.patient_id.startsWith("REAL-") ? "hospital" : "benchmark");
      if (cohortFilter === "benchmark") return cohort === "benchmark";
      if (cohortFilter === "hospital") return cohort === "hospital";
      return true;
    });
  }, [patients, cohortFilter]);

  const stats = {
    totalCohort: cohortPatients.length,
    highStroke: cohortPatients.filter((p: PatientRow) => (p.cha2ds2va_score ?? 0) >= 2).length,
    highBleed: cohortPatients.filter((p: PatientRow) => (p.has_bled_score ?? 0) >= 3).length,
    doseAlerts: cohortPatients.filter((p: PatientRow) => p.has_dose_alert).length,
    valvular: cohortPatients.filter((p: PatientRow) => p.is_valvular).length,
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] px-4 py-5">
        {/* Header Title & Reset Action */}
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Patients Directory
              {cohortFilter === "benchmark" ? (
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 border border-blue-500/20">
                  🏷️ Benchmark Cases ({cohortPatients.length})
                </span>
              ) : cohortFilter === "hospital" ? (
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
                  🏥 HASA UiTM Cohort ({cohortPatients.length})
                </span>
              ) : (
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  All Datasets ({cohortPatients.length})
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              Select a patient record to execute CDSS clinical analysis. Recent clinic encounters automatically appear at the top.
            </p>
          </div>

          <button
            onClick={handleResetToBenchmark}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition shadow-sm"
            title="Reset view back to original 12 benchmark test cases"
          >
            <RotateCcw className="size-3.5" />
            Reset to Benchmark (12)
          </button>
        </div>

        {/* Cohort Tabs */}
        <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-border pb-2">
          <button
            onClick={() => { setCohortFilter("benchmark"); setCurrentPage(1); }}
            className={`inline-flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-semibold transition border-b-2 ${
              cohortFilter === "benchmark"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookmarkCheck className="size-3.5" />
            🏷️ Benchmark Cases ({patients.filter((p: PatientRow) => (p.cohort ?? (p.patient_id.startsWith("REAL-") ? "hospital" : "benchmark")) === "benchmark").length})
          </button>
          <button
            onClick={() => { setCohortFilter("hospital"); setCurrentPage(1); }}
            className={`inline-flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-semibold transition border-b-2 ${
              cohortFilter === "hospital"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Database className="size-3.5" />
            🏥 HASA UiTM Cohort ({patients.filter((p: PatientRow) => (p.cohort ?? (p.patient_id.startsWith("REAL-") ? "hospital" : "benchmark")) === "hospital").length})
          </button>
          <button
            onClick={() => { setCohortFilter("all"); setCurrentPage(1); }}
            className={`inline-flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-semibold transition border-b-2 ${
              cohortFilter === "all"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            All Datasets ({patients.length})
          </button>
        </div>

        {/* Clinical Statistics Quick-Cards */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded border border-border bg-card p-2.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Stroke Indicated (≥2)</span>
              <ShieldAlert className="size-3.5 text-amber-500" />
            </div>
            <p className="mt-1 text-lg font-bold">
              {stats.highStroke}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({((stats.highStroke / (stats.totalCohort || 1)) * 100).toFixed(1)}%)
              </span>
            </p>
          </div>

          <div className="rounded border border-border bg-card p-2.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">High Bleed Risk (≥3)</span>
              <HeartPulse className="size-3.5 text-red-500" />
            </div>
            <p className="mt-1 text-lg font-bold">
              {stats.highBleed}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({((stats.highBleed / (stats.totalCohort || 1)) * 100).toFixed(1)}%)
              </span>
            </p>
          </div>

          <div className="rounded border border-border bg-card p-2.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Dose Safety Alerts</span>
              <Pill className="size-3.5 text-purple-500" />
            </div>
            <p className="mt-1 text-lg font-bold">
              {stats.doseAlerts}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({((stats.doseAlerts / (stats.totalCohort || 1)) * 100).toFixed(1)}%)
              </span>
            </p>
          </div>

          <div className="rounded border border-border bg-card p-2.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Valvular AF</span>
              <Activity className="size-3.5 text-blue-500" />
            </div>
            <p className="mt-1 text-lg font-bold">
              {stats.valvular}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({((stats.valvular / (stats.totalCohort || 1)) * 100).toFixed(1)}%)
              </span>
            </p>
          </div>
        </div>

        {/* Search + Sorting + Smart Clinical Filters */}
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by Name, MRN (e.g. CTC0050673), or Patient ID…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }}
                className="pl-8 text-xs"
              />
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpDown className="size-3.5" />
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as SortOption); setCurrentPage(1); }}
                className="rounded border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground outline-none shadow-sm"
              >
                <option value="latest-visit">Sort: Latest Visit Date (Top)</option>
                <option value="highest-alerts">Sort: Highest Alerts</option>
                <option value="highest-stroke">Sort: Highest Stroke Risk</option>
                <option value="highest-bleed">Sort: Highest Bleed Risk</option>
                <option value="id">Sort: Patient ID</option>
              </select>
            </div>

            {/* Drug Filter Selector */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="size-3.5" />
              <select
                value={drugFilter}
                onChange={(e) => { setDrugFilter(e.target.value); setCurrentPage(1); }}
                className="rounded border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground outline-none shadow-sm"
              >
                <option value="all">All Anticoagulants</option>
                <option value="warfarin">Warfarin</option>
                <option value="apixaban">Apixaban</option>
                <option value="dabigatran">Dabigatran</option>
                <option value="rivaroxaban">Rivaroxaban</option>
              </select>
            </div>
          </div>

          {/* Clinical Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            <FilterBtn active={clinicalFilter === "all"} onClick={() => { setClinicalFilter("all"); setCurrentPage(1); }}>
              All ({filtered.length})
            </FilterBtn>
            <FilterBtn
              active={clinicalFilter === "stroke-risk"}
              onClick={() => { setClinicalFilter("stroke-risk"); setCurrentPage(1); }}
            >
              🔴 High Stroke Risk (CHA₂DS₂-VA ≥ 2)
            </FilterBtn>
            <FilterBtn
              active={clinicalFilter === "bleeding-risk"}
              onClick={() => { setClinicalFilter("bleeding-risk"); setCurrentPage(1); }}
            >
              ⚠️ High Bleed Risk (HAS-BLED ≥ 3)
            </FilterBtn>
            <FilterBtn
              active={clinicalFilter === "dose-alert"}
              onClick={() => { setClinicalFilter("dose-alert"); setCurrentPage(1); }}
            >
              💊 Dose / Safety Alert
            </FilterBtn>
            <FilterBtn
              active={clinicalFilter === "valvular"}
              onClick={() => { setClinicalFilter("valvular"); setCurrentPage(1); }}
            >
              🫀 Valvular AF
            </FilterBtn>
            <FilterBtn
              active={clinicalFilter === "no-alerts"}
              onClick={() => { setClinicalFilter("no-alerts"); setCurrentPage(1); }}
            >
              No Alerts
            </FilterBtn>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">MRN</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Encounter Date</th>
                <th className="px-3 py-2">Anticoagulant</th>
                <th className="px-3 py-2">CHA₂DS₂-VA</th>
                <th className="px-3 py-2">HAS-BLED</th>
                <th className="px-3 py-2">Alerts</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((p: PatientRow) => {
                const highRisk = p.alerts_count > 0;
                const isReal = p.cohort === "hospital" || p.patient_id.startsWith("REAL-");
                return (
                  <tr
                    key={p.patient_id}
                    className={`border-b border-border last:border-0 transition hover:bg-muted/40 ${
                      highRisk ? "bg-[var(--clinical-alert-bg)]/20" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        {p.patient_id}
                        <span className={`inline-flex items-center rounded px-1 text-[9px] font-medium ${
                          isReal ? "bg-emerald-500/10 text-emerald-700" : "bg-blue-500/10 text-blue-700"
                        }`}>
                          {isReal ? "HASA" : "Benchmark"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.mrn ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">
                      <div className="flex flex-col">
                        <span>{p.name}</span>
                        {p.is_valvular && (
                          <span className="text-[10px] text-blue-600 font-semibold">🫀 Valvular AF</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        {p.visit_date ?? "2024-04-15"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs font-medium">
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px]">
                        <Pill className="size-3 text-muted-foreground" />
                        {p.active_drug ?? "Warfarin"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-semibold text-[11px] ${
                        (p.cha2ds2va_score ?? 0) >= 2
                          ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                          : "text-muted-foreground"
                      }`}>
                        Score: {p.cha2ds2va_score ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-semibold text-[11px] ${
                        (p.has_bled_score ?? 0) >= 3
                          ? "bg-red-500/10 text-red-700 border border-red-500/20"
                          : "text-muted-foreground"
                      }`}>
                        Score: {p.has_bled_score ?? 0}
                      </span>
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
                  <td colSpan={9} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    No patients match your selected clinical criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} patients
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40 hover:bg-muted"
              >
                <ChevronLeft className="size-3.5" /> Previous
              </button>
              <span className="px-2 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40 hover:bg-muted"
              >
                Next <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
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
      className={`whitespace-nowrap rounded border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground/70 hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
