import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { evaluate } from "@/cdss/engine";
import { mergePatient, type ClinicianInputs } from "@/cdss/usePatientState";
import { analyzeRequestSchema } from "@/cdss/schemas";
import { CDSS_ENGINE_VERSION } from "@/cdss/config";
import type { Patient } from "@/cdss/types";

const MAX_BODY_BYTES = 64 * 1024;

function makeRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * POST /api/cdss/analyze
 *
 * Production surface for CDSS analysis. All requests are validated with Zod,
 * the data source is loaded through the EMR adapter factory, and responses
 * are returned in a unified envelope while retaining backward-compatible
 * legacy fields for the existing UI.
 */
export const Route = createFileRoute("/api/cdss/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const requestId = makeRequestId();

        // Auth (enforced only when a token is configured).
        const requiredToken = process.env.CDSS_API_TOKEN;
        if (requiredToken) {
          const header = request.headers.get("authorization") ?? "";
          const provided = header.replace(/^Bearer\s+/i, "");
          if (provided !== requiredToken) {
            return Response.json(
              {
                success: false,
                error: { code: "UNAUTHORIZED", message: "Invalid or missing bearer token" },
                meta: { request_id: requestId, engine_version: CDSS_ENGINE_VERSION },
              },
              { status: 401 },
            );
          }
        }

        // Body size guard.
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
          return Response.json(
            {
              success: false,
              error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" },
              meta: { request_id: requestId, engine_version: CDSS_ENGINE_VERSION },
            },
            { status: 413 },
          );
        }

        let parsed;
        try {
          const json = raw ? JSON.parse(raw) : {};
          parsed = analyzeRequestSchema.parse(json);
        } catch (err) {
          const details = err instanceof z.ZodError ? err.issues : undefined;
          return Response.json(
            {
              success: false,
              error: {
                code: "INVALID_REQUEST",
                message: err instanceof Error ? err.message : "Invalid request",
                details,
              },
              meta: { request_id: requestId, engine_version: CDSS_ENGINE_VERSION },
            },
            { status: 400 },
          );
        }

        // Resolve patient via EMR adapter (unless full patient supplied).
        let patient: Patient | undefined = parsed.patient as Patient | undefined;
        if (!patient && parsed.patient_id) {
          const { getEmrAdapter } = await import("@/lib/emr/index.server");
          patient = await getEmrAdapter().getPatient(parsed.patient_id);
        }
        if (!patient) {
          return Response.json(
            {
              success: false,
              error: {
                code: "PATIENT_NOT_FOUND",
                message: "Provide either { patient } or a known { patient_id }.",
              },
              meta: { request_id: requestId, engine_version: CDSS_ENGINE_VERSION },
            },
            { status: 404 },
          );
        }

        const inputs = parsed.clinician_inputs as ClinicianInputs | undefined;
        const merged = inputs ? mergePatient(patient, inputs) : patient;
        const afConfirmed = inputs?.afConfirmed ?? null;
        const result = evaluate(merged, { afConfirmed });

        const recommendations = result.alerts
          .filter((a) => a.recommendation)
          .map((a) => ({
            alert_id: a.id,
            group: a.group,
            recommendation: a.recommendation!,
          }));

        return Response.json({
          // Unified envelope
          success: true,
          alerts: result.alerts,
          scores: result.scores,
          recommendations,
          audit: {
            request_id: requestId,
            engine_version: CDSS_ENGINE_VERSION,
            patient_id: merged.patient_id,
            input_source: inputs ? "hybrid" : "auto",
            evaluated_at: new Date().toISOString(),
          },
          meta: {
            engine_version: CDSS_ENGINE_VERSION,
            request_id: requestId,
            execution_time_ms: Date.now() - startedAt,
            timestamp: new Date().toISOString(),
            input_source: inputs ? "hybrid" : "auto",
          },

          // ----- Legacy top-level fields (backward compatible with current UI) -----
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
          clinicEligible: result.clinicEligible,
          afEvidence: result.afEvidence,
          afConfirmed: result.afConfirmed,
          reminders: result.reminders,
        });
      },
      GET: async () => {
        return Response.json({
          success: true,
          service: "CDSS Analyze",
          method: "POST",
          engine_version: CDSS_ENGINE_VERSION,
          example_body: {
            patient_id: "P001",
            clinician_inputs: { hypertension: true, afConfirmed: true },
          },
        });
      },
    },
  },
});
