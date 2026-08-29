export interface Medication {
  name: string;
  indication?: string;
  dose?: string;
  frequency?: string;
  start_date?: string;
  stop_date?: string;
  order_date?: string;
  change_date?: string;
}

export interface DatedValue<T> {
  value: T;
  date: string;
}

export interface Encounter {
  visit_id: string;
  clinic_date: string;
  clinician_id?: string;
  encounter_type?: string;
  appointment_date?: string;
  patient_record_opened: boolean;
}

export interface Patient {
  patient_id: string;
  mrn?: string;
  name: string;
  age: number;
  dob?: string;
  age_at_encounter?: number;
  sex: "male" | "female";
  ethnicity?: string;
  nationality?: string;
  clinic_location: string;
  encounter?: Encounter;
  diagnoses: string[];
  ecg_results: string[];
  medications: Medication[];
  vitals: {
    bp_latest?: string; // "150/95"
    bp_second?: string;
    weight?: number; // kg
    bp_readings?: DatedValue<string>[];
    weight_record?: DatedValue<number>;
  };
  labs: {
    creatinine?: number;
    creatinine_unit?: "umol/L" | "mg/dL";
    egfr?: number; // mL/min/1.73m2 directly from EMR lab report
    egfr_record?: DatedValue<number> & { unit?: string };
    hba1c?: number;
    inr_history?: number[];
    creatinine_record?: DatedValue<number> & { unit: "umol/L" | "mg/dL" };
    hba1c_record?: DatedValue<number>;
    inr_results?: DatedValue<number>[];
  };
  comorbidities: {
    chf?: boolean;
    hypertension?: boolean;
    diabetes?: boolean;
    stroke?: boolean;
    vascular?: boolean;
  };
  clinician_plan?: {
    doctor_plan?: string;
    medication_plan?: string;
    monitoring_plan?: string;
    next_appointment_date?: string;
  };
  hospitalisations?: Array<{
    admission_date: string;
    discharge_date?: string;
    diagnosis?: string;
    discharge_summary?: string;
    cause?: string;
  }>;
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
  /** Higher values take precedence for mutually exclusive findings. */
  priority?: number;
  rule_id?: string;
  action?: {
    kind: "medication" | "monitoring" | "review";
    medication?: string;
    current_dose?: string;
    suggested_dose?: string;
    prompt_order?: string;
  };
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
    cha2ds2va?: {
      total: number;
      breakdown: Record<string, number>;
      source: "auto" | "hybrid" | "manual";
      calculated_at: string;
    };
    /** Temporary compatibility alias for older consumers. */
    cha2ds2vasc?: { total: number; breakdown: Record<string, number> };
    hasbled?: {
      total: number;
      breakdown: Record<string, number>;
      source: "auto" | "hybrid" | "manual";
      calculated_at: string;
    };
    clcr?: number; // mL/min
    pinrr?: number; // %
    pinrr_count?: number;
    pinrr_date_start?: string;
    pinrr_date_end?: string;
  };
  alerts: CdssAlert[];
  reminders: CdssAlert[];
}

export type CdssEvaluationResult = CdssResult;

export interface PatientSummary {
  patient_id: string;
  mrn?: string;
  name: string;
  age: number;
  sex: "male" | "female";
  clinic_location: string;
  cohort?: string;
  af_status?: string;
  cha2ds2va_score?: number;
  has_bled_score?: number;
  is_valvular?: boolean;
  active_drug?: string;
  has_dose_alert?: boolean;
  alerts_count?: number;
  reminders_count?: number;
}

export type ClinicianAction = "accept" | "override" | "defer";

export interface AuditEntry {
  id: string;
  patient_id: string;
  alert_id: string;
  alert_title: string;
  action: ClinicianAction;
  override_reason?: string;
  override_reason_code?: string;
  override_notes?: string;
  defer_until?: string;
  med_change?: { name: string; new_dose: string };
  snapshot?: {
    cha2ds2va?: number;
    cha2ds2vasc?: number;
    hasbled?: number;
    clcr?: number;
    pinrr?: number;
    clinicEligible?: boolean;
    afConfirmed?: boolean | null;
    values_used?: Record<string, string | number | boolean>;
    alert_evidence?: string[];
    recommendation?: string;
    clinician_plan?: Patient["clinician_plan"];
  };
  /** Request ID that produced the alert being actioned. */
  request_id?: string;
  /** Engine version used at the time of the action. */
  engine_version?: string;
  /** Encounter/visit identifier — defaults to timestamp when not supplied. */
  visit_id?: string;
  mrn?: string;
  clinician_id?: string;
  rule_version?: string;
  index_alert_date?: string;
  research_window?: "pre-alert" | "index" | "post-alert" | "outside";
  timestamp: string;
}

export type ResearchWindowType = "pre-alert" | "index" | "post-alert" | "outside";

export interface TimelineEvent {
  id: string;
  date: string;
  window: ResearchWindowType;
  category: "vitals" | "labs" | "medications" | "admissions" | "cdss_action" | "plan";
  title: string;
  detail: string;
  values?: Record<string, string | number | boolean>;
}

export interface ResearchTimelineSummary {
  patient_id: string;
  mrn?: string;
  index_alert_date: string;
  pre_alert_window: {
    start: string;
    end: string;
    events_count: number;
    completeness: "Complete" | "Partial" | "Missing";
  };
  index_encounter_window: {
    date: string;
    events_count: number;
    completeness: "Complete" | "Partial" | "Missing";
  };
  post_alert_window: {
    start: string;
    end: string;
    events_count: number;
    completeness: "Complete" | "Partial" | "Missing";
  };
  events: TimelineEvent[];
}
