/**
 * Engine orchestrator.
 *
 * Composes pure rule modules from src/cdss/rules/*.
 * Encapsulates CHA2DS2-VA (threshold >= 2), HAS-BLED alert integration,
 * dated observations, and anticoagulant precedence resolution.
 */
import type { Patient, CdssResult, AfEvidence } from "./types";
import { isClinicEligible, clinicGateReason, ALLOWED_CLINICS } from "./rules/clinicGating";
import { detectAfEvidence } from "./rules/afDetection";
import { cha2ds2va } from "./rules/cha2ds2vasc";
import { creatinineClearance } from "./rules/cockcroftGault";
import { evaluateBP } from "./rules/bloodPressure";
import { evaluateHbA1c } from "./rules/hba1c";
import { evaluateAnticoagulants } from "./rules/anticoagulants";
import { detectMissingData } from "./rules/missingData";
import { buildAlert } from "./rules/alertBuilder";
import { hasBled, evaluateHasBledAlert, type HasBledInputs } from "./rules/hasBled";
import { CLINICAL_RULES } from "./ruleManifest";

export { ALLOWED_CLINICS };
export { cha2ds2va, cha2ds2vasc } from "./rules/cha2ds2vasc";
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
  /** Optional clinician inputs for HAS-BLED or manual overrides */
  hasBledInputs?: HasBledInputs;
  indexDate?: string;
}

export function evaluate(
  p: Patient,
  opts: EvaluateOptions = {},
): CdssResult {
  const afConfirmed = opts.afConfirmed ?? null;
  const indexDate = opts.indexDate ?? p.encounter?.clinic_date ?? "2026-08-26";

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

  // 4. CHA2DS2-VA Calculation (Threshold >= 2 for all)
  const chads = cha2ds2va(p);
  const calculatedAt = new Date().toISOString();
  result.scores.cha2ds2va = {
    total: chads.total,
    breakdown: chads.breakdown,
    source: "auto",
    calculated_at: calculatedAt,
  };
  result.scores.cha2ds2vasc = { total: chads.total, breakdown: chads.breakdown };

  if (chads.total >= CLINICAL_RULES.cha2ds2va.alertThreshold) {
    result.alerts.push(
      buildAlert({
        id: "stroke-prevention",
        severity: "alert",
        category: "stroke-risk",
        group: "Stroke Prevention",
        title: "Anticoagulation indicated for stroke prevention",
        detail: `CHA₂DS₂-VA = ${chads.total} (threshold ≥2). Oral anticoagulation is recommended to reduce stroke risk.`,
        rationale: Object.entries(chads.breakdown)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}: +${v}`),
        guideline: "ESC 2020 / AHA Atrial Fibrillation Guidelines",
        recommendation: "Initiate oral anticoagulation (DOAC preferred over Warfarin unless contraindicated).",
        supporting_values: { cha2ds2va: chads.total },
        priority: CLINICAL_RULES.precedence.doseAdjustment,
        action: {
          kind: "review",
        },
      }),
    );
  }

  // 5. HAS-BLED Evaluation
  const defaultHbInputs: HasBledInputs = opts.hasBledInputs ?? {
    hypertension: Boolean(p.comorbidities?.hypertension),
    abnormalRenal: Boolean((p.labs?.creatinine ?? 0) > 200),
    abnormalLiver: false,
    stroke: Boolean(p.comorbidities?.stroke),
    bleedingHistory: false,
    labileINR: false,
    elderly: (p.age_at_encounter ?? p.age) > 65,
    drugs: p.medications?.some((m) =>
      ["aspirin", "clopidogrel", "nsaid"].some((n) => m.name.toLowerCase().includes(n)),
    ) ?? false,
    alcohol: false,
  };

  const hb = hasBled(defaultHbInputs);
  result.scores.hasbled = {
    total: hb.total,
    breakdown: hb.breakdown,
    source: "auto",
    calculated_at: calculatedAt,
  };

  const hbAlert = evaluateHasBledAlert(hb.total, hb.breakdown);
  if (hbAlert) {
    result.alerts.push(hbAlert);
  }

  // 6. Renal Function (Cockcroft-Gault)
  const cl = creatinineClearance(p);
  if (cl.clcr != null) {
    result.scores.clcr = cl.clcr;
  }

  // 7. Clinical Rule Modules
  const bp = evaluateBP(p);
  const hbA1c = evaluateHbA1c(p);
  const ac = evaluateAnticoagulants(p, { clcr: cl.clcr, indexDate });

  if (ac.pinrrResult?.percentage != null) {
    result.scores.pinrr = ac.pinrrResult.percentage;
    result.scores.pinrr_count = ac.pinrrResult.count;
    result.scores.pinrr_date_start = ac.pinrrResult.dateStart;
    result.scores.pinrr_date_end = ac.pinrrResult.dateEnd;
  }

  result.alerts.push(...bp.alerts, ...hbA1c.alerts, ...ac.alerts);
  result.reminders.push(
    ...bp.reminders,
    ...hbA1c.reminders,
    ...ac.reminders,
    ...detectMissingData(p),
  );

  return result;
}
