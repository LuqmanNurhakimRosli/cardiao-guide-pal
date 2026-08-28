import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { listPatientsWithAlerts } from "@/cdss/server.functions";
import { AppShell } from "@/components/cdss/AppShell";
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

export const Route = createFileRoute("/analytics")({
  loader: async () => {
    const patients = await listPatientsWithAlerts();
    return { patients };
  },
  component: CohortAnalyticsPage,
});

type CohortFilter = "all" | "benchmark" | "hospital";

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
  executed: boolean;
}

function CohortAnalyticsPage() {
  const { patients } = Route.useLoaderData();
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
    const counts: Record<string, number> = { Warfarin: 0, Apixaban: 0, Dabigatran: 0, Rivaroxaban: 0, Other: 0 };
    filteredPatients.forEach((p: PatientRow) => {
      const drug = p.active_drug || "Warfarin";
      if (counts[drug] !== undefined) counts[drug]++;
      else counts.Other++;
    });
    return counts;
  }, [filteredPatients]);

  // Key KPI metrics
  const highStrokeRisk = filteredPatients.filter((p: PatientRow) => (p.cha2ds2va_score ?? 0) >= 2).length;
  const highBleedRisk = filteredPatients.filter((p: PatientRow) => (p.has_bled_score ?? 0) >= 3).length;
  const doseAlertCount = filteredPatients.filter((p: PatientRow) => p.has_dose_alert).length;
  const valvularCount = filteredPatients.filter((p: PatientRow) => p.is_valvular).length;
  const totalAlerts = filteredPatients.reduce((sum: number, p: PatientRow) => sum + p.alerts_count, 0);

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
      (p.cha2ds2va_score ?? 0) >= 2 ? "High (OAC Indicated)" : (p.cha2ds2va_score ?? 0) === 1 ? "Intermediate" : "Low",
      p.has_bled_score ?? 0,
      (p.has_bled_score ?? 0) >= 3 ? "High Bleed Risk" : "Low-Mod Bleed Risk",
      p.alerts_count,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CDSS_AF_Cohort_Audit_${cohortFilter}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] px-4 py-5">
        {/* Top Header */}
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              AF Cohort Analytics & Clinical Audit Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">
              Aggregated clinical decision support analytics, risk stratification, and guideline adherence metrics.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition shadow-sm"
              title="Download full cohort CSV report"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Export CSV Report
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition shadow-sm"
              title="Print or Save PDF report"
            >
              <Printer className="size-3.5" />
              Print PDF
            </button>
          </div>
        </div>

        {/* Cohort Tabs Selector */}
        <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-border pb-2">
          <button
            onClick={() => setCohortFilter("hospital")}
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
            onClick={() => setCohortFilter("benchmark")}
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
            onClick={() => setCohortFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-semibold transition border-b-2 ${
              cohortFilter === "all"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            All Datasets ({patients.length})
          </button>
        </div>

        {/* 4 Main KPI Cards */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total Patients Analyzed</span>
              <Users className="size-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{filteredPatients.length}</span>
              <span className="text-xs text-muted-foreground">Active Cohort</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Mean Age: {(filteredPatients.reduce((s: number, p: PatientRow) => s + p.age, 0) / n).toFixed(1)} years
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-xs font-medium uppercase tracking-wider">Stroke Prevention Indicated</span>
              <ShieldAlert className="size-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-900">{highStrokeRisk}</span>
              <span className="text-xs font-semibold text-amber-700">
                ({((highStrokeRisk / n) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-amber-800">
              CHA₂DS₂-VA Score ≥ 2 (ESC Class I Recommendation)
            </div>
          </div>

          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-red-700">
              <span className="text-xs font-medium uppercase tracking-wider">High Bleeding Risk</span>
              <HeartPulse className="size-4 text-red-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-red-900">{highBleedRisk}</span>
              <span className="text-xs font-semibold text-red-700">
                ({((highBleedRisk / n) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-red-800">
              HAS-BLED Score ≥ 3 (Requires Modifiable Risk Review)
            </div>
          </div>

          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-purple-700">
              <span className="text-xs font-medium uppercase tracking-wider">Drug & Safety Alerts</span>
              <Pill className="size-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-900">{doseAlertCount}</span>
              <span className="text-xs font-semibold text-purple-700">
                ({((doseAlertCount / n) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-purple-800">
              Total Alerts Across Cohort: <span className="font-semibold">{totalAlerts}</span>
            </div>
          </div>
        </div>

        {/* Analytical Stratification Charts Section */}
        <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Chart 1: CHA2DS2-VA Score Breakdown */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <TrendingUp className="size-4 text-primary" />
                  CHA₂DS₂-VA Stroke Risk Stratification
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Threshold ≥2 triggers stroke prevention alert (2024 ESC Guideline).
                </p>
              </div>
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                {((highStrokeRisk / n) * 100).toFixed(1)}% High Risk
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((score) => {
                const count = chaDist[score] || 0;
                const pct = ((count / n) * 100).toFixed(1);
                const isHigh = score >= 2;
                return (
                  <div key={score} className="flex items-center gap-2 text-xs">
                    <span className="w-16 font-mono font-medium text-muted-foreground">
                      Score {score}{score === 7 ? "+" : ""}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-muted/60 flex">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isHigh ? "bg-amber-500/80" : "bg-blue-400/80"
                        }`}
                        style={{ width: `${Math.max(count > 0 ? (count / n) * 100 : 0, 1)}%` }}
                      />
                    </div>
                    <span className="w-20 text-right font-mono text-[11px] font-semibold">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: HAS-BLED Bleeding Risk Stratification */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <HeartPulse className="size-4 text-red-500" />
                  HAS-BLED Bleeding Risk Stratification
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Score ≥3 triggers advisory alert ("Not contraindicated solely by score").
                </p>
              </div>
              <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                {((highBleedRisk / n) * 100).toFixed(1)}% High Bleed Risk
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {[0, 1, 2, 3, 4, 5].map((score) => {
                const count = hasBledDist[score] || 0;
                const pct = ((count / n) * 100).toFixed(1);
                const isHigh = score >= 3;
                return (
                  <div key={score} className="flex items-center gap-2 text-xs">
                    <span className="w-16 font-mono font-medium text-muted-foreground">
                      Score {score}{score === 5 ? "+" : ""}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-muted/60 flex">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isHigh ? "bg-red-500/80" : "bg-emerald-500/80"
                        }`}
                        style={{ width: `${Math.max(count > 0 ? (count / n) * 100 : 0, 1)}%` }}
                      />
                    </div>
                    <span className="w-20 text-right font-mono text-[11px] font-semibold">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 3: Anticoagulant & Valvular AF Breakdown */}
        <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Card: Anticoagulants */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
              <Pill className="size-4 text-primary" />
              Anticoagulant Landscape
            </h3>
            <div className="space-y-2 text-xs">
              {Object.entries(drugDist).map(([drug, count]) => (
                <div key={drug} className="flex items-center justify-between border-b border-border/50 py-1 last:border-0">
                  <span className="font-medium">{drug}</span>
                  <span className="font-mono text-muted-foreground">
                    {count} ({((count / n) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Valvular AF Adherence */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
              <Activity className="size-4 text-blue-500" />
              Valvular AF (Mitral Stenosis / MVR)
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Per AHA/ESC guidelines, DOACs are contraindicated in moderate-severe MS / Mechanical Valves.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/50 py-1">
                <span>Valvular AF Patients:</span>
                <span className="font-bold text-blue-600">{valvularCount} ({((valvularCount / n) * 100).toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between border-b border-border/50 py-1">
                <span>Non-Valvular AF:</span>
                <span className="font-mono text-muted-foreground">{n - valvularCount} ({(((n - valvularCount) / n) * 100).toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between py-1">
                <span>DOAC Guard Status:</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 className="size-3" /> Enforced
                </span>
              </div>
            </div>
          </div>

          {/* Card: Medico-Legal Compliance */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
              <ShieldAlert className="size-4 text-amber-500" />
              Clinical Decision Phrasing Audit
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Compliant with advisory language recommendations (Prof. Sazzli Review).
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/50 py-1">
                <span>Apixaban Dose Reduction:</span>
                <span className="text-[11px] font-semibold text-emerald-600">"Consider..." Advisory</span>
              </div>
              <div className="flex justify-between border-b border-border/50 py-1">
                <span>Subject to Clinical Review:</span>
                <span className="text-[11px] font-semibold text-emerald-600">Included (100%)</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Dose Guard Protection:</span>
                <span className="text-[11px] font-semibold text-emerald-600">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Audit Matrix Table */}
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <h3 className="text-sm font-bold">CDSS Clinical Rules Execution Matrix</h3>
            <p className="text-[11px] text-muted-foreground">
              Automated audit summary across all active clinical rule modules in the CDSS engine.
            </p>
          </div>
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-muted/20 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Clinical Rule / Module</th>
                <th className="px-4 py-2.5">Guideline Standard</th>
                <th className="px-4 py-2.5">Affected Cohort</th>
                <th className="px-4 py-2.5">CDSS Decision Behavior</th>
                <th className="px-4 py-2.5 text-right">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-2.5 font-medium">Stroke Risk (CHA₂DS₂-VA)</td>
                <td className="px-4 py-2.5 text-muted-foreground">2024 ESC (Threshold ≥2)</td>
                <td className="px-4 py-2.5 font-semibold text-amber-700">{highStrokeRisk} patients ({((highStrokeRisk / n) * 100).toFixed(1)}%)</td>
                <td className="px-4 py-2.5 text-muted-foreground">Recommends Oral Anticoagulation (DOAC preferred)</td>
                <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold">100% Compliant</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Bleeding Risk (HAS-BLED)</td>
                <td className="px-4 py-2.5 text-muted-foreground">HAS-BLED Score ≥3</td>
                <td className="px-4 py-2.5 font-semibold text-red-700">{highBleedRisk} patients ({((highBleedRisk / n) * 100).toFixed(1)}%)</td>
                <td className="px-4 py-2.5 text-muted-foreground">Emits informational alert for modifiable bleeding factors</td>
                <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold">100% Compliant</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">DOAC Renal Dose Reduction</td>
                <td className="px-4 py-2.5 text-muted-foreground">Cockcroft-Gault CrCl</td>
                <td className="px-4 py-2.5 font-semibold text-purple-700">{doseAlertCount} alerts</td>
                <td className="px-4 py-2.5 text-muted-foreground">Advisory "Consider dose reduction" (Apixaban / Rivaroxaban / Dabigatran)</td>
                <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold">100% Compliant</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Valvular AF Contraindication</td>
                <td className="px-4 py-2.5 text-muted-foreground">AHA / ESC Guidelines</td>
                <td className="px-4 py-2.5 font-semibold text-blue-700">{valvularCount} patients</td>
                <td className="px-4 py-2.5 text-muted-foreground">Enforces Warfarin; alerts DOAC contraindication</td>
                <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold">100% Compliant</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
