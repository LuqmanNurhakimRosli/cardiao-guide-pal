/**
 * Zod schemas for the CDSS API surface.
 * Owned by the backend route; kept next to the engine so both sides share types.
 */
import { z } from "zod";

export const sexSchema = z.enum(["male", "female"]);

export const datedStringSchema = z.object({
  value: z.string(),
  date: z.string(),
});

export const datedNumberSchema = z.object({
  value: z.number(),
  date: z.string(),
});

export const encounterSchema = z.object({
  visit_id: z.string().max(64),
  clinic_date: z.string().max(20),
  clinician_id: z.string().max(64).optional(),
  encounter_type: z.string().max(64).optional(),
  appointment_date: z.string().max(20).optional(),
  patient_record_opened: z.boolean().default(true),
});

export const medicationSchema = z.object({
  name: z.string().min(1).max(120),
  indication: z.string().max(240).optional(),
  dose: z.string().max(120).optional(),
  frequency: z.string().max(120).optional(),
  start_date: z.string().max(20).optional(),
  stop_date: z.string().max(20).optional(),
  order_date: z.string().max(20).optional(),
  change_date: z.string().max(20).optional(),
});

export const patientSchema = z.object({
  patient_id: z.string().min(1).max(64),
  mrn: z.string().max(64).optional(),
  name: z.string().min(1).max(200),
  age: z.number().int().min(0).max(130),
  dob: z.string().max(20).optional(),
  age_at_encounter: z.number().int().min(0).max(130).optional(),
  sex: sexSchema,
  ethnicity: z.string().max(64).optional(),
  nationality: z.string().max(64).optional(),
  clinic_location: z.string().min(1).max(120),
  encounter: encounterSchema.optional(),
  diagnoses: z.array(z.string().max(240)).max(200),
  ecg_results: z.array(z.string().max(240)).max(200),
  medications: z.array(medicationSchema).max(100),
  vitals: z.object({
    bp_latest: z.string().max(20).optional(),
    bp_second: z.string().max(20).optional(),
    weight: z.number().positive().max(500).optional(),
    bp_readings: z.array(datedStringSchema).optional(),
    weight_record: datedNumberSchema.optional(),
  }),
  labs: z.object({
    creatinine: z.number().positive().max(2000).optional(),
    creatinine_unit: z.enum(["umol/L", "mg/dL"]).optional(),
    hba1c: z.number().positive().max(30).optional(),
    inr_history: z.array(z.number().positive().max(20)).max(200).optional(),
    creatinine_record: z
      .object({
        value: z.number(),
        unit: z.enum(["umol/L", "mg/dL"]),
        date: z.string(),
      })
      .optional(),
    hba1c_record: datedNumberSchema.optional(),
    inr_results: z.array(datedNumberSchema).optional(),
  }),
  comorbidities: z.object({
    chf: z.boolean().optional(),
    hypertension: z.boolean().optional(),
    diabetes: z.boolean().optional(),
    stroke: z.boolean().optional(),
    vascular: z.boolean().optional(),
  }),
  clinician_plan: z
    .object({
      doctor_plan: z.string().optional(),
      medication_plan: z.string().optional(),
      monitoring_plan: z.string().optional(),
      next_appointment_date: z.string().optional(),
    })
    .optional(),
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
    chaConfirmed: z.union([z.boolean(), z.null()]).optional(),
    hasBledConfirmed: z.union([z.boolean(), z.null()]).optional(),
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
