import type { CdssAlert } from "../types";

export interface BuildAlertInput {
  id: string;
  severity: CdssAlert["severity"];
  category: CdssAlert["category"];
  title: string;
  detail: string;
  rationale: string[];
  group?: CdssAlert["group"];
  guideline?: string;
  recommendation?: string;
  supporting_values?: Record<string, string | number | boolean>;
}

export function buildAlert(a: BuildAlertInput): CdssAlert {
  return {
    id: a.id,
    severity: a.severity,
    category: a.category,
    title: a.title,
    detail: a.detail,
    rationale: a.rationale,
    group: a.group ?? defaultGroup(a.category),
    guideline: a.guideline,
    recommendation: a.recommendation,
    supporting_values: a.supporting_values,
  };
}

function defaultGroup(c: CdssAlert["category"]): CdssAlert["group"] {
  switch (c) {
    case "stroke-risk":
      return "Stroke Prevention";
    case "bleeding-risk":
      return "Bleeding Risk";
    case "anticoagulant":
    case "drug-dose":
    case "pinrr":
      return "Drug Safety";
    case "bp":
      return "BP";
    case "glycaemic":
      return "HbA1c";
    case "renal":
      return "Renal Function";
    case "data":
    default:
      return "Missing Data";
  }
}

/** Group alerts by their `group` field for the UI. */
export function groupAlerts(alerts: CdssAlert[]): Record<string, CdssAlert[]> {
  const out: Record<string, CdssAlert[]> = {};
  for (const a of alerts) {
    const g = a.group ?? "Other";
    (out[g] ??= []).push(a);
  }
  return out;
}
