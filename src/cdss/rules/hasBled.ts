import type { CdssAlert } from "../types";
import { buildAlert } from "./alertBuilder";
import { CLINICAL_RULES } from "../ruleManifest";

export interface HasBledInputs {
  hypertension: boolean;
  abnormalRenal: boolean;
  abnormalLiver: boolean;
  stroke: boolean;
  bleedingHistory: boolean;
  labileINR: boolean;
  elderly: boolean;
  drugs: boolean;
  alcohol: boolean;
}

export function hasBled(i: HasBledInputs) {
  const breakdown: Record<string, number> = {
    Hypertension: i.hypertension ? 1 : 0,
    "Abnormal renal": i.abnormalRenal ? 1 : 0,
    "Abnormal liver": i.abnormalLiver ? 1 : 0,
    Stroke: i.stroke ? 1 : 0,
    "Bleeding history": i.bleedingHistory ? 1 : 0,
    "Labile INR": i.labileINR ? 1 : 0,
    "Elderly >65": i.elderly ? 1 : 0,
    Drugs: i.drugs ? 1 : 0,
    Alcohol: i.alcohol ? 1 : 0,
  };
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { total, breakdown, highRisk: total >= CLINICAL_RULES.hasBled.highRiskThreshold };
}

export function evaluateHasBledAlert(total: number, breakdown: Record<string, number>): CdssAlert | null {
  if (total < CLINICAL_RULES.hasBled.highRiskThreshold) return null;
  const rationale = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: +${v}`);

  return buildAlert({
    id: "hasbled-high-risk",
    severity: "alert",
    category: "bleeding-risk",
    group: "Bleeding Risk",
    title: "High Bleeding Risk (HAS-BLED ≥ 3)",
    detail: CLINICAL_RULES.hasBled.alertWording,
    rationale,
    guideline: "ESC 2020 / AHA AF Guidelines — Bleeding Risk Assessment",
    recommendation:
      "Identify and correct modifiable bleeding risk factors (e.g. uncontrolled BP, NSAID use, labile INR). Schedule closer monitoring.",
    supporting_values: { hasbled: total },
    priority: CLINICAL_RULES.precedence.caution,
  });
}
