import type { EmrAdapter } from "./types";

/**
 * Generic FHIR R4 adapter — stub.
 * Implement Patient / Observation / MedicationStatement / Condition queries
 * and map to the internal Patient shape.
 */
export const fhirAdapter: EmrAdapter = {
  name: "fhir",
  async getPatient(_id) {
    throw new Error("FHIR adapter not yet implemented.");
  },
  async listPatients() {
    throw new Error("FHIR adapter not yet implemented.");
  },
};
