import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  listPatients,
  getPatientWithCdss,
  getPatientActions,
} from "@/cdss/server.functions";
import { AppShell } from "@/components/cdss/AppShell";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

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
    (a: import("@/cdss/types").CdssAlert) =>
      !actions.some((act: import("@/cdss/types").AuditEntry) => act.alert_id === a.id),
  );
  const remainingReminders = cdss.reminders.filter(
    (a: import("@/cdss/types").CdssAlert) =>
      !actions.some((act: import("@/cdss/types").AuditEntry) => act.alert_id === a.id),
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
                Patient: <span className="font-semibold text-foreground">{patient.name}</span> (<span className="font-mono">{patient.patient_id}</span>) · MRN: <span className="font-mono">{patient.mrn ?? "—"}</span> · {new Date().toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <Printer className="size-3.5" /> Print Summary
              </Button>
            </div>
          </div>

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
                    {actions.map((a: import("@/cdss/types").AuditEntry) => (
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
                        <td className="px-4 py-3 text-muted-foreground">
                          {a.med_change && (
                            <div className="font-bold text-primary font-mono text-xs">
                              Prescription Updated: {a.med_change.name} → {a.med_change.new_dose}
                            </div>
                          )}
                          {a.override_reason && (
                            <div className="font-semibold text-foreground">
                              Reason: {a.override_reason}
                            </div>
                          )}
                          {a.defer_until && (
                            <div className="font-mono text-amber-600 font-semibold">
                              Deferred Follow-up Date: {a.defer_until}
                            </div>
                          )}
                          {a.override_notes && (
                            <div className="text-[11px] mt-0.5 text-foreground/80 leading-relaxed">
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
            </div>
          )}
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
            The CDSS background engine continues surveillance for clinical parameter changes across encounters.
          </p>

          <div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Outstanding Alerts Status</span>
              <span>{remainingAlerts.length} alert(s) remaining · {remainingReminders.length} reminder(s)</span>
            </div>

            {remainingAlerts.length === 0 && remainingReminders.length === 0 ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 pt-1">
                <CheckCircle2 className="size-4" /> All encounter alerts have been addressed and documented.
              </div>
            ) : (
              <ul className="space-y-1.5 pt-1">
                {remainingAlerts.map((al: import("@/cdss/types").CdssAlert) => (
                  <li
                    key={al.id}
                    className="flex items-center gap-2 rounded-lg border border-l-4 border-rose-500/30 border-l-rose-500 bg-rose-500/5 px-2.5 py-1.5 text-xs font-medium text-foreground"
                  >
                    <AlertTriangle className="size-3.5 text-rose-600 shrink-0" />
                    {al.title}
                  </li>
                ))}
                {remainingReminders.map((al: import("@/cdss/types").CdssAlert) => (
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
              <Button size="sm" className="w-full sm:w-auto text-xs h-8 bg-primary text-primary-foreground font-semibold shadow-xs">
                Inspect Complete Audit Trail <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
