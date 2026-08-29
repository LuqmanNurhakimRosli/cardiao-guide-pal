import type { Patient, CdssAlert } from "../types";
import { buildAlert } from "./alertBuilder";

/**
 * Structured missing-data detection with order prompts for clinicians.
 */
export function detectMissingData(p: Patient): CdssAlert[] {
  const out: CdssAlert[] = [];

  const weight = p.vitals?.weight_record?.value ?? p.vitals?.weight;
  if (weight == null) {
    out.push(
      buildAlert({
        id: "weight-missing",
        severity: "reminder",
        category: "data",
        group: "Missing Data",
        title: "No weight recorded",
        detail: "Weight is required for Cockcroft–Gault CrCl and DOAC dose adjustment criteria.",
        rationale: ["Weight missing from recent encounter vitals."],
        action: {
          kind: "monitoring",
          prompt_order: "Measure and record Patient Weight (kg)",
        },
        supporting_values: {
          reason: "Weight missing from vitals",
          clinical_impact: "Cannot compute CrCl or DOAC dose reduction thresholds.",
          action_required: "Weigh patient; record value in EMR.",
          manual_entry_allowed: true,
        },
      }),
    );
  }

  const creatinine = p.labs?.creatinine_record?.value ?? p.labs?.creatinine;
  if (creatinine == null) {
    out.push(
      buildAlert({
        id: "creatinine-missing",
        severity: "reminder",
        category: "data",
        group: "Missing Data",
        title: "No serum creatinine on file",
        detail: "Serum creatinine is required to compute CrCl and ensure DOAC dosing safety.",
        rationale: ["No recent serum creatinine result found in past 12 months."],
        action: {
          kind: "monitoring",
          prompt_order: "Order Renal Function / Serum Creatinine Test",
        },
        supporting_values: {
          reason: "No creatinine result",
          clinical_impact: "Cannot compute CrCl; DOAC dose safety uncertain.",
          action_required: "Order Renal Profile / Serum Creatinine.",
          manual_entry_allowed: true,
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
        title: "Vascular disease status undocumented",
        detail: "Vascular disease status affects CHA₂DS₂-VA scoring (+1 point).",
        rationale: [
          "No prior myocardial infarction, peripheral artery disease, or aortic plaque documented.",
        ],
        supporting_values: {
          reason: "Vascular disease not documented",
          clinical_impact: "May under-score stroke risk.",
          action_required: "Confirm via history/imaging and record status.",
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
        title: "Heart Failure (CHF) status undocumented",
        detail: "Heart failure status affects CHA₂DS₂-VA scoring (+1 point).",
        rationale: ["No documentation of clinical heart failure or LV ejection fraction."],
        supporting_values: {
          reason: "Heart failure not documented",
          clinical_impact: "May under-score stroke risk.",
          action_required: "Confirm via clinical history / echo and record status.",
          manual_entry_allowed: true,
        },
      }),
    );
  }

  return out;
}
