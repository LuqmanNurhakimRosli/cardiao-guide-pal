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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock } from "lucide-react";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/alerts/$alertId/defer")({
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
  component: DeferFlow,
});

function DeferFlow() {
  const { patients, current, alert } = Route.useLoaderData();
  const { patient } = current;
  const navigate = useNavigate();
  const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
  const [until, setUntil] = useState(tomorrow);
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!alert) return;
    await logAction({
      data: {
        patient_id: patient.patient_id,
        alert_id: alert.id,
        alert_title: alert.title,
        action: "defer",
        defer_until: until,
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
            <Clock className="size-4 text-[var(--clinical-warn)]" />
            <h1 className="text-base font-bold">Defer Alert</h1>
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
                <Label htmlFor="until">Defer until</Label>
                <Input
                  id="until"
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Plan, e.g. 'Will review after lab repeat.'"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Link to="/alerts" search={{ p: patient.patient_id }}>
                  <Button variant="ghost">Cancel</Button>
                </Link>
                <Button onClick={submit} disabled={!until}>
                  Confirm Defer
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
