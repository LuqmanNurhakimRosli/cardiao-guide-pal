import { createServerFn } from "@tanstack/react-start";
import patientsData from "@/data/patients.json";
import { evaluate } from "@/cdss/engine";
import type { Patient, AuditEntry, ClinicianAction } from "@/cdss/types";

const patients = patientsData as Patient[];

// In-memory audit log (resets on server restart — fine for demo)
const auditLog: AuditEntry[] = [];

export const listPatients = createServerFn({ method: "GET" }).handler(
  async () => {
    return patients.map((p) => ({
      patient_id: p.patient_id,
      name: p.name,
      age: p.age,
      sex: p.sex,
      clinic_location: p.clinic_location,
    }));
  },
);

export const getPatientWithCdss = createServerFn({ method: "POST" })
  .inputValidator((d: { patient_id: string }) => d)
  .handler(async ({ data }) => {
    const patient = patients.find((p) => p.patient_id === data.patient_id);
    if (!patient) throw new Error("Patient not found");
    const cdss = evaluate(patient);
    return { patient, cdss };
  });

export const logAction = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      patient_id: string;
      alert_id: string;
      alert_title: string;
      action: ClinicianAction;
      override_reason?: string;
      override_notes?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...data,
      timestamp: new Date().toISOString(),
    };
    auditLog.unshift(entry);
    return { ok: true, entry };
  });

export const getAuditLog = createServerFn({ method: "GET" }).handler(
  async () => {
    return auditLog.slice(0, 100);
  },
);
