import type { Patient, CdssAlert } from "../types";
import { buildAlert } from "./alertBuilder";
import { CLINICAL_RULES } from "../ruleManifest";

export function isDiabeticPatient(p: Patient): boolean {
  if (p.comorbidities?.diabetes === true) return true;

  // Check ICD-10 diagnosis codes
  const hasDiabetesDx = (p.diagnoses || []).some(
    (d) => d.startsWith("E10") || d.startsWith("E11") || d.startsWith("E13") || d.startsWith("E14"),
  );
  if (hasDiabetesDx) return true;

  // Check anti-diabetic medications
  const antiDiabeticDrugs = [
    "metformin",
    "gliclazide",
    "glimepiride",
    "insulin",
    "empagliflozin",
    "dapagliflozin",
    "linagliptin",
    "sitagliptin",
    "vildagliptin",
    "semaglutide",
    "liraglutide",
    "dulaglutide",
  ];
  const isOnDiabetesMeds = (p.medications || []).some((m) =>
    antiDiabeticDrugs.some((drug) => m.name.toLowerCase().includes(drug)),
  );

  return isOnDiabetesMeds;
}

export function evaluateHbA1c(p: Patient): {
  alerts: CdssAlert[];
  reminders: CdssAlert[];
} {
  const alerts: CdssAlert[] = [];
  const reminders: CdssAlert[] = [];

  const hba1cVal = p.labs?.hba1c_record?.value ?? p.labs?.hba1c;
  const hba1cDate = p.labs?.hba1c_record?.date;
  const isDiabetic = isDiabeticPatient(p);

  if (hba1cVal == null) {
    // Alert Dr to monitor HbA1c if the patient is diabetic or has metabolic indication
    if (isDiabetic) {
      alerts.push(
        buildAlert({
          id: "hba1c-missing",
          severity: "alert",
          category: "glycaemic",
          group: "HbA1c",
          title: "Diabetes documented with missing HbA1c — order/monitor HbA1c",
          detail:
            "Patient has diagnosed Diabetes Mellitus but no recent HbA1c is recorded. Regular monitoring (every 3–6 months) is recommended per CPG T2DM to evaluate glycaemic control in AF.",
          rationale: [
            "Patient has a documented history or pharmacotherapy for Diabetes Mellitus.",
            "No dated HbA1c result on record.",
          ],
          guideline: "MOH Malaysia CPG Management of Type 2 Diabetes Mellitus",
          recommendation: "Order Glycated Haemoglobin (HbA1c) test to monitor glycaemic control.",
          action: {
            kind: "monitoring",
            prompt_order: "Order Glycated Haemoglobin (HbA1c)",
          },
        }),
      );
    }
  } else if (hba1cVal > CLINICAL_RULES.hba1c.reviewThreshold) {
    alerts.push(
      buildAlert({
        id: "hba1c-high",
        severity: "alert",
        category: "glycaemic",
        group: "HbA1c",
        title: "HbA1c above target (>7.0%) — review glycaemic therapy",
        detail: `Latest HbA1c = ${hba1cVal}% ${hba1cDate ? `(${hba1cDate})` : ""} (target ≤7.0%).`,
        rationale: [
          `Measured HbA1c: ${hba1cVal}% ${hba1cDate ? `on ${hba1cDate}` : ""}`,
          "Threshold: >7.0% indicates suboptimal glycaemic control in AF patients.",
        ],
        guideline: "MOH Malaysia CPG Management of Type 2 Diabetes Mellitus",
        recommendation:
          "Optimise anti-diabetic medications, review dietary compliance and lifestyle.",
        supporting_values: {
          hba1c: hba1cVal,
          hba1c_date: hba1cDate ?? "",
        },
      }),
    );
  }

  return { alerts, reminders };
}
