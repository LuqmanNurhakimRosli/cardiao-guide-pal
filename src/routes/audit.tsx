import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listPatients, getAuditLog } from "@/cdss/server.functions";
import { AppShell } from "@/components/cdss/AppShell";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/audit")({
  validateSearch: searchSchema,
  loader: async () => {
    const [patients, audit] = await Promise.all([
      listPatients(),
      getAuditLog(),
    ]);
    return { patients, audit };
  },
  component: AuditPage,
});

function AuditPage() {
  const { patients, audit } = Route.useLoaderData();
  const search = Route.useSearch();
  const selectedId = search.p ?? patients[0].patient_id;

  return (
    <AppShell patients={patients} selectedId={selectedId}>
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-3">
          <h1 className="text-lg font-bold">Audit Log</h1>
          <p className="text-xs text-muted-foreground">
            All clinician actions across patients · Source = CDSS
          </p>
        </div>

        {audit.length === 0 ? (
          <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No actions logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2">Date / Time</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Alert</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Override / Notes</th>
                  <th className="px-3 py-2">Clinician</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-mono">
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{a.patient_id}</td>
                    <td className="px-3 py-2">{a.alert_title}</td>
                    <td className="px-3 py-2 capitalize font-medium">
                      {a.action}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {a.override_reason ?? ""}
                      {a.override_notes ? ` — ${a.override_notes}` : ""}
                      {a.defer_until ? ` (until ${a.defer_until})` : ""}
                      {a.med_change
                        ? ` · ${a.med_change.name} → ${a.med_change.new_dose}`
                        : ""}
                      {!a.override_reason &&
                        !a.override_notes &&
                        !a.defer_until &&
                        !a.med_change &&
                        "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">DR001</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        CDSS
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
