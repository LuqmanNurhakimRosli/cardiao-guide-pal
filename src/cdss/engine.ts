/**
 * Engine orchestrator.
 *
 * Composes pure rule modules from src/cdss/rules/*. This file intentionally
 * contains no clinical logic of its own — every score/alert comes from a
 * dedicated rule module so services can be evolved and tested in isolation.
 */
import type { Patient, CdssResult, AfEvidence } from "./types";
import { isClinicEligible, clinicGateReason, ALLOWED_CLINICS } from "./rules/clinicGating";
import { detectAfEvidence } from "./rules/afDetection";
import { cha2ds2vasc } from "./rules/cha2ds2vasc";
import { creatinineClearance } from "./rules/cockcroftGault";
import { evaluateBP } from "./rules/bloodPressure";
import { evaluateHbA1c } from "./rules/hba1c";
import { evaluateAnticoagulants } from "./rules/anticoagulants";
import { detectMissingData } from "./rules/missingData";
import { buildAlert } from "./rules/alertBuilder";

// Re-exports so existing callers (`import { evaluate, hasBled, ... } from "@/cdss/engine"`)
// keep working without changes.
export { ALLOWED_CLINICS };
export { cha2ds2vasc } from "./rules/cha2ds2vasc";
export { creatinineClearance } from "./rules/cockcroftGault";
export { hasBled, type HasBledInputs } from "./rules/hasBled";

export function detectAF(p: Patient): {
  hasAF: boolean;
  reasons: string[];
  evidence: AfEvidence[];
} {
  const evidence = detectAfEvidence(p);
  return {
    hasAF: evidence.length > 0,
    reasons: evidence.map((e) => `${e.source}: ${e.value}`),
    evidence,
  };
}

export interface EvaluateOptions {
  /** null = awaiting clinician confirmation, true = confirmed, false = rejected */
  afConfirmed?: boolean | null;
}

export function evaluate(
  p: Patient,
  opts: EvaluateOptions = {},
): CdssResult {
  const afConfirmed = opts.afConfirmed ?? null;

  const result: CdssResult = {
    executed: false,
    hasAF: false,
    clinicEligible: false,
    afEvidence: [],
    afConfirmed,
    scores: {},
    alerts: [],
    reminders: [],
  };

  // 1. Clinic gating
  if (!isClinicEligible(p)) {
    result.reason = clinicGateReason(p);
    return result;
  }
  result.clinicEligible = true;

  // 2. AF detection
  const af = detectAF(p);
  result.afEvidence = af.evidence;
  result.hasAF = af.hasAF;
  if (!af.hasAF) {
    result.executed = true;
    result.reason = "No AF evidence in ICD, ECG, medications, or PMH.";
    result.reminders.push(...detectMissingData(p));
    return result;
  }

  // 3. Clinician confirmation gate
  if (afConfirmed === null) {
    result.reason =
      "AF evidence detected — awaiting clinician confirmation before running full CDSS.";
    return result;
  }
  if (afConfirmed === false) {
    result.reason = "AF diagnosis rejected by clinician. Workflow terminated.";
    return result;
  }
  result.executed = true;

  // 4. CHA2DS2-VASc
  const chads = cha2ds2vasc(p);
  result.scores.cha2ds2vasc = chads;
  const triggerScore =
    (p.sex === "male" && chads.total >= 2) ||
    (p.sex === "female" && chads.total >= 3);
  if (triggerScore) {
    result.alerts.push(
      buildAlert({
        id: "stroke-prevention",
        severity: "alert",
        category: "stroke-risk",
        group: "Stroke Prevention",
        title: "Anticoagulation indicated for stroke prevention",
        detail: `CHA₂DS₂-VASc = ${chads.total} (threshold ${p.sex === "female" ? "≥3" : "≥2"}).`,
        rationale: Object.entries(chads.breakdown)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}: +${v}`),
        guideline: "ESC 2020 AF Guideline",
        recommendation: "Initiate oral anticoagulation (DOAC preferred).",
        supporting_values: { cha2ds2vasc: chads.total },
      }),
    );
  }

  // 5. Renal function
  const cl = creatinineClearance(p);
  if (cl.clcr != null) result.scores.clcr = cl.clcr;

  // 6. Rule modules
  const bp = evaluateBP(p);
  const hb = evaluateHbA1c(p);
  const ac = evaluateAnticoagulants(p, { clcr: cl.clcr });
  if (ac.pinrrPct != null) result.scores.pinrr = ac.pinrrPct;

  result.alerts.push(...bp.alerts, ...hb.alerts, ...ac.alerts);
  result.reminders.push(
    ...bp.reminders,
    ...hb.reminders,
    ...ac.reminders,
    ...detectMissingData(p),
  );

  return result;
}
