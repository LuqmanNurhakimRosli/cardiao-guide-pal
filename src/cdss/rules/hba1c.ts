import type { Patient, CdssAlert } from "../types";
import { buildAlert } from "./alertBuilder";

export function evaluateHbA1c(p: Patient): {
  alerts: CdssAlert[];
  reminders: CdssAlert[];
} {
  const alerts: CdssAlert[] = [];
  const reminders: CdssAlert[] = [];
  if (p.labs?.hba1c == null) {
    reminders.push(
      buildAlert({
        id: "hba1c-missing",
        severity: "reminder",
        category: "data",
        group: "Missing Data",
        title: "No recent HbA1c available",
        detail: "Consider ordering HbA1c if diabetic or at risk.",
        rationale: [],
      }),
    );
  } else if (p.labs.hba1c > 7) {
    alerts.push(
      buildAlert({
        id: "hba1c-high",
        severity: "alert",
        category: "glycaemic",
        group: "HbA1c",
        title: "HbA1c above target — review therapy and adherence",
        detail: `HbA1c = ${p.labs.hba1c}% (target ≤7%).`,
        rationale: [`Measured HbA1c: ${p.labs.hba1c}%`, "Threshold: >7%."],
        guideline: "MOH CPG Type 2 Diabetes",
        recommendation: "Optimise glycaemic control; review adherence.",
        supporting_values: { hba1c: p.labs.hba1c },
      }),
    );
  }
  return { alerts, reminders };
}
