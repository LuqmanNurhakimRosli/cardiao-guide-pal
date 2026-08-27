import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import {
  listPatients,
  getPatientWithCdss,
  getPatientActions,
} from "@/cdss/server.functions";
import { buildPatientTimeline } from "@/cdss/researchTimeline";
import { AppShell } from "@/components/cdss/AppShell";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  Activity,
  Pill,
  FileCheck,
  Building,
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { TimelineEvent, ResearchWindowType } from "@/cdss/types";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/timeline")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ p: search.p }),
  loader: async ({ deps }) => {
    const patients = await listPatients();
    const patient_id = deps.p ?? patients[0].patient_id;
    const [current, actions] = await Promise.all([
      getPatientWithCdss({ data: { patient_id } }),
      getPatientActions({ data: { patient_id } }),
    ]);
    return { patients, current, actions };
  },
  component: ResearchTimelinePage,
});

function ResearchTimelinePage() {
  const { patients, current, actions } = Route.useLoaderData();
  const { patient } = current;

  const [activeFilter, setActiveFilter] = useState<ResearchWindowType | "all">("all");

  const timelineSummary = buildPatientTimeline(patient, actions);
  const events =
    activeFilter === "all"
      ? timelineSummary.events
      : timelineSummary.events.filter((e) => e.window === activeFilter);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(timelineSummary, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline_${patient.patient_id}_${timelineSummary.index_alert_date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCompletenessBadge = (status: "Complete" | "Partial" | "Missing") => {
    if (status === "Complete") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
          <CheckCircle2 className="size-3" /> Complete
        </span>
      );
    }
    if (status === "Partial") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
          <AlertCircle className="size-3" /> Partial Data
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        <HelpCircle className="size-3" /> Missing Data
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
      <div className="mx-auto max-w-5xl px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Research Protocol Window
              </span>
            </div>
            <h1 className="text-lg font-bold text-foreground mt-1">Research Dataset Timeline</h1>
            <p className="text-xs text-muted-foreground">
              Patient: <strong className="text-foreground">{patient.name}</strong> ({patient.patient_id}) · MRN: {patient.mrn ?? "—"} · Index Alert Date: <strong className="text-foreground font-mono">{timelineSummary.index_alert_date}</strong>
            </p>
          </div>
          <Button onClick={exportJSON} variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="size-3.5" /> Export Normalized JSON
          </Button>
        </div>

        {/* 3 Explicit Windows Summary Cards */}
        <div className="grid gap-3 md:grid-cols-3 text-xs">
          {/* Pre-alert */}
          <div
            onClick={() => setActiveFilter(activeFilter === "pre-alert" ? "all" : "pre-alert")}
            className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
              activeFilter === "pre-alert"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                1. Pre-Alert Window
              </span>
              {getCompletenessBadge(timelineSummary.pre_alert_window.completeness)}
            </div>
            <p className="mt-1 font-semibold text-foreground text-sm">Prior 12 Months</p>
            <p className="text-[11px] font-mono text-muted-foreground">
              {timelineSummary.pre_alert_window.start} → {timelineSummary.pre_alert_window.end}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {timelineSummary.pre_alert_window.events_count} recorded baseline observations (INR, BP, Labs).
            </p>
          </div>

          {/* Index encounter */}
          <div
            onClick={() => setActiveFilter(activeFilter === "index" ? "all" : "index")}
            className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
              activeFilter === "index"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                2. Index Encounter
              </span>
              {getCompletenessBadge(timelineSummary.index_encounter_window.completeness)}
            </div>
            <p className="mt-1 font-semibold text-foreground text-sm">Point-of-Care Consultation</p>
            <p className="text-[11px] font-mono text-foreground font-semibold">
              {timelineSummary.index_encounter_window.date}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {timelineSummary.index_encounter_window.events_count} encounter events & CDSS actions recorded.
            </p>
          </div>

          {/* Post-alert */}
          <div
            onClick={() => setActiveFilter(activeFilter === "post-alert" ? "all" : "post-alert")}
            className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
              activeFilter === "post-alert"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                3. Post-Alert Window
              </span>
              {getCompletenessBadge(timelineSummary.post_alert_window.completeness)}
            </div>
            <p className="mt-1 font-semibold text-foreground text-sm">3 Months Follow-Up</p>
            <p className="text-[11px] font-mono text-muted-foreground">
              {timelineSummary.post_alert_window.start} → {timelineSummary.post_alert_window.end}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {timelineSummary.post_alert_window.events_count} follow-up appointments & monitoring outcomes.
            </p>
          </div>
        </div>

        {/* Timeline Events Stream */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Chronological Observations Stream ({events.length})
            </h2>
            {activeFilter !== "all" && (
              <Button onClick={() => setActiveFilter("all")} variant="ghost" size="sm" className="h-6 text-[11px]">
                Clear Filter (Showing {activeFilter})
              </Button>
            )}
          </div>

          {events.length === 0 ? (
            <p className="rounded border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No events found for this filter window.
            </p>
          ) : (
            <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {events.map((evt) => (
                <div key={evt.id} className="relative flex items-start gap-3 text-xs">
                  <span className="absolute -left-6 mt-1 flex size-5 items-center justify-center rounded-full border border-border bg-background shadow-xs">
                    {getCategoryIcon(evt.category)}
                  </span>
                  <div className="min-w-0 flex-1 rounded-md border border-border/60 bg-muted/20 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{evt.title}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground border border-border/50">
                          {evt.date}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold capitalize text-foreground">
                          {evt.window}
                        </span>
                      </div>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{evt.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
