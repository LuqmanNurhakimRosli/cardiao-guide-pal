import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState, useEffect } from "react";
import {
  listPatients,
  getPatientWithCdss,
  logAction,
} from "@/cdss/server.functions";
import { OVERRIDE_REASONS, type OverrideReasonCode } from "@/cdss/ruleManifest";
import { AppShell } from "@/components/cdss/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/alerts/$alertId/override")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ p: search.p }),
  loader: async ({ deps, params }) => {
    const patients = await listPatients();
    const patient_id = deps.p ?? patients[0].patient_id;
    const current = await getPatientWithCdss({ data: { patient_id } });
    const all = [...current.cdss.alerts, ...current.cdss.reminders];
    const alert = all.find((a) => a.id === params.alertId);
    return { patients, current, alert };
  },
  component: OverrideFlow,
});

interface QueuedAction {
  alertId: string;
  action: string;
  alertTitle: string;
}

function OverrideFlow() {
  const { patients, current, alert } = Route.useLoaderData();
  const { patient } = current;
  const navigate = useNavigate();

  const [reasonCode, setReasonCode] = useState<OverrideReasonCode | "">("");
  const [otherText, setOtherText] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Queue state
  const [queueIndex, setQueueIndex] = useState<number>(1);
  const [queueTotal, setQueueTotal] = useState<number>(1);

  useEffect(() => {
    setSaving(false);
    setReasonCode("");
    setOtherText("");
    setNotes("");
    try {
      const raw = sessionStorage.getItem("cdss_action_queue");
      const totalRaw = sessionStorage.getItem("cdss_queue_total");
      if (raw && totalRaw) {
        const queue: QueuedAction[] = JSON.parse(raw);
        const total = Number(totalRaw);
        setQueueTotal(total);
        setQueueIndex(total - queue.length + 1);
      }
    } catch {}
  }, [alert?.id]);

  const proceedQueue = () => {
    try {
      const raw = sessionStorage.getItem("cdss_action_queue");
      if (raw) {
        const queue: QueuedAction[] = JSON.parse(raw);
        const nextQueue = queue.filter((item) => item.alertId !== alert?.id);
        sessionStorage.setItem("cdss_action_queue", JSON.stringify(nextQueue));

        if (nextQueue.length > 0) {
          const next = nextQueue[0];
          (navigate as any)({
            to: `/alerts/$alertId/${next.action}`,
            params: { alertId: next.alertId },
            search: { p: patient.patient_id },
          });
          return;
        }
      }
    } catch {}
    navigate({ to: "/summary", search: { p: patient.patient_id } });
  };

  const submit = async () => {
    if (!alert || !reasonCode) return;
    if (reasonCode === "other" && !otherText.trim()) return;

    setSaving(true);
    try {
      const selectedReason = OVERRIDE_REASONS.find((r) => r.code === reasonCode);
      const reasonLabel =
        reasonCode === "other"
          ? otherText.trim()
          : (selectedReason?.label ?? reasonCode);

      await logAction({
        data: {
          patient_id: patient.patient_id,
          alert_id: alert.id,
          alert_title: alert.title,
          action: "override",
          override_reason: reasonLabel,
          override_reason_code: reasonCode,
          override_notes: notes || undefined,
          request_id: `REQ-${Date.now()}`,
          visit_id: patient.encounter?.visit_id ?? "VIS-2026-001",
          snapshot: {
            cha2ds2va:
              current.cdss.scores.cha2ds2va?.total ??
              current.cdss.scores.cha2ds2vasc?.total,
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
      console.error("Failed to log alert override action:", err);
      setSaving(false);
      proceedQueue();
    }
  };

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-xl px-4 py-4 space-y-3">
        {/* Breadcrumb / Back */}
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
            <AlertTriangle className="size-5 text-[var(--clinical-alert)]" />
            <div>
              <h1 className="text-base font-bold">Document Alert Override</h1>
              <p className="text-xs text-muted-foreground">
                Patient: {patient.name} ({patient.patient_id}) · MRN: {patient.mrn ?? "—"}
              </p>
            </div>
          </div>

          {!alert ? (
            <p className="text-sm text-muted-foreground">Alert not found.</p>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Alert context */}
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Triggered Alert
                </span>
                <p className="text-sm font-semibold text-foreground mt-0.5">{alert.title}</p>
                <p className="mt-1 text-muted-foreground">{alert.detail}</p>
              </div>

              {/* Controlled Reason Selection */}
              <div className="space-y-1.5">
                <Label htmlFor="override-reason" className="text-xs font-semibold">
                  Override Reason (Required)
                </Label>
                <Select
                  value={reasonCode}
                  onValueChange={(val) => setReasonCode(val as OverrideReasonCode)}
                >
                  <SelectTrigger id="override-reason" className="text-xs">
                    <SelectValue placeholder="Select structured reason code…" />
                  </SelectTrigger>
                  <SelectContent>
                    {OVERRIDE_REASONS.map((r) => (
                      <SelectItem key={r.code} value={r.code} className="text-xs">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Free text for 'other' */}
              {reasonCode === "other" && (
                <div className="space-y-1.5">
                  <Label htmlFor="other-text" className="text-xs font-semibold text-amber-500">
                    Specify Reason (Mandatory for "Other")
                  </Label>
                  <Textarea
                    id="other-text"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder="Enter clinical rationale for override…"
                    className="text-xs min-h-[70px]"
                  />
                </div>
              )}

              {/* Clinical Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold">
                  Additional Clinical Notes (Optional)
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Clinical context, shared decision with patient, monitoring plan…"
                  className="text-xs min-h-[70px]"
                />
              </div>

              {/* Submission Controls */}
              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <Link to="/alerts" search={{ p: patient.patient_id }}>
                  <Button variant="ghost" size="sm">
                    Cancel
                  </Button>
                </Link>
                <Button
                  onClick={submit}
                  size="sm"
                  disabled={!reasonCode || (reasonCode === "other" && !otherText.trim()) || saving}
                  className="gap-1.5"
                >
                  {saving ? "Saving…" : "Confirm Override"}
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
