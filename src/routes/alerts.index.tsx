import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import {
  listPatients,
  getPatientWithCdss,
} from "@/cdss/server.functions";
import { AppShell } from "@/components/cdss/AppShell";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, ChevronDown, ArrowRight } from "lucide-react";
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

function AlertsReview() {
  const { patients, current } = Route.useLoaderData();
  const { patient, cdss } = current;
  const navigate = useNavigate();
  const all: CdssAlert[] = [...cdss.alerts, ...cdss.reminders];
  const [picks, setPicks] = useState<Record<string, ClinicianAction | "">>({});

  const setPick = (id: string, a: ClinicianAction) =>
    setPicks((s) => ({ ...s, [id]: a }));

  const handleSave = async () => {
    const accepts: { alert: CdssAlert }[] = [];
    for (const al of all) {
      const action = picks[al.id];
      if (!action) continue;
      if (action === "accept") {
        // route to accept page for the FIRST accepted (one at a time)
        accepts.push({ alert: al });
      } else if (action === "override") {
        navigate({
          to: "/alerts/$alertId/override",
          params: { alertId: al.id },
          search: { p: patient.patient_id },
        });
        return;
      } else if (action === "defer") {
        navigate({
          to: "/alerts/$alertId/defer",
          params: { alertId: al.id },
          search: { p: patient.patient_id },
        });
        return;
      }
    }
    if (accepts.length > 0) {
      navigate({
        to: "/alerts/$alertId/accept",
        params: { alertId: accepts[0].alert.id },
        search: { p: patient.patient_id },
      });
      return;
    }
    // nothing actionable: log defers as no-op? just go to summary
    navigate({ to: "/summary", search: { p: patient.patient_id } });
  };


  return (
    <AppShell patients={patients} selectedId={patient.patient_id}>
      <div className="mx-auto max-w-4xl px-4 py-4">
        <div className="mb-4">
          <h1 className="text-lg font-bold">Clinician Review</h1>
          <p className="text-xs text-muted-foreground">
            Patient {patient.patient_id} · {patient.name} — choose an action for
            each alert.
          </p>
        </div>

        {all.length === 0 ? (
          <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No alerts to review.
          </div>
        ) : (
          <ul className="space-y-3">
            {all.map((al) => {
              const isAlert = al.severity === "alert";
              const Icon = isAlert ? AlertTriangle : Info;
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
                  className={`rounded-md border border-l-4 border-border p-3 ${palette}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`mt-0.5 size-4 shrink-0 ${iconColor}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{al.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {al.detail}
                      </p>
                      {al.rationale.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground">
                            <ChevronDown className="size-3" /> Why this alert
                            triggered
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-1 rounded bg-background/60 p-2 text-xs">
                            <ul className="list-disc space-y-0.5 pl-4">
                              {al.rationale.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      <fieldset className="mt-2 flex flex-wrap gap-3 text-xs">
                        {(["accept", "override", "defer"] as ClinicianAction[]).map(
                          (a) => (
                            <label
                              key={a}
                              className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 ${
                                pick === a
                                  ? "bg-foreground text-background"
                                  : "bg-background hover:bg-muted"
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
                                  : "Override"}
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

        {all.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <Link to="/" search={{ p: patient.patient_id }}>
              <Button variant="ghost" size="sm">
                ← Back to patient
              </Button>
            </Link>
            <Button onClick={handleSave} size="sm">
              Save Actions <ArrowRight className="ml-1 size-3" />
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
