import type { EmrAdapter } from "./types";
import { mockAdapter } from "./mockAdapter.server";
import { unimedAdapter } from "./unimedAdapter.server";
import { fhirAdapter } from "./fhirAdapter.server";

/**
 * Factory — selects the EMR adapter via `CDSS_EMR_ADAPTER`.
 * Default: mock (JSON fixtures) so local dev works with zero config.
 */
export function getEmrAdapter(): EmrAdapter {
  const kind = (process.env.CDSS_EMR_ADAPTER ?? "mock").toLowerCase();
  switch (kind) {
    case "unimed":
      return unimedAdapter;
    case "fhir":
      return fhirAdapter;
    case "mock":
    default:
      return mockAdapter;
  }
}
