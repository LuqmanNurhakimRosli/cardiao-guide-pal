/**
 * Thin HTTP client for the CDSS API.
 * Keep this file free of UI concerns — only request/response shapes.
 */
import type { Patient, CdssAlert } from "@/cdss/types";
import type { ClinicianInputs } from "@/cdss/usePatientState";
import { cdssConfig } from "@/cdss/config";

const BASE_URL = cdssConfig.apiBaseUrl;

export interface AnalyzeRequest {
  patient_id?: string;
  patient?: Patient;
  clinician_inputs?: ClinicianInputs;
}

export interface AnalyzeResponse {
  ok: boolean;
  error?: string;
  patient?: {
    patient_id: string;
    name: string;
    age: number;
    sex: string;
    clinic_location: string;
  };
  executed?: boolean;
  reason?: string;
  hasAF?: boolean;
  clinicEligible?: boolean;
  afEvidence?: import("@/cdss/types").AfEvidence[];
  afConfirmed?: boolean | null;
  scores?: {
    cha2ds2vasc?: { total: number; breakdown: Record<string, number> };
    clcr?: number;
    pinrr?: number;
  };
  alerts?: CdssAlert[];
  reminders?: CdssAlert[];
  /** Unified envelope fields (optional to stay backward compatible). */
  success?: boolean;
  recommendations?: Array<{
    alert_id: string;
    group?: string;
    recommendation: string;
  }>;
  audit?: {
    request_id: string;
    engine_version: string;
    patient_id: string;
    input_source: "auto" | "hybrid";
    evaluated_at: string;
  };
  meta?: {
    engine_version: string;
    evaluated_at?: string;
    timestamp?: string;
    request_id?: string;
    execution_time_ms?: number;
    input_source: "auto" | "hybrid";
  };
}

export async function analyzePatient(
  body: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  const res = await fetch(`${BASE_URL}/api/cdss/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CDSS API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as AnalyzeResponse;
}
