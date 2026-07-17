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

export const listPatientsWithAlerts = createServerFn({ method: "GET" }).handler(
  async () => {
    return patients.map((p) => {
      const orders = medOrders[p.patient_id] ?? {};
      const patched: Patient = {
        ...p,
        medications: p.medications.map((m) =>
          orders[m.name] ? { ...m, dose: orders[m.name] } : m,
        ),
      };
      // For the list view, run engine assuming AF has been confirmed so the
      // clinician sees the counts they would face on opening the record.
      const cdss = evaluate(patched, { afConfirmed: true });
      let af_status = "No AF";
      if (!cdss.clinicEligible) af_status = "CDSS N/A";
      else if (cdss.afEvidence.length > 0) af_status = "AF";
      return {
        patient_id: p.patient_id,
        name: p.name,
        age: p.age,
        sex: p.sex,
        clinic_location: p.clinic_location,
        af_status,
        alerts_count: cdss.alerts.length,
        reminders_count: cdss.reminders.length,
        executed: cdss.executed,
        clinic_eligible: cdss.clinicEligible,
      };
    });
  },
);

export const getPatientWithCdss = createServerFn({ method: "POST" })
  .inputValidator((d: { patient_id: string }) => d)
  .handler(async ({ data }) => {
    const patient = patients.find((p) => p.patient_id === data.patient_id);
    if (!patient) throw new Error("Patient not found");
    const orders = medOrders[patient.patient_id] ?? {};
    const patched: Patient = {
      ...patient,
      medications: patient.medications.map((m) =>
        orders[m.name] ? { ...m, dose: orders[m.name] } : m,
      ),
    };
    // Loader-side snapshot: engine runs assuming AF confirmed so downstream
    // pages (alerts, summary) always see the full result set. Live UI on the
    // dashboard remains gated by the clinician's actual confirmation.
    const cdss = evaluate(patched, { afConfirmed: true });
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
      snapshot?: AuditEntry["snapshot"];
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
      snapshot: data.snapshot,
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

export const logScoreCalculation = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      patient_id: string;
      score_name: "CHA2DS2-VASc" | "HAS-BLED";
      total: number;
      source: "auto" | "hybrid" | "manual";
      high_risk: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patient_id: data.patient_id,
      alert_id: `score:${data.score_name}`,
      alert_title: `${data.score_name} score = ${data.total} (${data.source}${data.high_risk ? ", high-risk" : ""})`,
      action: "accept",
      override_notes: `source=${data.source}`,
      timestamp: new Date().toISOString(),
    };
    auditLog.unshift(entry);
    return { ok: true, entry };
  });

export const logFieldChange = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      patient_id: string;
      field: string;
      old_value: string;
      new_value: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patient_id: data.patient_id,
      alert_id: `field:${data.field}`,
      alert_title: `Clinician edited ${data.field}: ${data.old_value} → ${data.new_value}`,
      action: "accept",
      override_notes: `field=${data.field}`,
      timestamp: new Date().toISOString(),
    };
    auditLog.unshift(entry);
    return { ok: true, entry };
  });

export const getPatientActions = createServerFn({ method: "POST" })
  .inputValidator((d: { patient_id: string }) => d)
  .handler(async ({ data }) => {
    const map = actionsByPatient[data.patient_id] ?? {};
    return Object.values(map).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    );
  });
