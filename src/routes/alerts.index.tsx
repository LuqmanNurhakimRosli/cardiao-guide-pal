import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  listPatients,
  getPatientWithCdss,
} from "@/shared/cdss/server.functions";
import { AlertsPage } from "@/pages/alerts";

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
  component: AlertsRouteComponent,
});

function AlertsRouteComponent() {
  const { current } = Route.useLoaderData();
  return <AlertsPage current={current} />;
}
