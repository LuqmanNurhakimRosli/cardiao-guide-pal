import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { saveConsultationNotes } from "@/shared/cdss/server.functions";
import { AppShell } from "@/shared/components/layout/AppShell";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Printer,
  Calendar,
  User,
  ShieldCheck,
  RotateCcw,
  FileEdit,
  Save,
  Pill,
  Clock,
} from "lucide-react";
import type { Patient, CdssEvaluationResult, AuditEntry, CdssAlert } from "@/shared/cdss/types";

interface SummaryPageProps {
  current: {
    patient: Patient;
    cdss: CdssEvaluationResult;
  };
  actions: AuditEntry[];
}

export function SummaryPage({ current, actions }: SummaryPageProps) {
  const { patient, cdss } = current;

  const saveNotesFn = useServerFn(saveConsultationNotes);

  const initialPlan = patient.clinician_plan ?? {};
  const [doctorPlan, setDoctorPlan] = useState(
    initialPlan.doctor_plan ??
      "Patient assessed for AF management. CDSS alerts reviewed and acted upon.",
  );
  const [medPlan, setMedPlan] = useState(
    initialPlan.medication_plan ??
      patient.medications.map((m) => `${m.name} ${m.dose ?? ""}`).join(", "),
  );
  const [monitoringPlan, setMonitoringPlan] = useState(
    initialPlan.monitoring_plan ??
      "Monitor BP, renal profile (CrCl), and stroke/bleeding symptoms.",
  );
  const [nextAppointment, setNextAppointment] = useState(
    initialPlan.next_appointment_date ?? "2026-11-26",
  );
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await saveNotesFn({
        data: {
          patient_id: patient.patient_id,
          doctor_plan: doctorPlan,
          medication_plan: medPlan,
          monitoring_plan: monitoringPlan,
          next_appointment_date: nextAppointment,
        },
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 3000);
    } catch (err) {
      console.error("Failed to save consultation notes:", err);
    } finally {
      setSavingNotes(false);
    }
  };

  const remainingAlerts = cdss.alerts.filter(
    (a: CdssAlert) => !actions.some((act: AuditEntry) => act.alert_id === a.id),
  );
  const remainingReminders = cdss.reminders.filter(
    (a: CdssAlert) => !actions.some((act: AuditEntry) => act.alert_id === a.id),
  );

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-5xl space-y-4 px-3 sm:px-5 py-4">
        {/* Action Summary Card */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="size-5 text-primary" />
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Consultation Action Summary & Discharge Note
                </h1>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Patient: <span className="font-semibold text-foreground">{patient.name}</span> (
                <span className="font-mono">{patient.patient_id}</span>) · MRN:{" "}
                <span className="font-mono">{patient.mrn ?? "—"}</span> ·{" "}
                {new Date().toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => window.print()}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
              >
                <Printer className="size-3.5" /> Print Summary
              </Button>
            </div>
          </div>

          {/* CDSS Actions Table */}
          {actions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              No actions have been executed for this patient yet in this session.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-left font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Alert Trigger</th>
                      <th className="px-3 py-3">Clinician Decision</th>
                      <th className="px-4 py-3">Details & Documented Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {actions.map((a: AuditEntry) => (
                      <tr key={a.id} className="align-top hover:bg-muted/30 transition">
                        <td className="px-4 py-3 font-bold text-foreground">{a.alert_title}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                              a.action === "accept"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : a.action === "override"
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            }`}
                          >
                            {a.action === "accept"
                              ? "Accepted & Acted"
                              : a.action === "defer"
                                ? "Deferred"
                                : "Overridden"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground space-y-1">
                          {a.med_change && (
                            <div className="font-bold text-primary font-mono text-xs">
                              Prescription Updated: {a.med_change.name} → {a.med_change.new_dose}
                            </div>
                          )}
                          {a.override_reason && (
                            <div className="font-semibold text-foreground">
                              Override Reason: {a.override_reason}
                            </div>
                          )}
                          {a.defer_until && (
                            <div className="font-mono text-amber-600 font-semibold">
                              Deferred Follow-up Date: {a.defer_until}
                            </div>
                          )}
                          {a.override_notes ? (
                            <div className="text-[11px] text-foreground/90 leading-relaxed font-medium">
                              {a.action === "accept" && !a.override_notes.startsWith("Notes:") ? (
                                <span>{a.override_notes}</span>
                              ) : (
                                <span>Notes: {a.override_notes}</span>
                              )}
                            </div>
                          ) : a.snapshot?.recommendation ? (
                            <div className="text-[11px] text-foreground/90 leading-relaxed">
                              <span className="font-semibold text-foreground">Recommendation:</span>{" "}
                              {a.snapshot.recommendation}
                            </div>
                          ) : a.alert_id === "af-reevaluation-reassessment" ? (
                            <div className="text-[11px] text-foreground/90 leading-relaxed">
                              AF clinical reevaluation completed: risk factors, stroke/bleeding
                              risks, and management plan reviewed.
                            </div>
                          ) : a.alert_id === "stroke-prevention" ? (
                            <div className="text-[11px] text-foreground/90 leading-relaxed">
                              Anticoagulation indicated for stroke prevention. Guideline therapy
                              confirmed.
                            </div>
                          ) : (
                            <div className="text-[11px] text-foreground/80 leading-relaxed">
                              Clinician action documented during consultation.
                            </div>
                          )}
                          {a.snapshot?.alert_evidence && a.snapshot.alert_evidence.length > 0 && (
                            <div className="text-[10.5px] text-muted-foreground font-mono">
                              Evidence: {a.snapshot.alert_evidence.slice(0, 2).join("; ")}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Doctor's Consultation Notes & Discharge Plan */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <FileEdit className="size-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                Doctor's Clinical Notes & Consultation Plan (EMR Live)
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {savedFlash && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Notes Saved!
                </span>
              )}
              <Button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                size="sm"
                className="text-xs h-8 bg-primary text-primary-foreground font-semibold shadow-xs"
              >
                <Save className="mr-1.5 size-3.5" />
                {savingNotes ? "Saving..." : "Save Consultation Notes"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Clinical Impression & Consultation Notes */}
            <div className="space-y-1.5 md:col-span-2">
              <Label
                htmlFor="doctor-plan"
                className="text-xs font-bold text-foreground flex items-center gap-1.5"
              >
                <ClipboardList className="size-3.5 text-primary" /> Clinical Impression & Doctor's
                Consultation Notes
              </Label>
              <Textarea
                id="doctor-plan"
                value={doctorPlan}
                onChange={(e) => setDoctorPlan(e.target.value)}
                placeholder="Type doctor's consultation notes, patient symptoms, clinical reasoning..."
                className="text-xs min-h-[85px] leading-relaxed bg-background"
              />
            </div>

            {/* Medication & Prescription Plan */}
            <div className="space-y-1.5">
              <Label
                htmlFor="med-plan"
                className="text-xs font-bold text-foreground flex items-center gap-1.5"
              >
                <Pill className="size-3.5 text-emerald-600" /> Medication & Prescription Plan
              </Label>
              <Textarea
                id="med-plan"
                value={medPlan}
                onChange={(e) => setMedPlan(e.target.value)}
                placeholder="Active prescriptions, dose adjustments, newly initiated drugs..."
                className="text-xs min-h-[75px] leading-relaxed bg-background"
              />
            </div>

            {/* Follow-up & Monitoring Plan */}
            <div className="space-y-1.5">
              <Label
                htmlFor="monitoring-plan"
                className="text-xs font-bold text-foreground flex items-center gap-1.5"
              >
                <Clock className="size-3.5 text-amber-600" /> Monitoring & Lab Orders Plan
              </Label>
              <Textarea
                id="monitoring-plan"
                value={monitoringPlan}
                onChange={(e) => setMonitoringPlan(e.target.value)}
                placeholder="Repeat labs (CrCl, HbA1c, INR), BP home monitoring, follow-up instructions..."
                className="text-xs min-h-[75px] leading-relaxed bg-background"
              />
            </div>

            {/* Next Appointment Date */}
            <div className="space-y-1.5">
              <Label
                htmlFor="next-app"
                className="text-xs font-bold text-foreground flex items-center gap-1.5"
              >
                <Calendar className="size-3.5 text-primary" /> Next Appointment Review Date
              </Label>
              <Input
                id="next-app"
                type="date"
                value={nextAppointment}
                onChange={(e) => setNextAppointment(e.target.value)}
                className="text-xs bg-background"
              />
            </div>
          </div>
        </div>

        {/* Loop back to continuous monitoring */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Continuous Monitoring Loop Status</h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
              Active Monitoring
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            The CDSS background engine continues surveillance for clinical parameter changes across
            encounters.
          </p>

          <div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Outstanding Alerts Status</span>
              <span>
                {remainingAlerts.length} alert(s) remaining · {remainingReminders.length}{" "}
                reminder(s)
              </span>
            </div>

            {remainingAlerts.length === 0 && remainingReminders.length === 0 ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 pt-1">
                <CheckCircle2 className="size-4" /> All encounter alerts have been addressed and
                documented.
              </div>
            ) : (
              <ul className="space-y-1.5 pt-1">
                {remainingAlerts.map((al: CdssAlert) => (
                  <li
                    key={al.id}
                    className="flex items-center gap-2 rounded-lg border border-l-4 border-rose-500/30 border-l-rose-500 bg-rose-500/5 px-2.5 py-1.5 text-xs font-medium text-foreground"
                  >
                    <AlertTriangle className="size-3.5 text-rose-600 shrink-0" />
                    {al.title}
                  </li>
                ))}
                {remainingReminders.map((al: CdssAlert) => (
                  <li
                    key={al.id}
                    className="flex items-center gap-2 rounded-lg border border-l-4 border-amber-500/30 border-l-amber-500 bg-amber-500/5 px-2.5 py-1.5 text-xs font-medium text-foreground"
                  >
                    <Info className="size-3.5 text-amber-600 shrink-0" />
                    {al.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
            <Link to="/" search={{ p: patient.patient_id }}>
              <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs h-8">
                Return to Patient Dashboard
              </Button>
            </Link>
            <Link to="/audit" search={{ p: patient.patient_id }}>
              <Button
                size="sm"
                className="w-full sm:w-auto text-xs h-8 bg-primary text-primary-foreground font-semibold shadow-xs"
              >
                Inspect Complete Audit Trail <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
