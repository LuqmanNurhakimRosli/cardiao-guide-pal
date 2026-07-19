import type { Patient, CdssAlert } from "../types";
import { buildAlert } from "./alertBuilder";

/**
 * Structured missing-data detection. Each reminder includes a reason,
 * clinical impact, recommended action, and whether the clinician can
 * enter it manually via the hybrid inputs.
 */
export function detectMissingData(p: Patient): CdssAlert[] {
  const out: CdssAlert[] = [];

  if (p.vitals?.weight == null) {
    out.push(
      buildAlert({
        id: "weight-missing",
        severity: "reminder",
        category: "data",
        group: "Missing Data",
        title: "No weight recorded",
        detail: "Weight required for Cockcroft–Gault and DOAC dose criteria.",
        rationale: [],
        supporting_values: {
          reason: "Weight missing from vitals",
          clinical_impact: "Cannot compute ClCr or DOAC dose thresholds.",
          action_required: "Weigh patient; enter value.",
          manual_entry_allowed: true,
        },
      }),
    );
  }

  if (p.labs?.creatinine == null) {
    out.push(
      buildAlert({
        id: "creatinine-missing",
        severity: "reminder",
        category: "data",
        group: "Missing Data",
        title: "No serum creatinine on file",
        detail: "Creatinine required for renal function assessment.",
        rationale: [],
        supporting_values: {
          reason: "No creatinine result",
          clinical_impact: "Cannot compute ClCr; DOAC dose safety uncertain.",
          action_required: "Order U&E panel.",
          manual_entry_allowed: false,
        },
      }),
    );
  }

  if (p.comorbidities?.vascular == null) {
    out.push(
      buildAlert({
        id: "vascular-unknown",
        severity: "reminder",
        category: "data",
        group: "Missing Data",
        title: "Vascular disease status unknown",
        detail: "Impacts CHA₂DS₂-VASc scoring.",
        rationale: [],
        supporting_values: {
          reason: "Vascular disease not documented",
          clinical_impact: "May under-score stroke risk.",
          action_required: "Confirm via history/imaging.",
          manual_entry_allowed: true,
        },
      }),
    );
  }

  if (p.comorbidities?.chf == null) {
    out.push(
      buildAlert({
        id: "chf-unknown",
        severity: "reminder",
        category: "data",
        group: "Missing Data",
        title: "CHF status unknown",
        detail: "Impacts CHA₂DS₂-VASc scoring.",
        rationale: [],
        supporting_values: {
          reason: "Heart failure not documented",
          clinical_impact: "May under-score stroke risk.",
          action_required: "Confirm via echo/history.",
          manual_entry_allowed: true,
        },
      }),
    );
  }

  return out;
}
