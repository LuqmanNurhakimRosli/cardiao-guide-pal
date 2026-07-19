/**
 * Zod schemas for the CDSS API surface.
 * Owned by the backend route; kept next to the engine so both sides share types.
 */
import { z } from "zod";

export const sexSchema = z.enum(["male", "female"]);

export const medicationSchema = z.object({
  name: z.string().min(1).max(120),
  indication: z.string().max(240).optional(),
  dose: z.string().max(120).optional(),
});

export const patientSchema = z.object({
  patient_id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  age: z.number().int().min(0).max(130),
  sex: sexSchema,
  clinic_location: z.string().min(1).max(120),
  diagnoses: z.array(z.string().max(240)).max(200),
  ecg_results: z.array(z.string().max(240)).max(200),
  medications: z.array(medicationSchema).max(100),
  vitals: z.object({
    bp_latest: z.string().max(20).optional(),
    bp_second: z.string().max(20).optional(),
    weight: z.number().positive().max(500).optional(),
  }),
  labs: z.object({
    creatinine: z.number().positive().max(2000).optional(),
    creatinine_unit: z.enum(["umol/L", "mg/dL"]).optional(),
    hba1c: z.number().positive().max(30).optional(),
    inr_history: z.array(z.number().positive().max(20)).max(200).optional(),
  }),
  comorbidities: z.object({
    chf: z.boolean().optional(),
    hypertension: z.boolean().optional(),
    diabetes: z.boolean().optional(),
    stroke: z.boolean().optional(),
    vascular: z.boolean().optional(),
  }),
});

export const clinicianInputsSchema = z
  .object({
    chf: z.boolean().optional(),
    hypertension: z.boolean().optional(),
    diabetes: z.boolean().optional(),
    stroke: z.boolean().optional(),
    vascular: z.boolean().optional(),
    age: z.number().int().min(0).max(130).optional(),
    sex: sexSchema.optional(),
    abnormalLiver: z.boolean().optional(),
    bleedingHistory: z.boolean().optional(),
    alcohol: z.boolean().optional(),
    hb_hypertension: z.boolean().optional(),
    hb_abnormalRenal: z.boolean().optional(),
    hb_stroke: z.boolean().optional(),
    hb_labileINR: z.boolean().optional(),
    hb_elderly: z.boolean().optional(),
    hb_drugs: z.boolean().optional(),
    afConfirmed: z.union([z.boolean(), z.null()]).optional(),
    _lastSavedAt: z.string().optional(),
  })
  .strict();

export const analyzeRequestSchema = z
  .object({
    patient_id: z.string().min(1).max(64).optional(),
    patient: patientSchema.optional(),
    clinician_inputs: clinicianInputsSchema.optional(),
  })
  .refine((v) => Boolean(v.patient_id || v.patient), {
    message: "Provide either { patient } or { patient_id }",
  });

export type AnalyzeRequestInput = z.infer<typeof analyzeRequestSchema>;
