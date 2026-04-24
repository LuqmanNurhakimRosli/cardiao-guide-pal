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

export interface CdssAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  rationale: string[]; // "why this triggered"
  category:
    | "stroke-risk"
    | "bleeding-risk"
    | "renal"
    | "bp"
    | "glycaemic"
    | "anticoagulant"
    | "data";
}

export interface CdssResult {
  executed: boolean;
  reason?: string;
  hasAF: boolean;
  scores: {
    cha2ds2vasc?: { total: number; breakdown: Record<string, number> };
    clcr?: number; // mL/min
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
  timestamp: string;
}
