import { useCallback, useEffect, useMemo, useState } from "react";
import type { Patient, CdssResult } from "./types";
import { evaluate } from "./engine";

/**
 * Clinician inputs that override / supplement the EMR-loaded patient.
 * Stored per patient_id in localStorage so refreshing the page restores them.
 */
export interface ClinicianInputs {
  // CHA2DS2-VASc fields
  chf?: boolean;
  hypertension?: boolean;
  diabetes?: boolean;
  stroke?: boolean;
  vascular?: boolean;
  age?: number;
  sex?: "male" | "female";

  // HAS-BLED extras (not always derivable from EMR)
  abnormalLiver?: boolean;
  bleedingHistory?: boolean;
  alcohol?: boolean;
  // HAS-BLED overrides (clinician can confirm/correct EMR-derived values)
  hb_hypertension?: boolean;
  hb_abnormalRenal?: boolean;
  hb_stroke?: boolean;
  hb_labileINR?: boolean;
  hb_elderly?: boolean;
  hb_drugs?: boolean;

  // metadata
  _lastSavedAt?: string;
}

const KEY = (id: string) => `cdss:inputs:${id}`;

function load(id: string): ClinicianInputs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY(id));
    return raw ? (JSON.parse(raw) as ClinicianInputs) : {};
  } catch {
    return {};
  }
}

function save(id: string, v: ClinicianInputs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(id), JSON.stringify(v));
  } catch {
    // ignore quota errors
  }
}

export function clearPatientInputs(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY(id));
}

/**
 * Merge clinician inputs back into the patient object so the engine sees
 * a single coherent record.
 */
export function mergePatient(p: Patient, i: ClinicianInputs): Patient {
  return {
    ...p,
    age: i.age ?? p.age,
    sex: i.sex ?? p.sex,
    comorbidities: {
      ...p.comorbidities,
      chf: i.chf ?? p.comorbidities.chf,
      hypertension: i.hypertension ?? p.comorbidities.hypertension,
      diabetes: i.diabetes ?? p.comorbidities.diabetes,
      stroke: i.stroke ?? p.comorbidities.stroke,
      vascular: i.vascular ?? p.comorbidities.vascular,
    },
  };
}

export interface PatientStateApi {
  inputs: ClinicianInputs;
  draft: ClinicianInputs;
  dirty: boolean;
  setField: <K extends keyof ClinicianInputs>(k: K, v: ClinicianInputs[K]) => void;
  reset: () => void;
  saveAndRecalculate: () => ClinicianInputs;
  mergedPatient: Patient;
  draftPatient: Patient;
  cdss: CdssResult; // computed from saved inputs
  draftCdss: CdssResult; // computed from current draft (live preview)
}

export function usePatientState(patient: Patient): PatientStateApi {
  const [inputs, setInputs] = useState<ClinicianInputs>(() => ({}));
  const [draft, setDraft] = useState<ClinicianInputs>(() => ({}));

  // hydrate from localStorage on patient change
  useEffect(() => {
    const stored = load(patient.patient_id);
    setInputs(stored);
    setDraft(stored);
  }, [patient.patient_id]);

  const setField = useCallback(
    <K extends keyof ClinicianInputs>(k: K, v: ClinicianInputs[K]) => {
      setDraft((d) => ({ ...d, [k]: v }));
    },
    [],
  );

  const reset = useCallback(() => setDraft(inputs), [inputs]);

  const saveAndRecalculate = useCallback(() => {
    const next: ClinicianInputs = {
      ...draft,
      _lastSavedAt: new Date().toISOString(),
    };
    save(patient.patient_id, next);
    setInputs(next);
    setDraft(next);
    return next;
  }, [draft, patient.patient_id]);

  const mergedPatient = useMemo(() => mergePatient(patient, inputs), [patient, inputs]);
  const draftPatient = useMemo(() => mergePatient(patient, draft), [patient, draft]);

  const cdss = useMemo(() => evaluate(mergedPatient), [mergedPatient]);
  const draftCdss = useMemo(() => evaluate(draftPatient), [draftPatient]);

  const dirty = useMemo(() => {
    const a = { ...inputs };
    const b = { ...draft };
    delete a._lastSavedAt;
    delete b._lastSavedAt;
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [inputs, draft]);

  return {
    inputs,
    draft,
    dirty,
    setField,
    reset,
    saveAndRecalculate,
    mergedPatient,
    draftPatient,
    cdss,
    draftCdss,
  };
}
