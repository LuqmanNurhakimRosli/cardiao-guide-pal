import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import {
  listPatients,
  getPatientWithCdss,
} from "@/cdss/server.functions";
import { AppShell } from "@/components/cdss/AppShell";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Info,
  ChevronDown,
  ArrowRight,
  User,
  Activity,
  Heart,
  Pill,
  ClipboardList,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ClinicianAction, CdssAlert } from "@/cdss/types";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/alerts/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ p: search.p }),
  loader: async ({ deps }) => {
    const patients = await listPatients();
    const patient_id = deps.p ?? patients[0].patient_id;
    const current = await getPatientWithCdss({ data: { patient_id } });
    return { patients, current };
  },
  component: AlertsReview,
});

export interface QueuedAction {
  alertId: string;
  action: ClinicianAction;
  alertTitle: string;
}

function AlertsReview() {
  const { patients, current } = Route.useLoaderData();
  const { patient, cdss } = current;
  const navigate = useNavigate();

  const actionableAlerts = cdss.alerts;
  const missingDataReminders = cdss.reminders;
  const [picks, setPicks] = useState<Record<string, ClinicianAction | "">>({});
  const [picksMeta, setPicksMeta] = useState<Record<string, string>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    comorbidities: false,
    strokeBleeding: false,
    symptomsRate: false,
    managementPlan: false,
  });

  const setPick = (id: string, a: ClinicianAction) =>
    setPicks((s) => ({ ...s, [id]: a }));

  const handleSave = async () => {
    const queue: QueuedAction[] = [];

    // Queue all actionable alerts with chosen actions
    for (const al of actionableAlerts) {
      const action = picks[al.id];
      if (action) {
        queue.push({
          alertId: al.id,
          action,
          alertTitle: al.title,
        });
      }
    }

    if (queue.length === 0) {
      navigate({ to: "/summary", search: { p: patient.patient_id } });
      return;
    }

    // Save entire queue to session storage for zero-loss sequential processing
    sessionStorage.setItem("cdss_action_queue", JSON.stringify(queue));
    sessionStorage.setItem("cdss_queue_total", String(queue.length));

    // Navigate to first item
    const first = queue[0];
    if (first.action === "accept") {
      navigate({
        to: "/alerts/$alertId/accept",
        params: { alertId: first.alertId },
        search: { p: patient.patient_id },
      });
    } else if (first.action === "override") {
      navigate({
        to: "/alerts/$alertId/override",
        params: { alertId: first.alertId },
        search: { p: patient.patient_id },
      });
    } else if (first.action === "defer") {
      navigate({
        to: "/alerts/$alertId/defer",
        params: { alertId: first.alertId },
        search: { p: patient.patient_id },
      });
    }
  };

  const chadsScore = cdss.scores.cha2ds2va?.total ?? cdss.scores.cha2ds2vasc?.total ?? "—";
  const hasbledScore = cdss.scores.hasbled?.total ?? "—";
  const clcrScore = cdss.scores.clcr ? `${cdss.scores.clcr} mL/min` : "—";
  const pinrrScore = cdss.scores.pinrr != null ? `${cdss.scores.pinrr}%` : "—";
  const selectedCount = Object.values(picks).filter(Boolean).length;
  const isProcessDisabled = actionableAlerts.length > 0 && selectedCount === 0;

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-5xl px-3 sm:px-5 py-4 space-y-4">
        {/* Header & Encounter Summary Card */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  {patient.encounter?.encounter_type ?? "Cardiology Outpatient Clinic"}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Visit ID: {patient.encounter?.visit_id ?? "VIS-2026-001"}
                </span>
              </div>
              <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Combined Clinical Alert & Decision Review
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Patient: <span className="font-semibold text-foreground">{patient.name}</span> (<span className="font-mono">{patient.patient_id}</span>) · MRN: <span className="font-mono">{patient.mrn ?? "—"}</span> · Age: {patient.age_at_encounter ?? patient.age} · Sex: {patient.sex}
              </p>
            </div>
            <div className="text-left sm:text-right rounded-lg bg-muted/40 p-2 sm:p-0 sm:bg-transparent border sm:border-0 border-border">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Encounter Date:</span>
              <p className="text-sm font-bold font-mono text-foreground">
                {patient.encounter?.clinic_date ?? "2026-08-26"}
              </p>
            </div>
          </div>

          {/* Vitals & Clinical Scores Summary Grid */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7 text-xs">
            <div className="rounded-lg bg-muted/30 p-2.5 border border-border/60">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">CHA₂DS₂-VA</span>
              <p className="text-base font-bold text-primary font-mono">{chadsScore} <span className="text-[10px] font-normal text-muted-foreground">(≥2)</span></p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5 border border-border/60">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">HAS-BLED</span>
              <p className={`text-base font-bold font-mono ${Number(hasbledScore) >= 3 ? "text-rose-600" : "text-foreground"}`}>
                {hasbledScore} <span className="text-[10px] font-normal text-muted-foreground">(≥3 high)</span>
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5 border border-border/60">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">eGFR (Lab)</span>
              <p className="text-base font-bold font-mono text-foreground">
                {patient.labs.egfr ?? patient.labs.egfr_record?.value ? `${patient.labs.egfr ?? patient.labs.egfr_record?.value}` : "—"}
                <span className="text-[9px] font-normal text-muted-foreground ml-1">mL/min</span>
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5 border border-border/60">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">CrCl (Cockcroft)</span>
              <p className="text-base font-bold font-mono text-foreground">{clcrScore}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5 border border-border/60">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Blood Pressure</span>
              <p className="text-xs font-semibold text-foreground font-mono mt-1">
                {patient.vitals.bp_latest ?? "—"} <span className="text-muted-foreground font-normal">/ {patient.vitals.bp_second ?? "—"}</span>
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5 border border-border/60">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">HbA1c</span>
              <p className="text-base font-bold font-mono text-foreground">
                {patient.labs.hba1c_record?.value ?? patient.labs.hba1c ? `${patient.labs.hba1c_record?.value ?? patient.labs.hba1c}%` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5 border border-border/60">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Warfarin PINRR</span>
              <p className="text-base font-bold font-mono text-foreground">{pinrrScore}</p>
            </div>
          </div>

          {/* Current Anticoagulant Status */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2.5 border border-border text-xs">
            <div className="flex items-center gap-2">
              <Pill className="size-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">Active Medication Orders:</span>
              <span className="text-muted-foreground font-medium">
                {patient.medications.map((m) => `${m.name} ${m.dose ?? ""}`).join(", ") || "No medications recorded"}
              </span>
            </div>
            {patient.clinician_plan?.next_appointment_date && (
              <span className="text-xs text-muted-foreground font-medium">
                Next Appointment: <strong className="text-foreground font-mono">{patient.clinician_plan.next_appointment_date}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Actionable Clinical Alerts */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-rose-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Actionable Clinical Alerts ({actionableAlerts.length})
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Select one action per alert. Actions will be processed sequentially.
            </span>
          </div>

          {actionableAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-card">
              <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-500" />
              <p className="font-semibold text-foreground">No active critical alerts for this encounter.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Clinical management meets standard guidelines.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {actionableAlerts.map((al) => {
                const pick = picks[al.id];
                const isReevaluationAlert = al.id === "af-reevaluation-reassessment";

                return (
                  <li
                    key={al.id}
                    className="rounded-xl border border-l-4 border-rose-500/30 border-l-rose-500 bg-card p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 shrink-0 mt-0.5">
                        <AlertTriangle className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-foreground">{al.title}</h3>
                          {al.group && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {al.group}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {al.detail}
                        </p>

                        {/* Quick Checklist for Reevaluation Alert */}
                        {isReevaluationAlert && (
                          <div className="mt-3 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                              Quick Checklist
                            </span>
                            <div className="space-y-1.5 pt-1">
                              <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground hover:text-primary transition">
                                <input
                                  type="checkbox"
                                  checked={Boolean(checklist.comorbidities)}
                                  onChange={(e) =>
                                    setChecklist((s) => ({ ...s, comorbidities: e.target.checked }))
                                  }
                                  className="size-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <span>Risk factors and comorbidities reviewed</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground hover:text-primary transition">
                                <input
                                  type="checkbox"
                                  checked={Boolean(checklist.strokeBleeding)}
                                  onChange={(e) =>
                                    setChecklist((s) => ({ ...s, strokeBleeding: e.target.checked }))
                                  }
                                  className="size-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <span>Stroke/bleeding risk and anticoagulation reviewed</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground hover:text-primary transition">
                                <input
                                  type="checkbox"
                                  checked={Boolean(checklist.symptomsRate)}
                                  onChange={(e) =>
                                    setChecklist((s) => ({ ...s, symptomsRate: e.target.checked }))
                                  }
                                  className="size-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <span>AF symptoms and rate/rhythm control reviewed</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground hover:text-primary transition">
                                <input
                                  type="checkbox"
                                  checked={Boolean(checklist.managementPlan)}
                                  onChange={(e) =>
                                    setChecklist((s) => ({ ...s, managementPlan: e.target.checked }))
                                  }
                                  className="size-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <span>Management plan and next review date updated</span>
                              </label>
                            </div>
                          </div>
                        )}

                        {al.recommendation && (
                          <div className="mt-2 rounded-lg bg-primary/5 p-2.5 text-xs font-semibold text-foreground border border-primary/10">
                            💡 <strong>Guideline Recommendation:</strong> {al.recommendation}
                          </div>
                        )}

                        {al.rationale.length > 0 && (
                          <Collapsible className="mt-2">
                            <CollapsibleTrigger className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                              <ChevronDown className="size-3" /> Clinical Evidence & Rationale ({al.rationale.length})
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-1.5 rounded-lg bg-muted/40 p-2.5 text-xs border border-border/60">
                              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                                {al.rationale.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                              {al.guideline && (
                                <p className="mt-2 text-[10px] text-muted-foreground font-mono">
                                  Guideline: {al.guideline}
                                </p>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </div>

                    {/* Decision Action Selection */}
                    <div className="border-t border-border/60 pt-3">
                      {isReevaluationAlert ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground">Pilihan Tindakan:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
                            {/* No Change Required */}
                            <label
                              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer border transition ${
                                pick === "accept" && (!picksMeta[al.id] || picksMeta[al.id] === "no_change")
                                  ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                                  : "border-border bg-background hover:bg-muted text-foreground"
                              }`}
                            >
                              <input
                                type="radio"
                                name={al.id}
                                checked={pick === "accept" && (!picksMeta[al.id] || picksMeta[al.id] === "no_change")}
                                onChange={() => {
                                  setPick(al.id, "accept");
                                  setPicksMeta((s) => ({ ...s, [al.id]: "no_change" }));
                                }}
                                className="sr-only"
                              />
                              <CheckCircle2 className="size-3.5" />
                              <span>No Change Required</span>
                            </label>

                            {/* Update Management */}
                            <label
                              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer border transition ${
                                pick === "accept" && picksMeta[al.id] === "update_management"
                                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                  : "border-border bg-background hover:bg-muted text-foreground"
                              }`}
                            >
                              <input
                                type="radio"
                                name={al.id}
                                checked={pick === "accept" && picksMeta[al.id] === "update_management"}
                                onChange={() => {
                                  setPick(al.id, "accept");
                                  setPicksMeta((s) => ({ ...s, [al.id]: "update_management" }));
                                }}
                                className="sr-only"
                              />
                              <Activity className="size-3.5" />
                              <span>Update Management</span>
                            </label>

                            {/* Remind at Next Visit */}
                            <label
                              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer border transition ${
                                pick === "defer"
                                  ? "border-amber-600 bg-amber-600 text-white shadow-xs"
                                  : "border-border bg-background hover:bg-muted text-foreground"
                              }`}
                            >
                              <input
                                type="radio"
                                name={al.id}
                                checked={pick === "defer"}
                                onChange={() => {
                                  setPick(al.id, "defer");
                                  setPicksMeta((s) => ({ ...s, [al.id]: "remind_next" }));
                                }}
                                className="sr-only"
                              />
                              <Clock className="size-3.5" />
                              <span>Remind at Next Visit</span>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground">Select Decision Action:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
                            {/* Accept */}
                            <label
                              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer border transition ${
                                pick === "accept"
                                  ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                                  : "border-border bg-background hover:bg-muted text-foreground"
                              }`}
                            >
                              <input
                                type="radio"
                                name={al.id}
                                checked={pick === "accept"}
                                onChange={() => setPick(al.id, "accept")}
                                className="sr-only"
                              />
                              <CheckCircle2 className="size-3.5" />
                              <span>Accept / Act Now</span>
                            </label>

                            {/* Override */}
                            <label
                              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer border transition ${
                                pick === "override"
                                  ? "border-rose-600 bg-rose-600 text-white shadow-xs"
                                  : "border-border bg-background hover:bg-muted text-foreground"
                              }`}
                            >
                              <input
                                type="radio"
                                name={al.id}
                                checked={pick === "override"}
                                onChange={() => setPick(al.id, "override")}
                                className="sr-only"
                              />
                              <AlertTriangle className="size-3.5" />
                              <span>Override Alert</span>
                            </label>

                            {/* Defer */}
                            <label
                              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer border transition ${
                                pick === "defer"
                                  ? "border-amber-600 bg-amber-600 text-white shadow-xs"
                                  : "border-border bg-background hover:bg-muted text-foreground"
                              }`}
                            >
                              <input
                                type="radio"
                                name={al.id}
                                checked={pick === "defer"}
                                onChange={() => setPick(al.id, "defer")}
                                className="sr-only"
                              />
                              <Clock className="size-3.5" />
                              <span>Defer / Review Later</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Missing Data Reminders */}
        {missingDataReminders.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-amber-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Clinical Reminders & Suggested Orders ({missingDataReminders.length})
              </h2>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {missingDataReminders.map((rem) => (
                <div
                  key={rem.id}
                  className="rounded-xl border border-l-4 border-amber-500/30 border-l-amber-500 bg-card p-3.5 text-xs shadow-2xs space-y-1.5"
                >
                  <p className="font-bold text-foreground">{rem.title}</p>
                  <p className="text-muted-foreground">{rem.detail}</p>
                  {rem.action?.prompt_order && (
                    <div className="rounded-lg bg-amber-500/10 p-2 font-mono text-[11px] font-semibold text-amber-900 dark:text-amber-200 border border-amber-500/20">
                      📋 Order Prompt: {rem.action.prompt_order}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions Execution Bar */}
        <div className="sticky bottom-3 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-3.5 shadow-lg backdrop-blur-md">
          <Link to="/" search={{ p: patient.patient_id }}>
            <Button variant="outline" size="sm" className="text-xs h-8">
              <ArrowLeft className="mr-1.5 size-3.5" /> Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {isProcessDisabled && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Select an action for at least 1 alert to proceed
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={isProcessDisabled}
              size="sm"
              className={`text-xs h-8 font-semibold shadow-xs transition ${
                isProcessDisabled
                  ? "opacity-50 cursor-not-allowed"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {actionableAlerts.length === 0
                ? "Proceed to Summary"
                : `Process Chosen Decisions (${selectedCount})`}
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
