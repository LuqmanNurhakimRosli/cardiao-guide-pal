import type { Patient, CdssAlert } from "../types";
import { buildAlert } from "./alertBuilder";

export function parseBP(s?: string): { sys: number; dia: number } | null {
  if (!s) return null;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(s.trim());
  if (!m) return null;
  return { sys: Number(m[1]), dia: Number(m[2]) };
}

export function evaluateBP(p: Patient): {
  alerts: CdssAlert[];
  reminders: CdssAlert[];
} {
  const alerts: CdssAlert[] = [];
  const reminders: CdssAlert[] = [];
  const bp1 = parseBP(p.vitals?.bp_latest);
  const bp2 = parseBP(p.vitals?.bp_second);
  if (!bp1 || !bp2) {
    reminders.push(
      buildAlert({
        id: "bp-missing",
        severity: "reminder",
        category: "data",
        group: "Missing Data",
        title: "Insufficient BP data for review",
        detail: "Two BP readings are required to assess control.",
        rationale: ["Need bp_latest and bp_second."],
      }),
    );
  } else if (bp1.sys > 140 && bp1.dia > 90 && bp2.sys > 140 && bp2.dia > 90) {
    alerts.push(
      buildAlert({
        id: "bp-uncontrolled",
        severity: "alert",
        category: "bp",
        group: "BP",
        title: "Blood pressure uncontrolled — review therapy",
        detail: `Both readings >140/90 (${p.vitals.bp_latest}, ${p.vitals.bp_second}).`,
        rationale: [
          `Latest: ${p.vitals.bp_latest}`,
          `Previous: ${p.vitals.bp_second}`,
          "Threshold: >140/90 on both consecutive readings.",
        ],
        guideline: "MOH Malaysia CPG Hypertension 5th Ed.",
        recommendation:
          "Review antihypertensive regimen; consider intensifying therapy.",
        supporting_values: {
          bp_latest: p.vitals.bp_latest ?? "",
          bp_second: p.vitals.bp_second ?? "",
        },
      }),
    );
  }
  return { alerts, reminders };
}
