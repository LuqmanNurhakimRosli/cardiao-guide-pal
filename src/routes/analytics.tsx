import { createFileRoute } from "@tanstack/react-router";
import { listPatientsWithAlerts } from "@/shared/cdss/server.functions";
import { AnalyticsPage } from "@/pages/analytics";

export const Route = createFileRoute("/analytics")({
  loader: async () => {
    const patients = await listPatientsWithAlerts();
    return { patients };
  },
  component: AnalyticsRouteComponent,
});

function AnalyticsRouteComponent() {
  const { patients } = Route.useLoaderData();
  return <AnalyticsPage patients={patients} />;
}
