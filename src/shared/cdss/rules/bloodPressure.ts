import type { Patient, CdssAlert } from "../types";
import { buildAlert } from "./alertBuilder";

export function parseBP(s?: string): { sys: number; dia: number } | null {
  if (!s) return null;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(s.trim());
  if (!m) return null;
  return { sys: Number(m[1]), dia: Number(m[2]) };
}

export function isHypertensivePatient(p: Patient): boolean {
  if (p.comorbidities?.hypertension === true) return true;

  const hasHtnDx = (p.diagnoses || []).some(
    (d) =>
      d.startsWith("I10") ||
      d.startsWith("I11") ||
      d.startsWith("I12") ||
      d.startsWith("I13") ||
      d.startsWith("I15"),
  );
  if (hasHtnDx) return true;

  const antiHtnDrugs = [
    "amlodipine",
    "perindopril",
    "losartan",
    "valsartan",
    "telmisartan",
    "candesartan",
    "enalapril",
    "ramipril",
    "lisinopril",
    "bisoprolol",
    "carvedilol",
    "metoprolol",
    "nebivolol",
    "atenolol",
    "indapamide",
    "hydrochlorothiazide",
    "spironolactone",
    "felodipine",
    "nifedipine",
    "diltiazem",
    "verapamil",
  ];
  return (p.medications || []).some((m) =>
    antiHtnDrugs.some((drug) => m.name.toLowerCase().includes(drug)),
  );
}

export function evaluateBP(p: Patient): {
  alerts: CdssAlert[];
  reminders: CdssAlert[];
} {
  const alerts: CdssAlert[] = [];
  const reminders: CdssAlert[] = [];
  const isHypertensive = isHypertensivePatient(p);

  // Extract dated readings or fallback to bp_latest / bp_second
  const readings = p.vitals?.bp_readings && p.vitals.bp_readings.length > 0
    ? p.vitals.bp_readings
    : [
        p.vitals?.bp_latest ? { value: p.vitals.bp_latest, date: p.encounter?.clinic_date ?? "" } : undefined,
        p.vitals?.bp_second ? { value: p.vitals.bp_second, date: p.encounter?.clinic_date ?? "" } : undefined,
      ].filter(Boolean) as import("../types").DatedValue<string>[];

  if (readings.length === 0) {
    if (isHypertensive) {
      alerts.push(
        buildAlert({
          id: "bp-hypertension-missing",
          severity: "alert",
          category: "bp",
          group: "BP",
          title: "Hypertension documented with missing blood pressure — monitor BP",
          detail: "Patient has diagnosed Hypertension, but no blood pressure reading is recorded for this encounter. Active blood pressure monitoring is required to assess control and stroke/bleeding risk.",
          rationale: [
            "Patient has a documented history or pharmacotherapy for Hypertension.",
            "No dated BP readings found for this encounter.",
          ],
          guideline: "MOH Malaysia CPG Hypertension 5th Ed.",
          recommendation: "Measure blood pressure (obtain 2 seated readings) and monitor BP control.",
          action: {
            kind: "monitoring",
            prompt_order: "Measure Blood Pressure (2 readings required)",
          },
        }),
      );
    } else {
      reminders.push(
        buildAlert({
          id: "bp-missing-all",
          severity: "reminder",
          category: "data",
          group: "Missing Data",
          title: "No blood pressure reading recorded",
          detail: "Blood pressure is required to assess control and bleeding risk.",
          rationale: ["No dated BP readings found."],
          action: {
            kind: "monitoring",
            prompt_order: "Measure Blood Pressure (2 readings required)",
          },
        }),
      );
    }
    return { alerts, reminders };
  }

  if (readings.length === 1) {
    reminders.push(
      buildAlert({
        id: "bp-missing-second",
        severity: "reminder",
        category: "data",
        group: "Missing Data",
        title: "Only 1 BP reading recorded — obtain second reading",
        detail: `First reading: ${readings[0].value} (${readings[0].date || "today"}). Two readings required for clinical evaluation.`,
        rationale: ["Clinical guidelines require 2 seated readings at least 1-2 minutes apart."],
        action: {
          kind: "monitoring",
          prompt_order: "Obtain second Blood Pressure reading",
        },
      }),
    );
    return { alerts, reminders };
  }

  // Exactly two most recent readings
  const r1 = readings[0];
  const r2 = readings[1];
  const bp1 = parseBP(r1.value);
  const bp2 = parseBP(r2.value);

  if (bp1 && bp2) {
    // Both readings uncontrolled (>140 or >90)
    const bp1Uncontrolled = bp1.sys > 140 || bp1.dia > 90;
    const bp2Uncontrolled = bp2.sys > 140 || bp2.dia > 90;

    if (bp1Uncontrolled && bp2Uncontrolled) {
      alerts.push(
        buildAlert({
          id: "bp-uncontrolled",
          severity: "alert",
          category: "bp",
          group: "BP",
          title: "Blood pressure uncontrolled — review therapy",
          detail: `Both readings >140/90 mmHg: Reading 1: ${r1.value} (${r1.date || "recent"}), Reading 2: ${r2.value} (${r2.date || "recent"}).`,
          rationale: [
            `Reading 1: ${r1.value} (${r1.date || "dated"})`,
            `Reading 2: ${r2.value} (${r2.date || "dated"})`,
            "Target: ≤140/90 mmHg in patients with AF.",
          ],
          guideline: "MOH Malaysia CPG Hypertension 5th Ed.",
          recommendation: "Review antihypertensive regimen and adherence; adjust therapy to achieve BP target.",
          supporting_values: {
            bp_reading_1: r1.value,
            bp_date_1: r1.date,
            bp_reading_2: r2.value,
            bp_date_2: r2.date,
          },
        }),
      );
    }
  }

  return { alerts, reminders };
}
