import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  listPatients,
  getPatientWithCdss,
  getPatientActions,
} from "@/shared/cdss/server.functions";
import { TimelinePage } from "@/pages/timeline";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/timeline")({
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
  component: TimelineRouteComponent,
});

function TimelineRouteComponent() {
  const { current, actions } = Route.useLoaderData();
  return <TimelinePage current={current} actions={actions} />;
}
