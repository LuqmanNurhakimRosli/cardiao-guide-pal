/**
 * Traceability Matrix mapping Requirements (FR-01 to FR-22) and
 * Acceptance Criteria (AC-01 to AC-16) to rule implementations.
 */

export interface RuleTraceabilityItem {
  id: string;
  category: "FR" | "AC";
  title: string;
  module: string;
  ruleConstant?: string;
  governanceSignOff: boolean;
}

export const RULE_TRACEABILITY: RuleTraceabilityItem[] = [
  {
    id: "FR-01",
    category: "FR",
    title: "Clinic location gating (Cardiology, PCM, Family Medicine)",
    module: "src/cdss/rules/clinicGating.ts",
    governanceSignOff: true,
  },
  {
    id: "FR-02",
    category: "FR",
    title: "AF evidence detection (ICD-10, ICD-11, ECG, Meds, PMH)",
    module: "src/cdss/rules/afDetection.ts",
    governanceSignOff: true,
  },
  {
    id: "FR-03",
    category: "FR",
    title: "Clinician confirmation gate before full CDSS execution",
    module: "src/cdss/engine.ts",
    governanceSignOff: true,
  },
  {
    id: "FR-04",
    category: "FR",
    title: "CHA2DS2-VA scoring (threshold >= 2 for all, sex points removed)",
    module: "src/cdss/rules/cha2ds2vasc.ts",
    ruleConstant: "CLINICAL_RULES.cha2ds2va",
    governanceSignOff: true,
  },
  {
    id: "FR-05",
    category: "FR",
    title: "HAS-BLED scoring and informational alert (>= 3)",
    module: "src/cdss/rules/hasBled.ts",
    ruleConstant: "CLINICAL_RULES.hasBled",
    governanceSignOff: true,
  },
  {
    id: "FR-06",
    category: "FR",
    title: "Cockcroft-Gault CrCl calculation with dated creatinine, weight, and encounter age",
    module: "src/cdss/rules/cockcroftGault.ts",
    governanceSignOff: true,
  },
  {
    id: "FR-07",
    category: "FR",
    title: "Blood pressure evaluation (2 most recent dated readings, no averaging)",
    module: "src/cdss/rules/bloodPressure.ts",
    governanceSignOff: true,
  },
  {
    id: "FR-08",
    category: "FR",
    title: "HbA1c evaluation (dated result, alert > 7.0%)",
    module: "src/cdss/rules/hba1c.ts",
    ruleConstant: "CLINICAL_RULES.hba1c",
    governanceSignOff: true,
  },
  {
    id: "FR-09",
    category: "FR",
    title: "Warfarin PINRR calculation (< 56% over 12 months, min 2 readings)",
    module: "src/cdss/pinrr.ts",
    ruleConstant: "CLINICAL_RULES.pinrr",
    governanceSignOff: true,
  },
  {
    id: "FR-10",
    category: "FR",
    title: "Apixaban dosing rules (ClCr < 15 Avoid, ClCr 15-29 review, 2-of-3 criteria)",
    module: "src/cdss/rules/anticoagulants.ts",
    ruleConstant: "CLINICAL_RULES.apixaban",
    governanceSignOff: true,
  },
  {
    id: "FR-11",
    category: "FR",
    title: "Edoxaban dosing rules (ClCr < 15 Avoid, ClCr 15-50 / Weight <= 60 kg reduce if on 60 mg OD)",
    module: "src/cdss/rules/anticoagulants.ts",
    ruleConstant: "CLINICAL_RULES.edoxaban",
    governanceSignOff: true,
  },
  {
    id: "FR-12",
    category: "FR",
    title: "Rivaroxaban dosing rules (ClCr < 15 Avoid, ClCr 15-49 reduce if on 20 mg OD)",
    module: "src/cdss/rules/anticoagulants.ts",
    ruleConstant: "CLINICAL_RULES.rivaroxaban",
    governanceSignOff: true,
  },
  {
    id: "FR-13",
    category: "FR",
    title: "Dabigatran dosing rules (ClCr < 30 Avoid, Age >= 80 Recommend, Age 75-79 Consider, ClCr 30-50 reduce)",
    module: "src/cdss/rules/anticoagulants.ts",
    ruleConstant: "CLINICAL_RULES.dabigatran",
    governanceSignOff: true,
  },
  {
    id: "FR-14",
    category: "FR",
    title: "Anticoagulant Precedence Resolver (Avoid suppresses dose reductions; max 1 alert per drug)",
    module: "src/cdss/rules/anticoagulants.ts",
    ruleConstant: "CLINICAL_RULES.precedence",
    governanceSignOff: true,
  },
  {
    id: "FR-15",
    category: "FR",
    title: "Missing clinical data prompts (order renal profile, order HbA1c, 2nd BP)",
    module: "src/cdss/rules/missingData.ts",
    governanceSignOff: true,
  },
  {
    id: "FR-16",
    category: "FR",
    title: "Combined Clinical Alert Panel presentation (patient summary, scores, dated values, plans)",
    module: "src/routes/alerts.index.tsx",
    governanceSignOff: true,
  },
  {
    id: "FR-17",
    category: "FR",
    title: "Queued multi-action review workflow (Accept / Override / Defer sequential processing)",
    module: "src/routes/alerts.index.tsx",
    governanceSignOff: true,
  },
  {
    id: "FR-18",
    category: "FR",
    title: "10 Controlled Override Reasons with required text for Other",
    module: "src/routes/alerts.$alertId.override.tsx",
    ruleConstant: "OVERRIDE_REASONS",
    governanceSignOff: true,
  },
  {
    id: "FR-19",
    category: "FR",
    title: "Accept flow using structured medication recommendation metadata",
    module: "src/routes/alerts.$alertId.accept.tsx",
    governanceSignOff: true,
  },
  {
    id: "FR-20",
    category: "FR",
    title: "Defer flow with full snapshot capture and follow-up plan / date",
    module: "src/routes/alerts.$alertId.defer.tsx",
    governanceSignOff: true,
  },
  {
    id: "FR-21",
    category: "FR",
    title: "Research timeline classification (Pre-alert 12m, Index encounter date, Post-alert 3m)",
    module: "src/cdss/researchTimeline.ts",
    governanceSignOff: true,
  },
  {
    id: "FR-22",
    category: "FR",
    title: "Durable audit logging, complete clinical snapshots, and CSV research dataset export",
    module: "src/cdss/server.functions.ts",
    governanceSignOff: true,
  },
];
