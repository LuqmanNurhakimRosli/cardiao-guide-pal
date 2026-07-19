export interface Medication {
  name: string;
  indication?: string;
  dose?: string;
}

export interface Patient {
  patient_id: string;
  name: string;
  age: number;
  sex: "male" | "female";
  clinic_location: string;
  diagnoses: string[];
  ecg_results: string[];
  medications: Medication[];
  vitals: {
    bp_latest?: string; // "150/95"
    bp_second?: string;
    weight?: number; // kg
  };
  labs: {
    creatinine?: number;
    creatinine_unit?: "umol/L" | "mg/dL";
    hba1c?: number;
    inr_history?: number[];
  };
  comorbidities: {
    chf?: boolean;
    hypertension?: boolean;
    diabetes?: boolean;
    stroke?: boolean;
    vascular?: boolean;
  };
}

export type AlertSeverity = "alert" | "reminder";

export type AlertGroup =
  | "Stroke Prevention"
  | "Bleeding Risk"
  | "Drug Safety"
  | "BP"
  | "HbA1c"
  | "Renal Function"
  | "Missing Data"
  | "Other";

export interface CdssAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  rationale: string[];
  category:
    | "stroke-risk"
    | "bleeding-risk"
    | "renal"
    | "bp"
    | "glycaemic"
    | "anticoagulant"
    | "drug-dose"
    | "pinrr"
    | "data";
  /** Optional grouping label for the alert panel. */
  group?: AlertGroup;
  /** Clinical guideline reference (e.g. "ESC 2020 AF Guideline"). */
  guideline?: string;
  /** Suggested clinician action. */
  recommendation?: string;
  /** Structured values that drove the alert; used in audit snapshots. */
  supporting_values?: Record<string, string | number | boolean>;
}

export interface AfEvidence {
  source: "ICD-10" | "ICD-11" | "ECG" | "Medication" | "PMH";
  value: string;
}

export interface CdssResult {
  executed: boolean;
  reason?: string;
  hasAF: boolean;
  clinicEligible: boolean;
  afEvidence: AfEvidence[];
  afConfirmed: boolean | null; // null = awaiting clinician confirmation
  scores: {
    cha2ds2vasc?: { total: number; breakdown: Record<string, number> };
    clcr?: number; // mL/min
    pinrr?: number; // %
  };
  alerts: CdssAlert[];
  reminders: CdssAlert[];
}

export type ClinicianAction = "accept" | "override" | "defer";

export interface AuditEntry {
  id: string;
  patient_id: string;
  alert_id: string;
  alert_title: string;
  action: ClinicianAction;
  override_reason?: string;
  override_notes?: string;
  defer_until?: string;
  med_change?: { name: string; new_dose: string };
  snapshot?: {
    cha2ds2vasc?: number;
    hasbled?: number;
    clcr?: number;
    pinrr?: number;
    clinicEligible?: boolean;
    afConfirmed?: boolean | null;
    values_used?: Record<string, string | number | boolean>;
    alert_evidence?: string[];
    recommendation?: string;
  };
  /** Request ID that produced the alert being actioned. */
  request_id?: string;
  /** Engine version used at the time of the action. */
  engine_version?: string;
  /** Encounter/visit identifier — defaults to timestamp when not supplied. */
  visit_id?: string;
  timestamp: string;
}
