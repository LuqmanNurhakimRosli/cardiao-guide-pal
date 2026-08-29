/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { evaluate } from "@/shared/cdss/engine";
import { CDSS_ENGINE_VERSION } from "@/shared/cdss/config";
import { CDSS_RULE_VERSION } from "@/shared/cdss/ruleManifest";
import { classifyDateWindow } from "@/shared/cdss/researchTimeline";
import type { Patient, AuditEntry, ClinicianAction } from "@/shared/cdss/types";

// In-memory stores (persisted across live requests during session)
const auditLog: AuditEntry[] = [];
const actionsByPatient: Record<string, Record<string, AuditEntry>> = {};
const medOrders: Record<string, Record<string, string>> = {};
const consultationNotesByPatient: Record<string, NonNullable<Patient["clinician_plan"]>> = {};

async function loadPatient(id: string): Promise<Patient | undefined> {
  const { getEmrAdapter } = await import("@/shared/lib/emr/index.server");
  return getEmrAdapter().getPatient(id);
}
async function loadAllPatients(): Promise<Patient[]> {
  const { getEmrAdapter } = await import("@/shared/lib/emr/index.server");
  return getEmrAdapter().listPatients();
}

export const listPatients = createServerFn({ method: "GET" }).handler(async () => {
  const patients = await loadAllPatients();
  return patients.map((p) => ({
    patient_id: p.patient_id,
    mrn: p.mrn,
    name: p.name,
    age: p.age_at_encounter ?? p.age,
    sex: p.sex,
    clinic_location: p.clinic_location,
    cohort: (p as any).cohort ?? (p.patient_id.startsWith("REAL-") ? "hospital" : "benchmark"),
  }));
});

export const listPatientsWithAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const patients = await loadAllPatients();
  return patients.map((p) => {
    const orders = medOrders[p.patient_id] ?? {};
    const notes = consultationNotesByPatient[p.patient_id];
    const patched: Patient = {
      ...p,
      medications: p.medications.map((m) => (orders[m.name] ? { ...m, dose: orders[m.name] } : m)),
      clinician_plan: {
        ...p.clinician_plan,
        ...notes,
      },
    };
    const cdss = evaluate(patched, { afConfirmed: true });
    let af_status = "No AF";
    if (!cdss.clinicEligible) af_status = "CDSS N/A";
    else if (cdss.afEvidence.length > 0) af_status = "AF";

    const chaScore = cdss.scores.cha2ds2va?.total ?? 0;
    const hasBledScore = cdss.scores.hasbled?.total ?? 0;
    const isValvular = (p.diagnoses || []).some((d) =>
      ["I05.0", "I05.2", "I08.0", "Z95.2"].includes(d),
    );
    const activeDrug =
      p.medications.find((m) =>
        ["Warfarin", "Apixaban", "Dabigatran", "Rivaroxaban", "Edoxaban"].some((d) =>
          m.name.toLowerCase().includes(d.toLowerCase()),
        ),
      )?.name ?? "None";

    const hasDoseAlert = cdss.alerts.some((a) =>
      ["renal-dose", "age-dose", "weight-dose", "contraindication"].includes(a.category),
    );

    return {
      patient_id: p.patient_id,
      mrn: p.mrn,
      name: p.name,
      age: p.age_at_encounter ?? p.age,
      sex: p.sex,
      clinic_location: p.clinic_location,
      cohort: (p as any).cohort ?? (p.patient_id.startsWith("REAL-") ? "hospital" : "benchmark"),
      af_status,
      cha2ds2va_score: chaScore,
      has_bled_score: hasBledScore,
      is_valvular: isValvular,
      active_drug: activeDrug,
      has_dose_alert: hasDoseAlert,
      alerts_count: cdss.alerts.length,
      reminders_count: cdss.reminders.length,
      visit_date: p.encounter?.clinic_date ?? "2024-04-15",
      visit_id: p.encounter?.visit_id,
      executed: cdss.executed,
      clinic_eligible: cdss.clinicEligible,
    };
  });
});

export const getPatientWithCdss = createServerFn({ method: "POST" })
  .inputValidator((d: { patient_id: string }) => d)
  .handler(async ({ data }) => {
    const patient = await loadPatient(data.patient_id);
    if (!patient) throw new Error("Patient not found");
    const orders = medOrders[patient.patient_id] ?? {};
    const notes = consultationNotesByPatient[patient.patient_id];
    const patched: Patient = {
      ...patient,
      medications: patient.medications.map((m) =>
        orders[m.name] ? { ...m, dose: orders[m.name] } : m,
      ),
      clinician_plan: {
        ...patient.clinician_plan,
        ...notes,
      },
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
      override_reason_code?: string;
      override_notes?: string;
      defer_until?: string;
      med_change?: { name: string; new_dose: string };
      snapshot?: AuditEntry["snapshot"];
      request_id?: string;
      visit_id?: string;
      clinician_id?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const now = new Date().toISOString();
    const patient = await loadPatient(data.patient_id);
    const indexDate = patient?.encounter?.clinic_date ?? "2026-08-26";
    const researchWindow = classifyDateWindow(now.slice(0, 10), indexDate);

    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patient_id: data.patient_id,
      mrn: patient?.mrn,
      alert_id: data.alert_id,
      alert_title: data.alert_title,
      action: data.action,
      override_reason: data.override_reason,
      override_reason_code: data.override_reason_code,
      override_notes: data.override_notes,
      defer_until: data.defer_until,
      med_change: data.med_change,
      snapshot: data.snapshot,
      request_id: data.request_id ?? `REQ-${Date.now()}`,
      engine_version: CDSS_ENGINE_VERSION,
      rule_version: CDSS_RULE_VERSION,
      clinician_id: data.clinician_id ?? patient?.encounter?.clinician_id ?? "DR-CAR-01",
      visit_id: data.visit_id ?? patient?.encounter?.visit_id ?? "VIS-2026-001",
      index_alert_date: indexDate,
      research_window: researchWindow,
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

export const saveConsultationNotes = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      patient_id: string;
      doctor_plan?: string;
      medication_plan?: string;
      monitoring_plan?: string;
      next_appointment_date?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const patient = await loadPatient(data.patient_id);
    const now = new Date().toISOString();
    consultationNotesByPatient[data.patient_id] = {
      doctor_plan: data.doctor_plan,
      medication_plan: data.medication_plan,
      monitoring_plan: data.monitoring_plan,
      next_appointment_date: data.next_appointment_date,
    };

    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patient_id: data.patient_id,
      mrn: patient?.mrn,
      alert_id: "plan:consultation_notes",
      alert_title: "Clinician updated consultation & discharge notes",
      action: "accept",
      override_notes: `Plan: ${data.doctor_plan ?? "—"} | Meds: ${data.medication_plan ?? "—"} | Next Review: ${data.next_appointment_date ?? "—"}`,
      engine_version: CDSS_ENGINE_VERSION,
      rule_version: CDSS_RULE_VERSION,
      clinician_id: patient?.encounter?.clinician_id ?? "DR-CAR-01",
      visit_id: patient?.encounter?.visit_id ?? "VIS-2026-001",
      timestamp: now,
    };
    auditLog.unshift(entry);
    return { ok: true, plan: consultationNotesByPatient[data.patient_id] };
  });

export const getAuditLog = createServerFn({ method: "GET" }).handler(async () =>
  auditLog.slice(0, 500),
);

export const logScoreCalculation = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      patient_id: string;
      score_name: "CHA2DS2-VA" | "HAS-BLED";
      total: number;
      source: "auto" | "hybrid" | "manual";
      high_risk: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const patient = await loadPatient(data.patient_id);
    const now = new Date().toISOString();
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patient_id: data.patient_id,
      mrn: patient?.mrn,
      alert_id: `score:${data.score_name}`,
      alert_title: `${data.score_name} score = ${data.total} (${data.source}${data.high_risk ? ", high-risk" : ""})`,
      action: "accept",
      override_notes: `source=${data.source}`,
      engine_version: CDSS_ENGINE_VERSION,
      rule_version: CDSS_RULE_VERSION,
      clinician_id: patient?.encounter?.clinician_id ?? "DR-CAR-01",
      visit_id: patient?.encounter?.visit_id ?? "VIS-2026-001",
      timestamp: now,
    };
    auditLog.unshift(entry);
    return { ok: true, entry };
  });

export const logFieldChange = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { patient_id: string; field: string; old_value: string; new_value: string }) => d,
  )
  .handler(async ({ data }) => {
    const patient = await loadPatient(data.patient_id);
    const now = new Date().toISOString();
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patient_id: data.patient_id,
      mrn: patient?.mrn,
      alert_id: `field:${data.field}`,
      alert_title: `Clinician edited ${data.field}: ${data.old_value} → ${data.new_value}`,
      action: "accept",
      override_notes: `field=${data.field}`,
      engine_version: CDSS_ENGINE_VERSION,
      rule_version: CDSS_RULE_VERSION,
      clinician_id: patient?.encounter?.clinician_id ?? "DR-CAR-01",
      visit_id: patient?.encounter?.visit_id ?? "VIS-2026-001",
      timestamp: now,
    };
    auditLog.unshift(entry);
    return { ok: true, entry };
  });

export const getPatientActions = createServerFn({ method: "POST" })
  .inputValidator((d: { patient_id: string }) => d)
  .handler(async ({ data }) => {
    const map = actionsByPatient[data.patient_id] ?? {};
    return Object.values(map).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  });

