import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { getPatientWithCdss } from "@/shared/cdss/server.functions";
import { AssessmentPage } from "@/pages/assessment";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ p: search.p }),
  loader: async ({ deps }) => {
    if (!deps.p) {
      throw redirect({ to: "/patients" });
    }
    const current = await getPatientWithCdss({ data: { patient_id: deps.p } });
    return { current };
  },
  component: PatientDashboardRoute,
});

function PatientDashboardRoute() {
  const { current } = Route.useLoaderData();
  return <AssessmentPage current={current} />;
}
