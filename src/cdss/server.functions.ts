import { createServerFn } from "@tanstack/react-start";
import patientsData from "@/data/patients.json";
import { evaluate } from "@/cdss/engine";
import type { Patient, AuditEntry, ClinicianAction } from "@/cdss/types";

const patients = patientsData as Patient[];

// In-memory store (resets on server restart — fine for demo)
const auditLog: AuditEntry[] = [];
// patient_id -> alert_id -> latest entry (for Summary page)
const actionsByPatient: Record<string, Record<string, AuditEntry>> = {};
// patient_id -> { medName -> newDose }
const medOrders: Record<string, Record<string, string>> = {};

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
    // apply any saved med order overrides for display
    const orders = medOrders[patient.patient_id] ?? {};
    const patched: Patient = {
      ...patient,
      medications: patient.medications.map((m) =>
        orders[m.name] ? { ...m, dose: orders[m.name] } : m,
      ),
    };
    const cdss = evaluate(patched);
    return { patient: patched, cdss };
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
      defer_until?: string;
      med_change?: { name: string; new_dose: string };
    }) => d,
  )
  .handler(async ({ data }) => {
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patient_id: data.patient_id,
      alert_id: data.alert_id,
      alert_title: data.alert_title,
      action: data.action,
      override_reason: data.override_reason,
      override_notes: data.override_notes,
      defer_until: data.defer_until,
      med_change: data.med_change,
      timestamp: new Date().toISOString(),
    };
    auditLog.unshift(entry);
    actionsByPatient[data.patient_id] ??= {};
    actionsByPatient[data.patient_id][data.alert_id] = entry;
    if (data.med_change) {
      medOrders[data.patient_id] ??= {};
      medOrders[data.patient_id][data.med_change.name] = data.med_change.new_dose;
    }
    return { ok: true, entry };
  });

export const getAuditLog = createServerFn({ method: "GET" }).handler(
  async () => auditLog.slice(0, 200),
);

export const getPatientActions = createServerFn({ method: "POST" })
  .inputValidator((d: { patient_id: string }) => d)
  .handler(async ({ data }) => {
    const map = actionsByPatient[data.patient_id] ?? {};
    return Object.values(map).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    );
  });
