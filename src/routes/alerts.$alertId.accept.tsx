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
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/alerts/$alertId/accept")({
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
  component: AcceptFlow,
});

// Map alert id to suggested medication change
function suggestionFor(alertId: string): { name: string; newDose: string; note: string } | null {
  if (alertId === "apixaban-reduce")
    return { name: "Apixaban", newDose: "2.5 mg BD", note: "Dose reduction (≥2 of 3 criteria met)." };
  if (alertId === "rivaroxaban-reduce")
    return { name: "Rivaroxaban", newDose: "15 mg OD", note: "ClCr 15–49 mL/min." };
  if (alertId === "rivaroxaban-avoid")
    return { name: "Rivaroxaban", newDose: "DISCONTINUE", note: "ClCr <15 mL/min." };
  if (alertId === "dabigatran-reduce-renal" || alertId === "dabigatran-reduce-age")
    return { name: "Dabigatran", newDose: "110 mg BD", note: "Renal/age criterion met." };
  if (alertId === "dabigatran-avoid")
    return { name: "Dabigatran", newDose: "DISCONTINUE", note: "ClCr <30 mL/min." };
  if (alertId === "edoxaban-reduce")
    return { name: "Edoxaban", newDose: "30 mg OD", note: "ClCr/weight criterion." };
  return null;
}

function AcceptFlow() {
  const { patients, current, alert } = Route.useLoaderData();
  const { patient } = current;
  const navigate = useNavigate();
  const suggestion = alert ? suggestionFor(alert.id) : null;
  const currentMed = suggestion
    ? patient.medications.find((m) => m.name === suggestion.name)
    : undefined;
  const [dose, setDose] = useState(suggestion?.newDose ?? currentMed?.dose ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!alert) return;
    setSaving(true);
    await logAction({
      data: {
        patient_id: patient.patient_id,
        alert_id: alert.id,
        alert_title: alert.title,
        action: "accept",
        med_change: suggestion
          ? { name: suggestion.name, new_dose: dose }
          : undefined,
      },
    });
    navigate({ to: "/summary", search: { p: patient.patient_id } });
  };

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-2xl px-4 py-4">
        <Link to="/alerts" search={{ p: patient.patient_id }}>
          <Button variant="ghost" size="sm" className="mb-3">
            <ArrowLeft className="mr-1 size-3" /> Back to Patient
          </Button>
        </Link>

        <h1 className="text-lg font-bold">Medication Review / Order</h1>

        {!alert ? (
          <p className="mt-3 text-sm text-muted-foreground">Alert not found.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded border border-border bg-card p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Alert
              </p>
              <p className="mt-1 text-sm font-semibold">{alert.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</p>
            </div>

            {suggestion ? (
              <>
                <div className="rounded border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Current Order
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {suggestion.name}{" "}
                    <span className="text-muted-foreground">
                      {currentMed?.dose ?? "(not on record)"}
                    </span>
                  </p>
                </div>

                <div className="rounded border border-border bg-[var(--clinical-warn-bg)]/50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--clinical-warn)]">
                    CDSS Recommendation (Advisory)
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {suggestion.name} → {suggestion.newDose}
                  </p>
                  <p className="text-xs text-muted-foreground">{suggestion.note}</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="med">Medication</Label>
                  <Input id="med" value={suggestion.name} readOnly />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dose">New dose</Label>
                  <Input
                    id="dose"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <p className="rounded border border-dashed border-border p-3 text-sm text-muted-foreground">
                No specific medication change suggested by the CDSS for this
                alert. Accepting will simply log "Acted on" with no order
                change.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Link to="/alerts" search={{ p: patient.patient_id }}>
                <Button variant="ghost">Cancel</Button>
              </Link>
              <Button onClick={save} disabled={saving}>
                Save Order
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
