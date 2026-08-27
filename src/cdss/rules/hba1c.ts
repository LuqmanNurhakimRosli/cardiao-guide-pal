import type { Patient, CdssAlert } from "../types";
import { buildAlert } from "./alertBuilder";
import { CLINICAL_RULES } from "../ruleManifest";

export function evaluateHbA1c(p: Patient): {
  alerts: CdssAlert[];
  reminders: CdssAlert[];
} {
  const alerts: CdssAlert[] = [];
  const reminders: CdssAlert[] = [];

  const hba1cVal = p.labs?.hba1c_record?.value ?? p.labs?.hba1c;
  const hba1cDate = p.labs?.hba1c_record?.date;

  if (hba1cVal == null) {
    reminders.push(
      buildAlert({
        id: "hba1c-missing",
        severity: "reminder",
        category: "data",
        group: "Missing Data",
        title: "No recent HbA1c available",
        detail: "HbA1c is required to evaluate glycaemic control in AF patients with diabetes or metabolic risk.",
        rationale: ["No dated HbA1c result on record."],
        action: {
          kind: "monitoring",
          prompt_order: "Order Glycated Haemoglobin (HbA1c)",
        },
      }),
    );
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
          "Threshold: >7.0% indicates suboptimal glycaemic control.",
        ],
        guideline: "MOH Malaysia CPG Management of Type 2 Diabetes Mellitus",
        recommendation: "Optimise anti-diabetic medications, review dietary compliance and lifestyle.",
        supporting_values: {
          hba1c: hba1cVal,
          hba1c_date: hba1cDate ?? "",
        },
      }),
    );
  }

  return { alerts, reminders };
}
