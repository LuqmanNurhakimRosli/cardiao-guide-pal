import { createFileRoute } from "@tanstack/react-router";
import { listPatientsWithAlerts } from "@/shared/cdss/server.functions";
import { PatientsPage } from "@/pages/patients";

export const Route = createFileRoute("/patients")({
  loader: async () => {
    const patients = await listPatientsWithAlerts();
    return { patients };
  },
  component: PatientsRouteComponent,
});

function PatientsRouteComponent() {
  const { patients } = Route.useLoaderData();
  return <PatientsPage patients={patients} />;
}
