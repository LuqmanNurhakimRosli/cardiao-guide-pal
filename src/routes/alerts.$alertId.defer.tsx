import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listPatients, getPatientWithCdss } from "@/shared/cdss/server.functions";
import { AlertDeferPage } from "@/pages/alerts/defer";

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
  component: AlertDeferRouteComponent,
});

function AlertDeferRouteComponent() {
  const { current, alert } = Route.useLoaderData();
  return <AlertDeferPage current={current} alert={alert} />;
}
