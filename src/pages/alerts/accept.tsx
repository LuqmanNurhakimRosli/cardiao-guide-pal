import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { logAction } from "@/shared/cdss/server.functions";
import { AppShell } from "@/shared/components/layout/AppShell";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { ArrowLeft, CheckCircle2, ArrowRight } from "lucide-react";
import type { Patient, CdssEvaluationResult, Medication, CdssAlert } from "@/shared/cdss/types";

interface QueuedAction {
  alertId: string;
  action: string;
  alertTitle: string;
}

interface AlertAcceptPageProps {
  current: {
    patient: Patient;
    cdss: CdssEvaluationResult;
  };
  alert?: CdssAlert;
}

export function AlertAcceptPage({ current, alert }: AlertAcceptPageProps) {
  const { patient } = current;
  const navigate = useNavigate();

  // Structured action recommendation from rule result
  const actionKind = alert?.action?.kind;
  const suggestedMedName = alert?.action?.medication;
  const suggestedDose = alert?.action?.suggested_dose;

  const currentMed = suggestedMedName
    ? patient.medications.find((m: Medication) =>
        m.name.toLowerCase().includes(suggestedMedName.toLowerCase()),
      )
    : undefined;

  const [dose, setDose] = useState(suggestedDose ?? currentMed?.dose ?? "");
  const [saving, setSaving] = useState(false);

  // Queue state
  const [queueIndex, setQueueIndex] = useState<number>(1);
  const [queueTotal, setQueueTotal] = useState<number>(1);

  useEffect(() => {
    setSaving(false);
    setDose(suggestedDose ?? currentMed?.dose ?? "");
    try {
      const raw = sessionStorage.getItem("cdss_action_queue");
      const totalRaw = sessionStorage.getItem("cdss_queue_total");
      if (raw && totalRaw) {
        const queue: QueuedAction[] = JSON.parse(raw);
        const total = Number(totalRaw);
        setQueueTotal(total);
        setQueueIndex(total - queue.length + 1);
      }
    } catch (err) {
      console.error("Failed to parse queue state:", err);
    }
  }, [alert?.id, suggestedDose, currentMed?.dose]);

  const proceedQueue = () => {
    try {
      const raw = sessionStorage.getItem("cdss_action_queue");
      if (raw) {
        const queue: QueuedAction[] = JSON.parse(raw);
        const nextQueue = queue.filter((item) => item.alertId !== alert?.id);
        sessionStorage.setItem("cdss_action_queue", JSON.stringify(nextQueue));

        if (nextQueue.length > 0) {
          const next = nextQueue[0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (navigate as any)({
            to: `/alerts/$alertId/${next.action}`,
            params: { alertId: next.alertId },
            search: { p: patient.patient_id },
          });
          return;
        }
      }
    } catch (err) {
      console.error("Failed to process queue proceed:", err);
    }
    navigate({ to: "/summary", search: { p: patient.patient_id } });
  };

  const save = async () => {
    if (!alert) return;
    setSaving(true);

    try {
      const isMedChange = Boolean(suggestedMedName && dose);
      const isStrokeAlert = alert.id === "stroke-prevention";
      const isReevalAlert = alert.id === "af-reevaluation-reassessment";

      const acceptRationale = isReevalAlert
        ? "AF clinical reevaluation completed: risk factors, stroke/bleeding risks, AF symptoms, and ongoing management plan reviewed."
        : isStrokeAlert
          ? `Oral anticoagulation indicated (CHA₂DS₂-VA = ${current.cdss.scores.cha2ds2va?.total ?? current.cdss.scores.cha2ds2vasc?.total ?? "≥2"}). Guideline anticoagulation therapy confirmed.`
          : isMedChange
            ? `Prescription updated to ${suggestedMedName} ${dose}.`
            : alert.recommendation
              ? `Advisory recommendation accepted: ${alert.recommendation}`
              : "Clinical recommendation accepted and incorporated into management plan.";

      await logAction({
        data: {
          patient_id: patient.patient_id,
          alert_id: alert.id,
          alert_title: alert.title,
          action: "accept",
          override_notes: acceptRationale,
          med_change: isMedChange ? { name: suggestedMedName!, new_dose: dose } : undefined,
          request_id: `REQ-${Date.now()}`,
          visit_id: patient.encounter?.visit_id ?? "VIS-2026-001",
          snapshot: {
            cha2ds2va:
              current.cdss.scores.cha2ds2va?.total ?? current.cdss.scores.cha2ds2vasc?.total,
            hasbled: current.cdss.scores.hasbled?.total,
            clcr: current.cdss.scores.clcr,
            pinrr: current.cdss.scores.pinrr,
            clinicEligible: current.cdss.clinicEligible,
            afConfirmed: current.cdss.afConfirmed,
            alert_evidence: alert.rationale,
            recommendation: alert.recommendation,
            values_used: {
              age: patient.age_at_encounter ?? patient.age,
              sex: patient.sex,
              weight: patient.vitals?.weight_record?.value ?? patient.vitals?.weight ?? "—",
              creatinine: patient.labs?.creatinine_record?.value ?? patient.labs?.creatinine ?? "—",
            },
            clinician_plan: patient.clinician_plan,
          },
        },
      });

      proceedQueue();
    } catch (err) {
      console.error("Failed to log alert accept action:", err);
      setSaving(false);
      proceedQueue();
    }
  };

  const isStrokeAlert = alert?.id === "stroke-prevention";

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-2xl px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <Link to="/alerts" search={{ p: patient.patient_id }}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 size-3.5" /> Back to Alerts Panel
            </Button>
          </Link>
          {queueTotal > 1 && (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Reviewing Alert {queueIndex} of {queueTotal}
            </span>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <CheckCircle2 className="size-5 text-[var(--clinical-ok)]" />
            <div>
              <h1 className="text-base font-bold">Accept Clinical Recommendation</h1>
              <p className="text-xs text-muted-foreground">
                Patient: {patient.name} ({patient.patient_id}) · MRN: {patient.mrn ?? "—"}
              </p>
            </div>
          </div>

          {!alert ? (
            <p className="text-sm text-muted-foreground">Alert not found.</p>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Alert card */}
              <div className="rounded-md border border-border bg-muted/40 p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Triggered Alert
                </span>
                <p className="text-sm font-semibold text-foreground mt-0.5">{alert.title}</p>
                <p className="mt-1 text-muted-foreground">{alert.detail}</p>
              </div>

              {/* Recommendation advisory */}
              {alert.recommendation && (
                <div className="rounded-md border border-border bg-primary/5 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Advisory Recommendation
                  </span>
                  <p className="text-xs font-medium text-foreground mt-1">{alert.recommendation}</p>
                </div>
              )}

              {/* Specific Medication Change Fields (when drug dose change indicated) */}
              {suggestedMedName && suggestedDose ? (
                <div className="space-y-3 rounded-md border border-border bg-background p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Current Order:</span>
                    <span className="text-muted-foreground font-mono">
                      {suggestedMedName} {currentMed?.dose ?? "(Not on file)"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="med" className="text-[11px]">
                        Medication
                      </Label>
                      <Input
                        id="med"
                        value={suggestedMedName}
                        readOnly
                        className="text-xs bg-muted/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dose" className="text-[11px] font-semibold text-primary">
                        Recommended New Dose
                      </Label>
                      <Input
                        id="dose"
                        value={dose}
                        onChange={(e) => setDose(e.target.value)}
                        className="text-xs font-semibold font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : isStrokeAlert ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-muted-foreground leading-relaxed">
                  Accepting this alert will document initiation of anticoagulation therapy in
                  accordance with guideline recommendations.
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-3 text-muted-foreground">
                  Accepting will log that this advisory was reviewed and acted upon during
                  consultation.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <Link to="/alerts" search={{ p: patient.patient_id }}>
                  <Button variant="ghost" size="sm">
                    Cancel
                  </Button>
                </Link>
                <Button onClick={save} disabled={saving} size="sm" className="gap-1.5 shadow-sm">
                  {saving ? "Saving…" : "Save & Proceed"}
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
