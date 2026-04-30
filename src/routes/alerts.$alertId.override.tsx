import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import {
  listPatients,
  getPatientWithCdss,
  logAction,
} from "@/cdss/server.functions";
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
import { ArrowLeft, AlertTriangle } from "lucide-react";

const searchSchema = z.object({ p: z.string().optional() });

const REASONS = [
  "Dose already appropriate",
  "Clinical judgement",
  "Temporary factor",
  "Adherence issue",
  "Monitoring / titration",
  "Other",
];

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

function OverrideFlow() {
  const { patients, current, alert } = Route.useLoaderData();
  const { patient } = current;
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!alert || !reason) return;
    await logAction({
      data: {
        patient_id: patient.patient_id,
        alert_id: alert.id,
        alert_title: alert.title,
        action: "override",
        override_reason: reason === "Other" ? `Other: ${other}` : reason,
        override_notes: notes || undefined,
      },
    });
    navigate({ to: "/summary", search: { p: patient.patient_id } });
  };

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-xl px-4 py-4">
        <Link to="/alerts" search={{ p: patient.patient_id }}>
          <Button variant="ghost" size="sm" className="mb-3">
            <ArrowLeft className="mr-1 size-3" /> Back
          </Button>
        </Link>

        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-[var(--clinical-alert)]" />
            <h1 className="text-base font-bold">Override Alert</h1>
          </div>

          {!alert ? (
            <p className="text-sm text-muted-foreground">Alert not found.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded border border-border bg-background p-3">
                <p className="text-sm font-semibold">{alert.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {alert.detail}
                </p>
              </div>

              <div className="space-y-1">
                <Label>Override reason (required)</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {reason === "Other" && (
                <div className="space-y-1">
                  <Label htmlFor="other">Specify</Label>
                  <Textarea
                    id="other"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    placeholder="Free-text reason…"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="notes">Additional notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Clinical context, follow-up plan…"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Link to="/alerts" search={{ p: patient.patient_id }}>
                  <Button variant="ghost">Cancel</Button>
                </Link>
                <Button
                  onClick={submit}
                  disabled={!reason || (reason === "Other" && !other)}
                >
                  Confirm Override
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
