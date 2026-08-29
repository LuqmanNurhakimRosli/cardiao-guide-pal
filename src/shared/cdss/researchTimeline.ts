/**
 * Research Timeline Utility.
 *
 * Classifies patient observations and CDSS events into:
 * 1. Pre-alert window: 12 months prior through 1 day before the index encounter date.
 * 2. Index encounter: The index clinic encounter date.
 * 3. Post-alert window: 1 day after through 3 months (90 days) after the index date.
 */
import type {
  Patient,
  AuditEntry,
  TimelineEvent,
  ResearchTimelineSummary,
  ResearchWindowType,
} from "./types";

export function classifyDateWindow(eventDateStr: string, indexDateStr: string): ResearchWindowType {
  if (!eventDateStr || !indexDateStr) return "outside";

  const eventDate = new Date(`${eventDateStr.slice(0, 10)}T00:00:00Z`);
  const indexDate = new Date(`${indexDateStr.slice(0, 10)}T00:00:00Z`);

  if (isNaN(eventDate.getTime()) || isNaN(indexDate.getTime())) return "outside";

  // Pre-alert boundaries
  const preStart = new Date(indexDate);
  preStart.setUTCFullYear(preStart.getUTCFullYear() - 1); // index - 12m
  const preEnd = new Date(indexDate);
  preEnd.setUTCDate(preEnd.getUTCDate() - 1); // index - 1d

  // Post-alert boundaries
  const postStart = new Date(indexDate);
  postStart.setUTCDate(postStart.getUTCDate() + 1); // index + 1d
  const postEnd = new Date(indexDate);
  postEnd.setUTCMonth(postEnd.getUTCMonth() + 3); // index + 3m

  const eventTime = eventDate.getTime();
  const indexTime = indexDate.getTime();

  if (eventTime === indexTime) {
    return "index";
  } else if (eventTime >= preStart.getTime() && eventTime <= preEnd.getTime()) {
    return "pre-alert";
  } else if (eventTime >= postStart.getTime() && eventTime <= postEnd.getTime()) {
    return "post-alert";
  }
  return "outside";
}

export function buildPatientTimeline(
  patient: Patient,
  auditEntries: AuditEntry[] = [],
  indexDateOverride?: string,
): ResearchTimelineSummary {
  const indexDate = indexDateOverride ?? patient.encounter?.clinic_date ?? "2026-08-26";
  const events: TimelineEvent[] = [];

  // 1. Dated BP readings
  (patient.vitals?.bp_readings ?? []).forEach((bp, idx) => {
    const window = classifyDateWindow(bp.date, indexDate);
    events.push({
      id: `bp-${idx}-${bp.date}`,
      date: bp.date,
      window,
      category: "vitals",
      title: "Blood Pressure Reading",
      detail: `BP: ${bp.value} mmHg`,
      values: { bp: bp.value },
    });
  });

  // 2. Dated Weight
  if (patient.vitals?.weight_record) {
    const w = patient.vitals.weight_record;
    const window = classifyDateWindow(w.date, indexDate);
    events.push({
      id: `weight-${w.date}`,
      date: w.date,
      window,
      category: "vitals",
      title: "Body Weight Measurement",
      detail: `Weight: ${w.value} kg`,
      values: { weight: w.value },
    });
  }

  // 3. Dated Creatinine
  if (patient.labs?.creatinine_record) {
    const cr = patient.labs.creatinine_record;
    const window = classifyDateWindow(cr.date, indexDate);
    events.push({
      id: `creatinine-${cr.date}`,
      date: cr.date,
      window,
      category: "labs",
      title: "Serum Creatinine",
      detail: `${cr.value} ${cr.unit}`,
      values: { creatinine: cr.value, unit: cr.unit },
    });
  }

  // 4. Dated HbA1c
  if (patient.labs?.hba1c_record) {
    const hb = patient.labs.hba1c_record;
    const window = classifyDateWindow(hb.date, indexDate);
    events.push({
      id: `hba1c-${hb.date}`,
      date: hb.date,
      window,
      category: "labs",
      title: "Glycated Haemoglobin (HbA1c)",
      detail: `HbA1c: ${hb.value}%`,
      values: { hba1c: hb.value },
    });
  }

  // 5. Dated INR Results
  (patient.labs?.inr_results ?? []).forEach((inr, idx) => {
    const window = classifyDateWindow(inr.date, indexDate);
    events.push({
      id: `inr-${idx}-${inr.date}`,
      date: inr.date,
      window,
      category: "labs",
      title: "INR Test Result",
      detail: `INR: ${inr.value}`,
      values: { inr: inr.value },
    });
  });

  // 6. Medications with start dates
  (patient.medications ?? []).forEach((med, idx) => {
    const date = med.start_date ?? indexDate;
    const window = classifyDateWindow(date, indexDate);
    events.push({
      id: `med-${idx}-${med.name}`,
      date,
      window,
      category: "medications",
      title: `Medication Prescribed: ${med.name}`,
      detail: `${med.name} ${med.dose ?? ""} (${med.indication ?? "AF"})`,
      values: { medication: med.name, dose: med.dose ?? "" },
    });
  });

  // 7. Hospital Admissions
  (patient.hospitalisations ?? []).forEach((hosp, idx) => {
    const window = classifyDateWindow(hosp.admission_date, indexDate);
    events.push({
      id: `hosp-${idx}-${hosp.admission_date}`,
      date: hosp.admission_date,
      window,
      category: "admissions",
      title: "Hospital Admission",
      detail: `${hosp.diagnosis ?? "Admission"} (Discharged: ${hosp.discharge_date ?? "Ongoing"})`,
      values: { diagnosis: hosp.diagnosis ?? "", cause: hosp.cause ?? "" },
    });
  });

  // 8. CDSS Actions from Audit Log
  auditEntries
    .filter((a) => a.patient_id === patient.patient_id)
    .forEach((action) => {
      const date = action.timestamp.slice(0, 10);
      const window = classifyDateWindow(date, indexDate);
      events.push({
        id: `cdss-${action.id}`,
        date,
        window,
        category: "cdss_action",
        title: `CDSS Action: ${action.action.toUpperCase()} (${action.alert_title})`,
        detail: action.override_reason
          ? `Reason: ${action.override_reason}`
          : action.defer_until
            ? `Deferred until: ${action.defer_until}`
            : action.med_change
              ? `Order change: ${action.med_change.name} → ${action.med_change.new_dose}`
              : "Action accepted by clinician.",
      });
    });

  // Sort chronological
  events.sort((a, b) => a.date.localeCompare(b.date));

  // Compute completeness
  const preEvents = events.filter((e) => e.window === "pre-alert");
  const indexEvents = events.filter((e) => e.window === "index");
  const postEvents = events.filter((e) => e.window === "post-alert");

  const preStartDate = new Date(`${indexDate}T00:00:00Z`);
  preStartDate.setUTCFullYear(preStartDate.getUTCFullYear() - 1);
  const preEndDate = new Date(`${indexDate}T00:00:00Z`);
  preEndDate.setUTCDate(preEndDate.getUTCDate() - 1);

  const postStartDate = new Date(`${indexDate}T00:00:00Z`);
  postStartDate.setUTCDate(postStartDate.getUTCDate() + 1);
  const postEndDate = new Date(`${indexDate}T00:00:00Z`);
  postEndDate.setUTCMonth(postEndDate.getUTCMonth() + 3);

  return {
    patient_id: patient.patient_id,
    mrn: patient.mrn,
    index_alert_date: indexDate,
    pre_alert_window: {
      start: preStartDate.toISOString().slice(0, 10),
      end: preEndDate.toISOString().slice(0, 10),
      events_count: preEvents.length,
      completeness:
        preEvents.length >= 3 ? "Complete" : preEvents.length > 0 ? "Partial" : "Missing",
    },
    index_encounter_window: {
      date: indexDate,
      events_count: indexEvents.length,
      completeness: indexEvents.length >= 2 ? "Complete" : "Partial",
    },
    post_alert_window: {
      start: postStartDate.toISOString().slice(0, 10),
      end: postEndDate.toISOString().slice(0, 10),
      events_count: postEvents.length,
      completeness: postEvents.length >= 1 ? "Complete" : "Missing",
    },
    events,
  };
}
