import patientsData from "@/data/patients.json";
import type { Patient } from "@/cdss/types";
import type { EmrAdapter } from "./types";

function calculateEncounterAge(dob?: string, encounterDate?: string): number | undefined {
  if (!dob || !encounterDate) return undefined;
  const birth = new Date(dob);
  const encounter = new Date(encounterDate);
  let age = encounter.getFullYear() - birth.getFullYear();
  const m = encounter.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && encounter.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : undefined;
}

function normalizePatient(p: Patient): Patient {
  const encAge = calculateEncounterAge(p.dob, p.encounter?.clinic_date);
  return {
    ...p,
    age_at_encounter: encAge ?? p.age,
    // Preserve dated arrays if present or construct fallback
    vitals: {
      ...p.vitals,
      bp_readings:
        p.vitals?.bp_readings ??
        [
          p.vitals?.bp_latest ? { value: p.vitals.bp_latest, date: p.encounter?.clinic_date ?? "2026-08-26" } : undefined,
          p.vitals?.bp_second ? { value: p.vitals.bp_second, date: p.encounter?.clinic_date ?? "2026-08-26" } : undefined,
        ].filter(Boolean) as import("@/cdss/types").DatedValue<string>[],
      weight_record:
        p.vitals?.weight_record ??
        (p.vitals?.weight ? { value: p.vitals.weight, date: p.encounter?.clinic_date ?? "2026-08-26" } : undefined),
    },
    labs: {
      ...p.labs,
      creatinine_record:
        p.labs?.creatinine_record ??
        (p.labs?.creatinine
          ? {
              value: p.labs.creatinine,
              unit: p.labs.creatinine_unit ?? "umol/L",
              date: p.encounter?.clinic_date ?? "2026-08-26",
            }
          : undefined),
      hba1c_record:
        p.labs?.hba1c_record ??
        (p.labs?.hba1c ? { value: p.labs.hba1c, date: p.encounter?.clinic_date ?? "2026-08-26" } : undefined),
      inr_results:
        p.labs?.inr_results ??
        (p.labs?.inr_history?.map((val, idx) => ({
          value: val,
          date: `2026-0${Math.min(idx + 1, 8)}-15`,
        })) ?? []),
    },
  };
}

const patients: Patient[] = (patientsData as Patient[]).map(normalizePatient);

export const mockAdapter: EmrAdapter = {
  name: "mock",
  async getPatient(id) {
    return patients.find((p) => p.patient_id === id);
  },
  async listPatients() {
    return patients;
  },
};
