import { createServerFn } from "@tanstack/react-start";
import { evaluate } from "@/cdss/engine";
import { CDSS_ENGINE_VERSION } from "@/cdss/config";
import type { Patient, AuditEntry, ClinicianAction } from "@/cdss/types";

// In-memory stores (reset on server restart — fine for demo)
const auditLog: AuditEntry[] = [];
const actionsByPatient: Record<string, Record<string, AuditEntry>> = {};
const medOrders: Record<string, Record<string, string>> = {};

async function loadPatient(id: string): Promise<Patient | undefined> {
  const { getEmrAdapter } = await import("@/lib/emr/index.server");
  return getEmrAdapter().getPatient(id);
}
async function loadAllPatients(): Promise<Patient[]> {
  const { getEmrAdapter } = await import("@/lib/emr/index.server");
  return getEmrAdapter().listPatients();
}

export const listPatients = createServerFn({ method: "GET" }).handler(
  async () => {
    const patients = await loadAllPatients();
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
    const patients = await loadAllPatients();
    return patients.map((p) => {
      const orders = medOrders[p.patient_id] ?? {};
      const patched: Patient = {
        ...p,
        medications: p.medications.map((m) =>
          orders[m.name] ? { ...m, dose: orders[m.name] } : m,
        ),
      };
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
    const patient = await loadPatient(data.patient_id);
    if (!patient) throw new Error("Patient not found");
    const orders = medOrders[patient.patient_id] ?? {};
    const patched: Patient = {
      ...patient,
      medications: patient.medications.map((m) =>
        orders[m.name] ? { ...m, dose: orders[m.name] } : m,
      ),
    };
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
      request_id?: string;
      visit_id?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const now = new Date().toISOString();
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
      request_id: data.request_id,
      engine_version: CDSS_ENGINE_VERSION,
      visit_id: data.visit_id ?? now,
      timestamp: now,
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
      engine_version: CDSS_ENGINE_VERSION,
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
      engine_version: CDSS_ENGINE_VERSION,
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
