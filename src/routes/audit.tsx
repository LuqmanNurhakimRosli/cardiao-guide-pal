import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listPatients, getAuditLog } from "@/shared/cdss/server.functions";
import { AuditPage } from "@/pages/audit";

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
  component: AuditRouteComponent,
});

function AuditRouteComponent() {
  const { patients, audit } = Route.useLoaderData();
  const search = Route.useSearch();
  const selectedId = search.p ?? patients[0]?.patient_id;
  return <AuditPage patients={patients} audit={audit} selectedId={selectedId} />;
}
