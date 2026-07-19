import patientsData from "@/data/patients.json";
import type { Patient } from "@/cdss/types";
import type { EmrAdapter } from "./types";

const patients = patientsData as Patient[];

export const mockAdapter: EmrAdapter = {
  name: "mock",
  async getPatient(id) {
    return patients.find((p) => p.patient_id === id);
  },
  async listPatients() {
    return patients;
  },
};
