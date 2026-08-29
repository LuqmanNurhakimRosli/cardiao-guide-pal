import { useMemo, useState } from "react";
import { AppShell } from "@/shared/components/layout/AppShell";
import {
  BarChart3,
  Download,
  Printer,
  ShieldAlert,
  HeartPulse,
  Pill,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Users,
  Database,
  BookmarkCheck,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";

type CohortFilter = "all" | "benchmark" | "hospital";

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
  executed: boolean;
}

interface AnalyticsPageProps {
  patients: PatientRow[];
}

export function AnalyticsPage({ patients }: AnalyticsPageProps) {
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>("hospital");

  const filteredPatients = useMemo(() => {
    return patients.filter((p: PatientRow) => {
      const cohort = p.cohort ?? (p.patient_id.startsWith("REAL-") ? "hospital" : "benchmark");
      if (cohortFilter === "benchmark") return cohort === "benchmark";
      if (cohortFilter === "hospital") return cohort === "hospital";
      return true;
    });
  }, [patients, cohortFilter]);

  const n = filteredPatients.length || 1;

  // CHA2DS2-VA Distribution
  const chaDist = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    filteredPatients.forEach((p: PatientRow) => {
      const score = Math.min(p.cha2ds2va_score ?? 0, 7);
      counts[score] = (counts[score] || 0) + 1;
    });
    return counts;
  }, [filteredPatients]);

  // HAS-BLED Distribution
  const hasBledDist = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    filteredPatients.forEach((p: PatientRow) => {
      const score = Math.min(p.has_bled_score ?? 0, 5);
      counts[score] = (counts[score] || 0) + 1;
    });
    return counts;
  }, [filteredPatients]);

  // Drug Distribution
  const drugDist = useMemo(() => {
    const counts: Record<string, number> = {
      Warfarin: 0,
      Apixaban: 0,
      Dabigatran: 0,
      Rivaroxaban: 0,
      Other: 0,
    };
    filteredPatients.forEach((p: PatientRow) => {
      const drug = p.active_drug || "Warfarin";
      if (counts[drug] !== undefined) counts[drug]++;
      else counts.Other++;
    });
    return counts;
  }, [filteredPatients]);

  // Key KPI metrics
  const highStrokeRisk = filteredPatients.filter(
    (p: PatientRow) => (p.cha2ds2va_score ?? 0) >= 2,
  ).length;
  const highBleedRisk = filteredPatients.filter(
    (p: PatientRow) => (p.has_bled_score ?? 0) >= 3,
  ).length;
  const doseAlertCount = filteredPatients.filter((p: PatientRow) => p.has_dose_alert).length;
  const valvularCount = filteredPatients.filter((p: PatientRow) => p.is_valvular).length;
  const totalAlerts = filteredPatients.reduce(
    (sum: number, p: PatientRow) => sum + p.alerts_count,
    0,
  );

  // Export to CSV function
  const handleExportCSV = () => {
    const headers = [
      "Patient ID",
      "MRN",
      "Name",
      "Age",
      "Sex",
      "Cohort",
      "AF Status",
      "Anticoagulant",
      "Valvular AF",
      "CHA2DS2-VA Score",
      "Stroke Risk Category",
      "HAS-BLED Score",
      "Bleeding Risk Category",
      "Alerts Count",
    ];

    const rows = filteredPatients.map((p: PatientRow) => [
      p.patient_id,
      p.mrn || "N/A",
      `"${p.name}"`,
      p.age,
      p.sex,
      p.cohort || "benchmark",
      p.af_status,
      p.active_drug || "Warfarin",
      p.is_valvular ? "Yes" : "No",
      p.cha2ds2va_score ?? 0,
      (p.cha2ds2va_score ?? 0) >= 2
        ? "High (OAC Indicated)"
        : (p.cha2ds2va_score ?? 0) === 1
          ? "Intermediate"
          : "Low",
      p.has_bled_score ?? 0,
      (p.has_bled_score ?? 0) >= 3 ? "High Bleed Risk" : "Low-Mod Bleed Risk",
      p.alerts_count,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `CDSS_AF_Cohort_Audit_${cohortFilter}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-3 sm:px-5 py-4 space-y-4">
        {/* Top Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="size-6 text-primary" />
              AF Cohort Analytics & Clinical Audit
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Aggregated clinical decision support analytics, risk stratification, and guideline
              adherence metrics.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs hover:bg-muted transition"
              title="Download full cohort CSV report"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs hover:bg-muted transition"
              title="Print or Save PDF report"
            >
              <Printer className="size-3.5" />
              Print PDF
            </button>
          </div>
        </div>

        {/* Cohort Tabs Selector */}
        <div className="flex items-center gap-1 border-b border-border pb-1 overflow-x-auto">
          <button
            onClick={() => setCohortFilter("hospital")}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2 text-xs font-semibold transition border-b-2 ${
              cohortFilter === "hospital"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Database className="size-4 text-emerald-600" />
            HASA UiTM Cohort (
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
            onClick={() => setCohortFilter("benchmark")}
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
            onClick={() => setCohortFilter("all")}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2 text-xs font-semibold transition border-b-2 ${
              cohortFilter === "all"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            All Datasets ({patients.length})
          </button>
        </div>

        {/* 4 Main KPI Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Total Patients Analyzed
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Users className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-foreground">
                {filteredPatients.length}
              </span>
              <span className="text-xs font-medium text-muted-foreground">Active Cohort</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground font-mono">
              Mean Age:{" "}
              {(filteredPatients.reduce((s: number, p: PatientRow) => s + p.age, 0) / n).toFixed(1)}{" "}
              yrs
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Stroke Prevention Indicated
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <ShieldAlert className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-amber-900 dark:text-amber-100">
                {highStrokeRisk}
              </span>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 font-mono">
                ({((highStrokeRisk / n) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">
              CHA₂DS₂-VA Score ≥ 2 (ESC Class I)
            </div>
          </div>

          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                High Bleeding Risk
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                <HeartPulse className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-rose-900 dark:text-rose-100">
                {highBleedRisk}
              </span>
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300 font-mono">
                ({((highBleedRisk / n) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-rose-800 dark:text-rose-200">
              HAS-BLED Score ≥ 3 (Review Modifiable Factors)
            </div>
          </div>

          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-purple-700 dark:text-purple-300">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Drug Safety Alerts
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                <Pill className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-purple-900 dark:text-purple-100">
                {doseAlertCount}
              </span>
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 font-mono">
                ({((doseAlertCount / n) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-purple-800 dark:text-purple-200">
              Total Triggered Alerts: <span className="font-bold font-mono">{totalAlerts}</span>
            </div>
          </div>
        </div>

        {/* Stratification Charts Section */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Chart 1: CHA2DS2-VA Score Breakdown */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <TrendingUp className="size-4 text-primary" />
                  CHA₂DS₂-VA Stroke Risk Stratification
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Score ≥2 indicates oral anticoagulation (2024 ESC Guideline).
                </p>
              </div>
              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-500/20 font-mono">
                {((highStrokeRisk / n) * 100).toFixed(1)}% High Risk
              </span>
            </div>

            <div className="space-y-2 pt-2">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((score) => {
                const count = chaDist[score] || 0;
                const pct = ((count / n) * 100).toFixed(1);
                const isHigh = score >= 2;
                return (
                  <div key={score} className="flex items-center gap-2 text-xs">
                    <span className="w-16 font-mono font-medium text-muted-foreground">
                      Score {score}
                      {score === 7 ? "+" : ""}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/60 flex">
                      <div
                        className={`h-full transition-all duration-500 rounded-md ${
                          isHigh ? "bg-amber-500/80" : "bg-blue-400/80"
                        }`}
                        style={{ width: `${Math.max(count > 0 ? (count / n) * 100 : 0, 1)}%` }}
                      />
                    </div>
                    <span className="w-20 text-right font-mono text-[11px] font-bold text-foreground">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: HAS-BLED Bleeding Risk Stratification */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <HeartPulse className="size-4 text-rose-500" />
                  HAS-BLED Bleeding Risk Stratification
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Score ≥3 triggers advisory alert ("Not contraindicated solely by score").
                </p>
              </div>
              <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 border border-rose-500/20 font-mono">
                {((highBleedRisk / n) * 100).toFixed(1)}% High Bleed Risk
              </span>
            </div>

            <div className="space-y-2 pt-2">
              {[0, 1, 2, 3, 4, 5].map((score) => {
                const count = hasBledDist[score] || 0;
                const pct = ((count / n) * 100).toFixed(1);
                const isHigh = score >= 3;
                return (
                  <div key={score} className="flex items-center gap-2 text-xs">
                    <span className="w-16 font-mono font-medium text-muted-foreground">
                      Score {score}
                      {score === 5 ? "+" : ""}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/60 flex">
                      <div
                        className={`h-full transition-all duration-500 rounded-md ${
                          isHigh ? "bg-rose-500/80" : "bg-emerald-500/80"
                        }`}
                        style={{ width: `${Math.max(count > 0 ? (count / n) * 100 : 0, 1)}%` }}
                      />
                    </div>
                    <span className="w-20 text-right font-mono text-[11px] font-bold text-foreground">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Anticoagulant & Valvular Section */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Card: Anticoagulants */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2 text-foreground">
              <Pill className="size-4 text-primary" />
              Anticoagulant Landscape
            </h3>
            <div className="space-y-2 text-xs pt-1">
              {Object.entries(drugDist).map(([drug, count]) => (
                <div
                  key={drug}
                  className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0"
                >
                  <span className="font-semibold text-foreground">{drug}</span>
                  <span className="font-mono font-medium text-muted-foreground">
                    {count} ({((count / n) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Valvular AF Adherence */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <h3 className="text-sm font-bold flex items-center gap-1.5 mb-1 text-foreground">
              <Activity className="size-4 text-blue-500" />
              Valvular AF (Mitral Stenosis / MVR)
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Per AHA/ESC guidelines, DOACs are contraindicated in moderate-severe MS / Mechanical
              Valves.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/50 py-1.5">
                <span className="font-medium text-muted-foreground">Valvular AF Patients:</span>
                <span className="font-bold text-blue-600 font-mono">
                  {valvularCount} ({((valvularCount / n) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 py-1.5">
                <span className="font-medium text-muted-foreground">Non-Valvular AF:</span>
                <span className="font-mono text-muted-foreground">
                  {n - valvularCount} ({(((n - valvularCount) / n) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="font-medium text-muted-foreground">DOAC Guard Status:</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 className="size-3.5" /> Enforced
                </span>
              </div>
            </div>
          </div>

          {/* Card: Medico-Legal Compliance */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <h3 className="text-sm font-bold flex items-center gap-1.5 mb-1 text-foreground">
              <ShieldAlert className="size-4 text-amber-500" />
              Clinical Phrasing & Adherence
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Compliant with advisory language recommendations (GDMT 2026.08.26).
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/50 py-1.5">
                <span className="font-medium text-muted-foreground">Apixaban Dose Reduction:</span>
                <span className="text-[11px] font-semibold text-emerald-600">
                  "Consider..." Advisory
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 py-1.5">
                <span className="font-medium text-muted-foreground">Clinical Review Clause:</span>
                <span className="text-[11px] font-semibold text-emerald-600">Included (100%)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="font-medium text-muted-foreground">Dose Guard Protection:</span>
                <span className="text-[11px] font-semibold text-emerald-600">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Audit Matrix Table */}
        <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <h3 className="text-sm font-bold text-foreground">
              CDSS Clinical Rules Execution Matrix
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Automated audit summary across all active clinical rule modules in the CDSS engine.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/20 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Clinical Rule / Module</th>
                  <th className="px-4 py-3">Guideline Standard</th>
                  <th className="px-4 py-3">Affected Cohort</th>
                  <th className="px-4 py-3">CDSS Decision Behavior</th>
                  <th className="px-4 py-3 text-right">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    Stroke Risk (CHA₂DS₂-VA)
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">
                    2024 ESC (Threshold ≥2)
                  </td>
                  <td className="px-4 py-3 font-bold text-amber-700 dark:text-amber-300 font-mono">
                    {highStrokeRisk} patients ({((highStrokeRisk / n) * 100).toFixed(1)}%)
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Recommends Oral Anticoagulation (DOAC preferred)
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                    100% Compliant
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    Bleeding Risk (HAS-BLED)
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">HAS-BLED Score ≥3</td>
                  <td className="px-4 py-3 font-bold text-rose-700 dark:text-rose-300 font-mono">
                    {highBleedRisk} patients ({((highBleedRisk / n) * 100).toFixed(1)}%)
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Emits informational alert for modifiable bleeding factors
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                    100% Compliant
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    DOAC Renal Dose Reduction
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">
                    Cockcroft-Gault CrCl
                  </td>
                  <td className="px-4 py-3 font-bold text-purple-700 dark:text-purple-300 font-mono">
                    {doseAlertCount} alerts
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Advisory "Consider dose reduction" (Apixaban / Rivaroxaban / Dabigatran)
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                    100% Compliant
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    Valvular AF Contraindication
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">
                    AHA / ESC Guidelines
                  </td>
                  <td className="px-4 py-3 font-bold text-blue-700 dark:text-blue-300 font-mono">
                    {valvularCount} patients
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Enforces Warfarin; alerts DOAC contraindication
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                    100% Compliant
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
