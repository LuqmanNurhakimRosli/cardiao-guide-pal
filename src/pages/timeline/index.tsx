import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { buildPatientTimeline } from "@/shared/cdss/researchTimeline";
import { AppShell } from "@/shared/components/layout/AppShell";
import { Button } from "@/shared/components/ui/button";
import {
  Calendar,
  Clock,
  Activity,
  Pill,
  FileCheck,
  Building,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  Table,
  Layers,
} from "lucide-react";
import type { Patient, CdssEvaluationResult, AuditEntry, TimelineEvent, ResearchWindowType } from "@/shared/cdss/types";

interface TimelinePageProps {
  current: {
    patient: Patient;
    cdss: CdssEvaluationResult;
  };
  actions: AuditEntry[];
}

export function TimelinePage({ current, actions }: TimelinePageProps) {
  const { patient } = current;

  const [activeFilter, setActiveFilter] = useState<ResearchWindowType | "all">("all");
  const [viewMode, setViewMode] = useState<"stream" | "comparison">("stream");

  const timelineSummary = buildPatientTimeline(patient, actions);
  const events =
    activeFilter === "all"
      ? timelineSummary.events
      : timelineSummary.events.filter((e) => e.window === activeFilter);

  // Export Single Patient Chronological Timeline directly formatted for Microsoft Excel
  const exportPatientExcelCSV = () => {
    const headers = [
      "Patient ID",
      "MRN",
      "Patient Name",
      "Age",
      "Sex",
      "Clinic Location",
      "Index Consultation Date",
      "Research Window",
      "Observation Date",
      "Category",
      "Measurement / Event",
      "Details / Clinical Action",
      "Recorded Value",
    ];

    const windowLabel = (w: string) => {
      if (w === "pre-alert") return "1. Prior 12 Months (Pre-Alert)";
      if (w === "index") return "2. Point-of-Care (Index Consultation)";
      if (w === "post-alert") return "3. 3 Months Follow-Up (Post-Alert)";
      return "Outside Window";
    };

    const rows = timelineSummary.events.map((e) => [
      `"${patient.patient_id}"`,
      `"${patient.mrn ?? "N/A"}"`,
      `"${patient.name}"`,
      patient.age_at_encounter ?? patient.age,
      `"${patient.sex}"`,
      `"${patient.clinic_location}"`,
      `"${timelineSummary.index_alert_date}"`,
      `"${windowLabel(e.window)}"`,
      `"${e.date}"`,
      `"${e.category.toUpperCase()}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.detail.replace(/"/g, '""')}"`,
      `"${Object.entries(e.values || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}"`,
    ]);

    // \uFEFF is UTF-8 Byte Order Mark (BOM) ensuring Microsoft Excel displays all text and symbols properly
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Patient_${patient.patient_id}_Research_Timeline_${timelineSummary.index_alert_date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getCompletenessBadge = (status: "Complete" | "Partial" | "Missing") => {
    if (status === "Complete") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
          <CheckCircle2 className="size-3" /> Complete
        </span>
      );
    }
    if (status === "Partial") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-500/20">
          <AlertCircle className="size-3" /> Partial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
        <HelpCircle className="size-3" /> Missing
      </span>
    );
  };

  const getCategoryIcon = (category: TimelineEvent["category"]) => {
    switch (category) {
      case "vitals":
        return <Activity className="size-3.5 text-blue-500" />;
      case "labs":
        return <Activity className="size-3.5 text-purple-500" />;
      case "medications":
        return <Pill className="size-3.5 text-emerald-500" />;
      case "cdss_action":
        return <FileCheck className="size-3.5 text-amber-500" />;
      case "admissions":
        return <Building className="size-3.5 text-rose-500" />;
      default:
        return <Clock className="size-3.5 text-muted-foreground" />;
    }
  };

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-5xl px-3 sm:px-5 py-4 space-y-4">
        {/* Header Banner focused on individual patient with Excel Download */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Individual Patient Research Timeline
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mt-1">
              {patient.name} · Longitudinal Timeline
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              ID: <span className="font-mono font-bold text-primary">{patient.patient_id}</span> · MRN: <span className="font-mono">{patient.mrn ?? "—"}</span> · Age: {patient.age_at_encounter ?? patient.age} · Index Consultation: <strong className="text-foreground font-mono">{timelineSummary.index_alert_date}</strong>
            </p>
          </div>

          {/* Focused Excel Download Button */}
          <div className="flex items-center gap-2">
            <Button
              onClick={exportPatientExcelCSV}
              size="sm"
              className="gap-2 text-xs h-9 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5"
              title="Download this patient's 3-window timeline into Excel"
            >
              <FileSpreadsheet className="size-4" />
              Download Patient Timeline (Excel)
            </Button>
          </div>
        </div>

        {/* 3 Explicit Windows Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* 1. Pre-alert */}
          <div
            onClick={() => setActiveFilter(activeFilter === "pre-alert" ? "all" : "pre-alert")}
            className={`cursor-pointer rounded-xl border p-4 transition-all shadow-2xs ${
              activeFilter === "pre-alert"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                1. Prior 12 Months
              </span>
              {getCompletenessBadge(timelineSummary.pre_alert_window.completeness)}
            </div>
            <p className="mt-1.5 font-bold text-foreground text-sm">Pre-Alert Baseline Window</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {timelineSummary.pre_alert_window.start} → {timelineSummary.pre_alert_window.end}
            </p>
            <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
              <p>• <strong>{timelineSummary.pre_alert_window.events_count}</strong> baseline observations</p>
              <p>• Baseline BP, Creatinine, PINRR, Prior Meds</p>
            </div>
          </div>

          {/* 2. Index encounter */}
          <div
            onClick={() => setActiveFilter(activeFilter === "index" ? "all" : "index")}
            className={`cursor-pointer rounded-xl border p-4 transition-all shadow-2xs ${
              activeFilter === "index"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                2. Point-of-Care Encounter
              </span>
              {getCompletenessBadge(timelineSummary.index_encounter_window.completeness)}
            </div>
            <p className="mt-1.5 font-bold text-foreground text-sm">Index Consultation Window</p>
            <p className="text-[11px] font-mono text-primary font-bold mt-0.5">
              {timelineSummary.index_encounter_window.date}
            </p>
            <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
              <p>• <strong>{timelineSummary.index_encounter_window.events_count}</strong> consultation events & CDSS rules</p>
              <p>• CHA₂DS₂-VA, HAS-BLED & Prescriptions</p>
            </div>
          </div>

          {/* 3. Post-alert */}
          <div
            onClick={() => setActiveFilter(activeFilter === "post-alert" ? "all" : "post-alert")}
            className={`cursor-pointer rounded-xl border p-4 transition-all shadow-2xs ${
              activeFilter === "post-alert"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                3. 3 Months Follow-Up
              </span>
              {getCompletenessBadge(timelineSummary.post_alert_window.completeness)}
            </div>
            <p className="mt-1.5 font-bold text-foreground text-sm">Post-Alert Outcome Window</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {timelineSummary.post_alert_window.start} → {timelineSummary.post_alert_window.end}
            </p>
            <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
              <p>• <strong>{timelineSummary.post_alert_window.events_count}</strong> follow-up events recorded</p>
              <p>• 90-day review & safety surveillance</p>
            </div>
          </div>
        </div>

        {/* View Switcher: Chronological Stream vs Side-by-Side 3-Window Matrix */}
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("stream")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "stream"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5" /> Chronological Stream ({events.length})
            </button>
            <button
              onClick={() => setViewMode("comparison")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "comparison"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Table className="size-3.5" /> 3-Window Side-by-Side Table
            </button>
          </div>

          {activeFilter !== "all" && viewMode === "stream" && (
            <Button onClick={() => setActiveFilter("all")} variant="ghost" size="sm" className="h-7 text-xs">
              Clear Filter (Showing {activeFilter})
            </Button>
          )}
        </div>

        {/* 1. Stream View */}
        {viewMode === "stream" && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3">
            {events.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                No events found for this filter window.
              </p>
            ) : (
              <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
                {events.map((evt) => (
                  <div key={evt.id} className="relative flex items-start gap-3 text-xs">
                    <span className="absolute -left-6 mt-1 flex size-5 items-center justify-center rounded-full border border-border bg-card shadow-2xs">
                      {getCategoryIcon(evt.category)}
                    </span>
                    <div className="min-w-0 flex-1 rounded-xl border border-border/70 bg-muted/20 p-3 shadow-2xs hover:bg-muted/40 transition">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-foreground">{evt.title}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-background px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground border border-border/50">
                            {evt.date}
                          </span>
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold capitalize ${
                            evt.window === "pre-alert"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                              : evt.window === "index"
                              ? "bg-primary/10 text-primary"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          }`}>
                            {evt.window}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-muted-foreground leading-relaxed">{evt.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Side-by-Side 3-Window Matrix View */}
        {viewMode === "comparison" && (
          <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-muted/50 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 w-1/4">Clinical Variable</th>
                    <th className="px-4 py-3 w-1/4 bg-blue-500/5 text-blue-700 dark:text-blue-300">
                      1. Prior 12 Months (Pre-Alert)
                    </th>
                    <th className="px-4 py-3 w-1/4 bg-primary/5 text-primary">
                      2. Point-of-Care (Index Consultation)
                    </th>
                    <th className="px-4 py-3 w-1/4 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                      3. 3 Months Follow-Up (Post-Alert)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">Window Dates</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {timelineSummary.pre_alert_window.start} → {timelineSummary.pre_alert_window.end}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      {timelineSummary.index_encounter_window.date}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {timelineSummary.post_alert_window.start} → {timelineSummary.post_alert_window.end}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">Blood Pressure (BP)</td>
                    <td className="px-4 py-3 font-mono">
                      {timelineSummary.events.find((e) => e.window === "pre-alert" && e.category === "vitals" && e.values?.bp)?.detail || "140/85 mmHg (baseline)"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      {patient.vitals?.bp_latest || "—"} mmHg
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {timelineSummary.events.find((e) => e.window === "post-alert" && e.category === "vitals" && e.values?.bp)?.detail || "Pending 3-month review"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">Serum Creatinine & CrCl</td>
                    <td className="px-4 py-3 font-mono">
                      {patient.labs?.creatinine ? `${patient.labs.creatinine} µmol/L` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      CrCl: {current.cdss.scores.clcr ? `${current.cdss.scores.clcr} mL/min` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      Scheduled at next visit
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">Glycated Hb (HbA1c)</td>
                    <td className="px-4 py-3 font-mono">
                      {patient.labs?.hba1c ? `${patient.labs.hba1c}%` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      {patient.labs?.hba1c ? `${patient.labs.hba1c}%` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      Repeat in 3 months
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">Anticoagulation Therapy</td>
                    <td className="px-4 py-3 font-mono">
                      {patient.medications?.find((m: any) => m.indication === "AF")?.name || "Baseline OAC"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      {patient.medications?.map((m: any) => `${m.name} ${m.dose ?? ""}`).join(", ") || "Active"}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      Adherence surveillance active
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">CDSS Evaluation & Decisions</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Historical retrospective data
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      CHA₂DS₂-VA: <span className="font-bold text-primary">{current.cdss.scores.cha2ds2va?.total ?? 0}</span> · HAS-BLED: <span className="font-bold text-rose-600">{current.cdss.scores.hasbled?.total ?? 0}</span>
                      <div className="mt-1 text-[11px] font-bold text-emerald-600">
                        {actions.length} CDSS Action(s) Logged
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {patient.clinician_plan?.next_appointment_date ? (
                        <span className="font-semibold text-foreground">
                          Next Follow-Up: {patient.clinician_plan.next_appointment_date}
                        </span>
                      ) : "Continuous surveillance"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
