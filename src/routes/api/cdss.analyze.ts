import { createFileRoute } from "@tanstack/react-router";
import { evaluate } from "@/cdss/engine";
import { mergePatient, type ClinicianInputs } from "@/cdss/usePatientState";
import patientsData from "@/data/patients.json";
import type { Patient } from "@/cdss/types";

const patients = patientsData as Patient[];

/**
 * POST /api/cdss/analyze
 *
 * Stateless CDSS endpoint. Accepts either:
 *   { patient_id: string, clinician_inputs?: ClinicianInputs }   — looks up mock EMR
 *   { patient: Patient, clinician_inputs?: ClinicianInputs }     — full patient payload
 *
 * Returns: { ok, patient, alerts, reminders, scores, hasAF, executed, reason, meta }
 *
 * This is the public integration surface — UNIMED (or any EMR) calls this
 * with patient context per encounter.
 */
export const Route = createFileRoute("/api/cdss/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          patient_id?: string;
          patient?: Patient;
          clinician_inputs?: ClinicianInputs;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Invalid JSON body" },
            { status: 400 },
          );
        }

        let patient: Patient | undefined = body.patient;
        if (!patient && body.patient_id) {
          patient = patients.find((p) => p.patient_id === body.patient_id);
        }
        if (!patient) {
          return Response.json(
            {
              ok: false,
              error:
                "Provide either { patient } or a known { patient_id }.",
            },
            { status: 400 },
          );
        }

        const merged = body.clinician_inputs
          ? mergePatient(patient, body.clinician_inputs)
          : patient;

        const result = evaluate(merged);

        return Response.json({
          ok: true,
          patient: {
            patient_id: merged.patient_id,
            name: merged.name,
            age: merged.age,
            sex: merged.sex,
            clinic_location: merged.clinic_location,
          },
          executed: result.executed,
          reason: result.reason,
          hasAF: result.hasAF,
          scores: result.scores,
          alerts: result.alerts,
          reminders: result.reminders,
          meta: {
            engine_version: "1.0.0",
            evaluated_at: new Date().toISOString(),
            input_source: body.clinician_inputs ? "hybrid" : "auto",
          },
        });
      },
      GET: async () => {
        return Response.json({
          ok: true,
          service: "CDSS Analyze",
          method: "POST",
          example_body: {
            patient_id: "P001",
            clinician_inputs: { hypertension: true },
          },
        });
      },
    },
  },
});
