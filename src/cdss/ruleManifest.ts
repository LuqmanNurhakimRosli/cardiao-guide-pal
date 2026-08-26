export const CDSS_RULE_VERSION = "2026.08.26";

export const CLINICAL_RULES = {
  cha2ds2va: { alertThreshold: 2 },
  hasBled: { highRiskThreshold: 3 },
  hba1c: { reviewThreshold: 7 },
  pinrr: {
    lowerTherapeutic: 2,
    upperTherapeutic: 3,
    alertBelowPercent: 56,
    minimumReadings: 2,
    lookbackMonths: 12,
  },
  precedence: {
    contraindicated: 500,
    notRecommended: 400,
    doseAdjustment: 300,
    caution: 200,
    acceptable: 100,
  },
} as const;

export const OVERRIDE_REASONS = [
  { code: "dose_appropriate", label: "Dose already appropriate" },
  { code: "clinical_judgement", label: "Clinical judgement" },
  { code: "contraindication_intolerance", label: "Contraindication / intolerance" },
  { code: "renal_function", label: "Renal function issue" },
  { code: "bleeding_risk", label: "Bleeding risk" },
  { code: "adherence", label: "Adherence issue" },
  { code: "monitoring_titration", label: "Monitoring / titration" },
  { code: "patient_preference", label: "Patient preference" },
  { code: "temporary_factor", label: "Temporary factor" },
  { code: "other", label: "Other" },
] as const;

export type OverrideReasonCode = (typeof OVERRIDE_REASONS)[number]["code"];

export const OVERRIDE_REASON_CODES = new Set<string>(
  OVERRIDE_REASONS.map((reason) => reason.code),
);