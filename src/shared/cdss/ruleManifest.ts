export const CDSS_RULE_VERSION = "2026.08.26";

export const CLINICAL_RULES = {
  cha2ds2va: {
    alertThreshold: 2,
    sexSpecific: false,
  },
  hasBled: {
    highRiskThreshold: 3,
    alertWording:
      "HAS-BLED ≥ 3: High bleeding risk. Note: Anticoagulation is not contraindicated solely by high HAS-BLED score; identify and address reversible bleeding risk factors.",
  },
  hba1c: {
    reviewThreshold: 7.0, // alert at > 7.0%
  },
  pinrr: {
    lowerTherapeutic: 2.0,
    upperTherapeutic: 3.0,
    alertBelowPercent: 56, // alert when < 56%
    minimumReadings: 2,
    lookbackMonths: 12,
  },
  dabigatran: {
    ageMandatory: 80, // Age >= 80 -> Recommend 110 mg BD
    ageConsider: 75, // Age 75-79 -> Consider 110 mg BD
    clcrAvoid: 30, // ClCr < 30 -> Avoid
    clcrReduce: 50, // ClCr 30-50 -> Reduce to 110 mg BD
  },
  edoxaban: {
    clcrAvoid: 15, // ClCr < 15 -> Avoid
    clcrReduce: 50, // ClCr 15-50 -> Reduce to 30 mg OD (if on 60 mg OD)
    weightReduce: 60, // Weight <= 60 kg -> Reduce to 30 mg OD (if on 60 mg OD)
  },
  rivaroxaban: {
    clcrAvoid: 15, // ClCr < 15 -> Avoid
    clcrReduce: 49, // ClCr 15-49 -> Reduce to 15 mg OD (if on 20 mg OD)
  },
  apixaban: {
    clcrAvoid: 15, // ClCr < 15 -> Avoid
    clcrReduce: 29, // ClCr 15-29 -> Reduce to 2.5 mg BD (if on 5 mg BD)
    criteriaAge: 80,
    criteriaWeight: 60,
    criteriaCreatinine: 133, // umol/L
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

export const OVERRIDE_REASON_CODES = new Set<string>(OVERRIDE_REASONS.map((reason) => reason.code));
