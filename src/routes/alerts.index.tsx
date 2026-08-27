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

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-5xl px-4 py-4 space-y-4">
        {/* Header & Encounter Summary */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {patient.encounter?.encounter_type ?? "Outpatient Clinic"}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Visit: {patient.encounter?.visit_id ?? "VIS-2026-001"}
                </span>
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Combined Clinical Alert Panel</h1>
              <p className="text-xs text-muted-foreground">
                Patient: <span className="font-semibold text-foreground">{patient.name}</span> ({patient.patient_id}) · MRN: {patient.mrn ?? "—"} · Age: {patient.age_at_encounter ?? patient.age} · Sex: {patient.sex} · Clinician: {patient.encounter?.clinician_id ?? "DR-CAR-01"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Encounter Date:</span>
              <p className="text-sm font-semibold font-mono text-foreground">
                {patient.encounter?.clinic_date ?? "2026-08-26"}
              </p>
            </div>
          </div>

          {/* Clinical Scores & Vitals Summary Grid */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 text-xs">
            <div className="rounded bg-muted/50 p-2 border border-border/50">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">CHA₂DS₂-VA</span>
              <p className="text-base font-bold text-primary">{chadsScore} <span className="text-[10px] font-normal text-muted-foreground">(≥2)</span></p>
            </div>
            <div className="rounded bg-muted/50 p-2 border border-border/50">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">HAS-BLED</span>
              <p className={`text-base font-bold ${Number(hasbledScore) >= 3 ? "text-amber-500" : "text-foreground"}`}>
                {hasbledScore} <span className="text-[10px] font-normal text-muted-foreground">(≥3 high)</span>
              </p>
            </div>
            <div className="rounded bg-muted/50 p-2 border border-border/50">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">CrCl (Cockcroft)</span>
              <p className="text-base font-bold text-foreground">{clcrScore}</p>
            </div>
            <div className="rounded bg-muted/50 p-2 border border-border/50">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Blood Pressure</span>
              <p className="text-xs font-semibold text-foreground mt-1">
                {patient.vitals.bp_latest ?? "—"} <span className="text-muted-foreground font-normal">/ {patient.vitals.bp_second ?? "—"}</span>
              </p>
            </div>
            <div className="rounded bg-muted/50 p-2 border border-border/50">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">HbA1c</span>
              <p className="text-base font-bold text-foreground">
                {patient.labs.hba1c_record?.value ?? patient.labs.hba1c ? `${patient.labs.hba1c_record?.value ?? patient.labs.hba1c}%` : "—"}
              </p>
            </div>
            <div className="rounded bg-muted/50 p-2 border border-border/50">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">PINRR (12m)</span>
              <p className="text-base font-bold text-foreground">{pinrrScore}</p>
            </div>
          </div>

          {/* Current Anticoagulant Status */}
          <div className="mt-3 flex flex-wrap items-center justify-between rounded bg-muted/30 p-2 border border-border text-xs">
            <div className="flex items-center gap-2">
              <Pill className="size-3.5 text-primary" />
              <span className="font-semibold">Current Medications:</span>
              <span className="text-muted-foreground">
                {patient.medications.map((m) => `${m.name} ${m.dose ?? ""}`).join(", ") || "No medications recorded"}
              </span>
            </div>
            {patient.clinician_plan?.next_appointment_date && (
              <span className="text-xs text-muted-foreground">
                Next Appointment: <strong className="text-foreground">{patient.clinician_plan.next_appointment_date}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Actionable Clinical Alerts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-[var(--clinical-alert)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Actionable Clinical Alerts ({actionableAlerts.length})
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Select one action per alert. Actions will be processed sequentially on save.
            </span>
          </div>

          {actionableAlerts.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              ✓ No high-priority clinical alerts for this patient.
            </div>
          ) : (
            <ul className="space-y-3">
              {actionableAlerts.map((al) => {
                const isAlert = al.severity === "alert";
                const palette = isAlert
                  ? "border-l-[var(--clinical-alert)] bg-[var(--clinical-alert-bg)]"
                  : "border-l-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)]";
                const iconColor = isAlert
                  ? "text-[var(--clinical-alert)]"
                  : "text-[var(--clinical-warn)]";
                const pick = picks[al.id];

                return (
                  <li
                    key={al.id}
                    className={`rounded-md border border-l-4 border-border p-3.5 ${palette}`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${iconColor}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{al.title}</p>
                          {al.group && (
                            <span className="rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {al.group}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {al.detail}
                        </p>

                        {al.recommendation && (
                          <p className="mt-1.5 text-xs font-medium text-foreground bg-background/50 rounded px-2 py-1 border border-border/40">
                            💡 Recommendation: {al.recommendation}
                          </p>
                        )}

                        {al.rationale.length > 0 && (
                          <Collapsible className="mt-2">
                            <CollapsibleTrigger className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground/70 hover:text-foreground">
                              <ChevronDown className="size-3" /> Clinical Rationale ({al.rationale.length})
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-1 rounded bg-background/70 p-2 text-xs">
                              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                                {al.rationale.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                              {al.guideline && (
                                <p className="mt-1.5 text-[10px] text-muted-foreground/80 italic">
                                  Guideline: {al.guideline}
                                </p>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Action Selection Radio Controls */}
                        <fieldset className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/50 pt-2.5 text-xs">
                          <span className="text-xs font-semibold text-muted-foreground">Action:</span>
                          {(["accept", "override", "defer"] as ClinicianAction[]).map(
                            (a) => (
                              <label
                                key={a}
                                className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 transition-colors ${
                                  pick === a
                                    ? "bg-foreground text-background font-semibold shadow-xs"
                                    : "bg-background hover:bg-muted border border-border text-foreground"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={al.id}
                                  checked={pick === a}
                                  onChange={() => setPick(al.id, a)}
                                  className="accent-current"
                                />
                                <span className="capitalize">
                                  {a === "accept"
                                    ? "Accept / Act Now"
                                    : a === "defer"
                                    ? "Defer / Review Later"
                                    : "Override Alert"}
                                </span>
                              </label>
                            ),
                          )}
                        </fieldset>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Missing Data Reminders & Order Prompts */}
        {missingDataReminders.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-[var(--clinical-warn)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Clinical Data Reminders & Order Prompts ({missingDataReminders.length})
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {missingDataReminders.map((rem) => (
                <div
                  key={rem.id}
                  className="rounded-md border border-l-4 border-border border-l-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)] p-3 text-xs"
                >
                  <p className="font-semibold text-foreground">{rem.title}</p>
                  <p className="mt-0.5 text-muted-foreground">{rem.detail}</p>
                  {rem.action?.prompt_order && (
                    <div className="mt-2 rounded bg-background/80 px-2 py-1 font-mono text-[11px] font-medium text-foreground border border-border/50">
                      📋 Order Prompt: {rem.action.prompt_order}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Link to="/" search={{ p: patient.patient_id }}>
            <Button variant="ghost" size="sm">
              ← Back to Patient Dashboard
            </Button>
          </Link>
          <Button onClick={handleSave} size="sm" className="gap-1.5 shadow-sm">
            Save & Process Actions ({Object.values(picks).filter(Boolean).length}) <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
