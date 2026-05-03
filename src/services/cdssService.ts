/**
 * Service layer — the bridge between UI components and the CDSS API.
 * Components should depend on this file, not on cdssApi directly.
 */
import { analyzePatient, type AnalyzeResponse } from "@/api/cdssApi";
import type { Patient, CdssAlert } from "@/cdss/types";
import type { ClinicianInputs } from "@/cdss/usePatientState";

export interface CdssRunResult {
  ok: boolean;
  executed: boolean;
  hasAF: boolean;
  reason?: string;
  alerts: CdssAlert[];
  reminders: CdssAlert[];
  scores: NonNullable<AnalyzeResponse["scores"]>;
  source: "auto" | "hybrid" | "fallback";
  error?: string;
}

const EMPTY: CdssRunResult = {
  ok: false,
  executed: false,
  hasAF: false,
  alerts: [],
  reminders: [],
  scores: {},
  source: "fallback",
};

export async function runCDSS(
  patient: Patient | { patient_id: string },
  clinician_inputs?: ClinicianInputs,
): Promise<CdssRunResult> {
  try {
    const body =
      "diagnoses" in patient
        ? { patient: patient as Patient, clinician_inputs }
        : { patient_id: patient.patient_id, clinician_inputs };

    const r = await analyzePatient(body);
    if (!r.ok) {
      return {
        ...EMPTY,
        reminders: [
          {
            id: "cdss-unavailable",
            severity: "reminder",
            category: "data",
            title: "CDSS service unavailable",
            detail: r.error ?? "Unknown error",
            rationale: [],
          },
        ],
        error: r.error,
      };
    }
    return {
      ok: true,
      executed: r.executed ?? false,
      hasAF: r.hasAF ?? false,
      reason: r.reason,
      alerts: r.alerts ?? [],
      reminders: r.reminders ?? [],
      scores: r.scores ?? {},
      source: r.meta?.input_source ?? "auto",
    };
  } catch (error) {
    console.error("CDSS API error:", error);
    return {
      ...EMPTY,
      reminders: [
        {
          id: "cdss-unavailable",
          severity: "reminder",
          category: "data",
          title: "CDSS service unavailable",
          detail: "Unable to retrieve CDSS results — using safe fallback.",
          rationale: [],
        },
      ],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
