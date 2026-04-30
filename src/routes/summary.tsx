import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  listPatients,
  getPatientWithCdss,
  getPatientActions,
} from "@/cdss/server.functions";
import { AppShell } from "@/components/cdss/AppShell";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Info, AlertTriangle, ArrowRight } from "lucide-react";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/summary")({
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
  component: SummaryPage,
});

function SummaryPage() {
  const { patients, current, actions } = Route.useLoaderData();
  const { patient, cdss } = current;
  const remainingAlerts = cdss.alerts.filter(
    (a) => !actions.some((act) => act.alert_id === a.id),
  );
  const remainingReminders = cdss.reminders.filter(
    (a) => !actions.some((act) => act.alert_id === a.id),
  );

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {/* Action Summary */}
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">Action Summary</h1>
              <p className="text-xs text-muted-foreground">
                Patient {patient.patient_id} · {patient.name} ·{" "}
                {new Date().toLocaleString()}
              </p>
            </div>
            <CheckCircle2 className="size-5 text-[var(--clinical-ok)]" />
          </div>

          {actions.length === 0 ? (
            <p className="rounded border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No actions saved for this patient yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-3 py-2">Alert</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">{a.alert_title}</td>
                      <td className="px-3 py-2 capitalize">
                        {a.action === "accept"
                          ? "Accept / Act Now"
                          : a.action === "defer"
                          ? "Defer / Review Later"
                          : "Override"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {a.med_change &&
                          `Order updated: ${a.med_change.name} → ${a.med_change.new_dose}`}
                        {a.override_reason && `Reason: ${a.override_reason}`}
                        {a.defer_until && `Defer until: ${a.defer_until}`}
                        {a.override_notes && (
                          <div className="mt-0.5 text-foreground/70">
                            Notes: {a.override_notes}
                          </div>
                        )}
                        {!a.med_change &&
                          !a.override_reason &&
                          !a.defer_until &&
                          !a.override_notes &&
                          "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Loop back to monitoring */}
        <div className="rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-bold">Loop Back to Monitoring</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            System continues monitoring patient for future alerts.
          </p>
          <div className="rounded border border-border bg-background p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Combined Clinical Alert Panel — {remainingAlerts.length} alert(s) ·{" "}
              {remainingReminders.length} reminder(s)
            </p>
            {remainingAlerts.length === 0 && remainingReminders.length === 0 ? (
              <p className="text-xs text-[var(--clinical-ok)]">
                ✓ All alerts addressed.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {remainingAlerts.map((al) => (
                  <li
                    key={al.id}
                    className="flex items-start gap-1.5 rounded border border-l-4 border-border border-l-[var(--clinical-alert)] bg-[var(--clinical-alert-bg)] px-2 py-1.5 text-xs"
                  >
                    <AlertTriangle className="mt-0.5 size-3 text-[var(--clinical-alert)]" />
                    {al.title}
                  </li>
                ))}
                {remainingReminders.map((al) => (
                  <li
                    key={al.id}
                    className="flex items-start gap-1.5 rounded border border-l-4 border-border border-l-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)] px-2 py-1.5 text-xs"
                  >
                    <Info className="mt-0.5 size-3 text-[var(--clinical-warn)]" />
                    {al.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Link to="/" search={{ p: patient.patient_id }}>
              <Button variant="outline" size="sm">
                Back to Patient
              </Button>
            </Link>
            <Link to="/audit" search={{ p: patient.patient_id }}>
              <Button size="sm">
                View audit log <ArrowRight className="ml-1 size-3" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
