import type { Patient } from "@/cdss/types";

/**
 * EMR Adapter contract.
 *
 * The CDSS engine and API depend only on this interface; swapping data
 * sources (mock JSON → UNIMED → FHIR) requires no changes to routes,
 * services, or UI code.
 */
export interface EmrAdapter {
  readonly name: string;
  getPatient(id: string): Promise<Patient | undefined>;
  listPatients(): Promise<Patient[]>;
}
