import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/shared/components/layout/AppShell";
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
  X,
  LayoutGrid,
  List,
  User,
  FileSpreadsheet,
} from "lucide-react";
import { Input } from "@/shared/components/ui/input";

type CohortFilter = "all" | "benchmark" | "hospital";
type ClinicalFilter =
  | "all"
  | "stroke-risk"
  | "bleeding-risk"
  | "dose-alert"
  | "valvular"
  | "no-alerts";
type SortOption = "latest-visit" | "highest-alerts" | "highest-stroke" | "highest-bleed" | "id";

export interface PatientRow {
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

const PAGE_SIZE = 20;

interface PatientsPageProps {
  patients: PatientRow[];
}

export function PatientsPage({ patients }: PatientsPageProps) {
  const [query, setQuery] = useState("");
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>("benchmark");
  const [clinicalFilter, setClinicalFilter] = useState<ClinicalFilter>("all");
  const [drugFilter, setDrugFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("latest-visit");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"auto" | "table" | "grid">("auto");

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

  const handleExportExcel = () => {
    const headers = [
      "Patient ID",
      "Name",
      "MRN",
      "Age",
      "Sex",
      "Clinic Location",
      "Cohort",
      "Visit Date",
      "Current Anticoagulant",
      "CHA2DS2-VA Score",
      "Stroke Risk Tier",
      "HAS-BLED Score",
      "Bleeding Risk Tier",
      "Active Clinical Alerts Count",
      "Valvular AF",
      "Dose Alert Active",
    ];

    const rows = filtered.map((p: PatientRow) => {
      const escape = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
      const strokeTier = (p.cha2ds2va_score ?? 0) >= 2 ? "High Risk (≥2)" : "Low Risk (<2)";
      const bleedTier = (p.has_bled_score ?? 0) >= 3 ? "High Risk (≥3)" : "Standard Risk (<3)";

      return [
        escape(p.patient_id),
        escape(p.name),
        escape(p.mrn ?? "—"),
        escape(p.age),
        escape(p.sex),
        escape(p.clinic_location),
        escape(p.cohort ?? (p.patient_id.startsWith("REAL-") ? "hospital" : "benchmark")),
        escape(p.visit_date ?? "—"),
        escape(p.active_drug ?? "None"),
        escape(p.cha2ds2va_score ?? 0),
        escape(strokeTier),
        escape(p.has_bled_score ?? 0),
        escape(bleedTier),
        escape(p.alerts_count ?? 0),
        escape(p.is_valvular ? "Yes" : "No"),
        escape(p.has_dose_alert ? "Yes" : "No"),
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `AF_Care_Companion_Cohort_${cohortFilter}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-3 sm:px-5 py-4 space-y-4">
        {/* Header Title & Actions Bar */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Patients Directory
              </h1>
              {cohortFilter === "benchmark" ? (
                <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-500/20">
                  Benchmark Cases ({cohortPatients.length})
                </span>
              ) : cohortFilter === "hospital" ? (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
                  HASA UiTM Cohort ({cohortPatients.length})
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  All Datasets ({cohortPatients.length})
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Select a patient record to execute CDSS clinical analysis and review guideline
              recommendations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 text-xs font-semibold shadow-2xs hover:bg-emerald-600/20 transition cursor-pointer"
              title="Export filtered cohort to Excel CSV"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Export Excel ({filtered.length})
            </button>
            <button
              onClick={handleResetToBenchmark}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-2xs hover:bg-muted hover:text-foreground transition cursor-pointer"
              title="Reset view back to benchmark test cases"
            >
              <RotateCcw className="size-3.5" />
              Reset Benchmark (12)
            </button>
          </div>
        </div>

        {/* Cohort Selector Tabs */}
        <div className="flex items-center gap-1 border-b border-border pb-1 overflow-x-auto">
          <button
            onClick={() => {
              setCohortFilter("benchmark");
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2 text-xs font-semibold transition border-b-2 ${
              cohortFilter === "benchmark"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <BookmarkCheck className="size-4 text-blue-600" />
            Benchmark Cases (
            {
              patients.filter(
                (p: PatientRow) =>
                  (p.cohort ?? (p.patient_id.startsWith("REAL-") ? "hospital" : "benchmark")) ===
                  "benchmark",
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setCohortFilter("hospital");
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2 text-xs font-semibold transition border-b-2 ${
              cohortFilter === "hospital"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Database className="size-4 text-emerald-600" />
            HASA UiTM Real Cohort (
            {
              patients.filter(
                (p: PatientRow) =>
                  (p.cohort ?? (p.patient_id.startsWith("REAL-") ? "hospital" : "benchmark")) ===
                  "hospital",
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setCohortFilter("all");
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2 text-xs font-semibold transition border-b-2 ${
              cohortFilter === "all"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            All Datasets ({patients.length})
          </button>
        </div>

        {/* Clinical Statistics Quick-Cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold">Stroke Indicated (≥2)</span>
              <div className="flex size-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                <ShieldAlert className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-xl font-bold tracking-tight text-foreground">{stats.highStroke}</p>
              <span className="text-xs font-medium text-amber-600 font-mono">
                {((stats.highStroke / (stats.totalCohort || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold">High Bleed Risk (≥3)</span>
              <div className="flex size-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-600">
                <HeartPulse className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-xl font-bold tracking-tight text-foreground">{stats.highBleed}</p>
              <span className="text-xs font-medium text-rose-600 font-mono">
                {((stats.highBleed / (stats.totalCohort || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold">Dose Safety Alerts</span>
              <div className="flex size-6 items-center justify-center rounded-md bg-purple-500/10 text-purple-600">
                <Pill className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-xl font-bold tracking-tight text-foreground">{stats.doseAlerts}</p>
              <span className="text-xs font-medium text-purple-600 font-mono">
                {((stats.doseAlerts / (stats.totalCohort || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold">Valvular AF</span>
              <div className="flex size-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
                <Activity className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-xl font-bold tracking-tight text-foreground">{stats.valvular}</p>
              <span className="text-xs font-medium text-blue-600 font-mono">
                {((stats.valvular / (stats.totalCohort || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by Patient Name, MRN (e.g. CTC0050673), or ID…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 text-xs h-9"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortOption);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground outline-none shadow-2xs focus:ring-1 focus:ring-primary"
              >
                <option value="latest-visit">Sort: Latest Encounter Date</option>
                <option value="highest-alerts">Sort: Highest CDSS Alerts</option>
                <option value="highest-stroke">Sort: Highest Stroke Score</option>
                <option value="highest-bleed">Sort: Highest Bleed Score</option>
                <option value="id">Sort: Patient ID</option>
              </select>
            </div>

            {/* Drug Dropdown */}
            <div className="flex items-center gap-1.5">
              <Pill className="size-3.5 text-muted-foreground shrink-0" />
              <select
                value={drugFilter}
                onChange={(e) => {
                  setDrugFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground outline-none shadow-2xs focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Anticoagulants</option>
                <option value="warfarin">Warfarin</option>
                <option value="apixaban">Apixaban</option>
                <option value="dabigatran">Dabigatran</option>
                <option value="rivaroxaban">Rivaroxaban</option>
              </select>
            </div>
          </div>

          {/* Quick-Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60">
            <FilterBtn
              active={clinicalFilter === "all"}
              onClick={() => {
                setClinicalFilter("all");
                setCurrentPage(1);
              }}
            >
              All ({filtered.length})
            </FilterBtn>
            <FilterBtn
              active={clinicalFilter === "stroke-risk"}
              onClick={() => {
                setClinicalFilter("stroke-risk");
                setCurrentPage(1);
              }}
            >
              🔴 High Stroke Risk (≥2)
            </FilterBtn>
            <FilterBtn
              active={clinicalFilter === "bleeding-risk"}
              onClick={() => {
                setClinicalFilter("bleeding-risk");
                setCurrentPage(1);
              }}
            >
              ⚠️ High Bleed Risk (≥3)
            </FilterBtn>
            <FilterBtn
              active={clinicalFilter === "dose-alert"}
              onClick={() => {
                setClinicalFilter("dose-alert");
                setCurrentPage(1);
              }}
            >
              💊 Dose / Safety Alert
            </FilterBtn>
            <FilterBtn
              active={clinicalFilter === "valvular"}
              onClick={() => {
                setClinicalFilter("valvular");
                setCurrentPage(1);
              }}
            >
              🫀 Valvular AF
            </FilterBtn>
            <FilterBtn
              active={clinicalFilter === "no-alerts"}
              onClick={() => {
                setClinicalFilter("no-alerts");
                setCurrentPage(1);
              }}
            >
              ✓ No Alerts
            </FilterBtn>
          </div>
        </div>

        {/* Mobile / Tablet Cards View (Visible on small screens) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
          {paginated.map((p: PatientRow) => {
            const hasAlerts = p.alerts_count > 0;
            const isReal = p.cohort === "hospital" || p.patient_id.startsWith("REAL-");
            return (
              <div
                key={p.patient_id}
                className={`rounded-xl border p-3.5 shadow-2xs transition bg-card ${
                  hasAlerts ? "border-amber-500/30 bg-amber-500/[0.02]" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-primary">
                        {p.patient_id}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-semibold ${
                          isReal
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-blue-500/10 text-blue-600"
                        }`}
                      >
                        {isReal ? "HASA" : "Benchmark"}
                      </span>
                    </div>
                    <h3 className="mt-0.5 text-sm font-bold text-foreground">{p.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Age: {p.age} · {p.sex} · MRN: {p.mrn ?? "—"}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {p.alerts_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-500/20">
                        <AlertTriangle className="size-3" /> {p.alerts_count} Alert
                        {p.alerts_count > 1 ? "s" : ""}
                      </span>
                    )}
                    {p.reminders_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-500/20">
                        <Bell className="size-3" /> {p.reminders_count} Reminder
                        {p.reminders_count > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      CHA₂DS₂-VA
                    </span>
                    <p
                      className={`font-bold font-mono ${(p.cha2ds2va_score ?? 0) >= 2 ? "text-amber-600" : "text-foreground"}`}
                    >
                      Score: {p.cha2ds2va_score ?? 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      HAS-BLED
                    </span>
                    <p
                      className={`font-bold font-mono ${(p.has_bled_score ?? 0) >= 3 ? "text-rose-600" : "text-foreground"}`}
                    >
                      Score: {p.has_bled_score ?? 0}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Pill className="size-3.5 text-primary" />
                    <span>{p.active_drug ?? "Warfarin"}</span>
                  </div>
                  <Link
                    to="/"
                    search={{ p: p.patient_id }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs active:scale-95 transition"
                  >
                    Open CDSS <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop / Laptop Table View (Hidden on mobile) */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/50 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Patient / ID</th>
                  <th className="px-3 py-3">MRN</th>
                  <th className="px-3 py-3">Encounter Date</th>
                  <th className="px-3 py-3">Anticoagulant</th>
                  <th className="px-3 py-3">CHA₂DS₂-VA</th>
                  <th className="px-3 py-3">HAS-BLED</th>
                  <th className="px-3 py-3">Clinical Alerts</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginated.map((p: PatientRow) => {
                  const hasAlerts = p.alerts_count > 0;
                  const isReal = p.cohort === "hospital" || p.patient_id.startsWith("REAL-");
                  return (
                    <tr
                      key={p.patient_id}
                      className={`group transition-colors hover:bg-muted/40 ${
                        hasAlerts ? "bg-amber-500/[0.015]" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-primary">
                                {p.patient_id}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[9px] font-semibold ${
                                  isReal
                                    ? "bg-emerald-500/10 text-emerald-700"
                                    : "bg-blue-500/10 text-blue-700"
                                }`}
                              >
                                {isReal ? "HASA" : "Benchmark"}
                              </span>
                            </div>
                            <p className="font-semibold text-foreground text-sm mt-0.5">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Age: {p.age} · {p.sex}
                              {p.is_valvular && (
                                <span className="ml-1.5 inline-block font-semibold text-blue-600">
                                  🫀 Valvular
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-muted-foreground font-medium">
                        {p.mrn ?? "—"}
                      </td>
                      <td className="px-3 py-3 font-mono text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3 text-muted-foreground/70" />
                          <span>{p.visit_date ?? "2026-08-26"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 font-medium text-foreground">
                          <Pill className="size-3 text-primary" />
                          {p.active_drug ?? "Warfarin"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-lg px-2 py-1 font-bold font-mono ${
                            (p.cha2ds2va_score ?? 0) >= 2
                              ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                              : "bg-muted/40 text-muted-foreground border border-border"
                          }`}
                        >
                          Score: {p.cha2ds2va_score ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-lg px-2 py-1 font-bold font-mono ${
                            (p.has_bled_score ?? 0) >= 3
                              ? "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                              : "bg-muted/40 text-muted-foreground border border-border"
                          }`}
                        >
                          Score: {p.has_bled_score ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {p.alerts_count > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 font-bold text-rose-600 border border-rose-500/20">
                              <AlertTriangle className="size-3" />
                              {p.alerts_count}
                            </span>
                          )}
                          {p.reminders_count > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-bold text-amber-600 border border-amber-500/20">
                              <Bell className="size-3" />
                              {p.reminders_count}
                            </span>
                          )}
                          {p.alerts_count === 0 && p.reminders_count === 0 && (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/"
                          search={{ p: p.patient_id }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition group-hover:shadow-sm"
                        >
                          Open CDSS <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No patients match your selected clinical criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground pt-2">
            <div>
              Showing{" "}
              <span className="font-semibold text-foreground">
                {(currentPage - 1) * PAGE_SIZE + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * PAGE_SIZE, filtered.length)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{filtered.length}</span> patients
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium disabled:opacity-30 hover:bg-muted transition"
              >
                <ChevronLeft className="size-3.5" /> Prev
              </button>
              <span className="px-3 font-semibold text-foreground">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium disabled:opacity-30 hover:bg-muted transition"
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
      className={`whitespace-nowrap rounded-lg border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
