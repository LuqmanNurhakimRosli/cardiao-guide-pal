import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Patient, CdssResult } from "./types";
import { evaluate } from "./engine";
import { runCDSS, type CdssRunResult } from "@/services/cdssService";
import { cdssConfig } from "./config";

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

  // AF confirmation nudge (Stage 2): null = awaiting, true = confirmed, false = rejected
  afConfirmed?: boolean | null;

  // metadata
  _lastSavedAt?: string;
}

const KEY = (id: string) => `cdss:inputs:${id}`;
const RESP_KEY = (id: string) => `cdss:response:${id}`;

function load(id: string): ClinicianInputs {
  if (typeof window === "undefined" || !cdssConfig.persistDrafts) return {};
  try {
    const raw = window.localStorage.getItem(KEY(id));
    return raw ? (JSON.parse(raw) as ClinicianInputs) : {};
  } catch {
    return {};
  }
}

function save(id: string, v: ClinicianInputs) {
  if (typeof window === "undefined" || !cdssConfig.persistDrafts) return;
  try {
    window.localStorage.setItem(KEY(id), JSON.stringify(v));
  } catch {
    // ignore quota errors
  }
}

function loadResponse(id: string): CdssRunResult | null {
  if (typeof window === "undefined" || !cdssConfig.persistDrafts) return null;
  try {
    const raw = window.localStorage.getItem(RESP_KEY(id));
    return raw ? (JSON.parse(raw) as CdssRunResult) : null;
  } catch {
    return null;
  }
}

function saveResponse(id: string, r: CdssRunResult) {
  if (typeof window === "undefined" || !cdssConfig.persistDrafts) return;
  try {
    window.localStorage.setItem(RESP_KEY(id), JSON.stringify(r));
  } catch {
    // ignore
  }
}

export function clearPatientInputs(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY(id));
  window.localStorage.removeItem(RESP_KEY(id));
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

/** Convert an API response into the legacy CdssResult shape used by the UI. */
function toResult(r: CdssRunResult, fallback: CdssResult): CdssResult {
  if (!r.ok) return fallback;
  return {
    executed: r.executed,
    hasAF: r.hasAF,
    reason: r.reason,
    clinicEligible: r.clinicEligible ?? true,
    afEvidence: r.afEvidence ?? [],
    afConfirmed: r.afConfirmed ?? null,
    scores: r.scores ?? {},
    alerts: r.alerts,
    reminders: r.reminders,
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
  cdss: CdssResult; // last API response computed from saved inputs
  draftCdss: CdssResult; // live preview computed from current draft (API)
  loading: boolean;
  error?: string;
  source: CdssRunResult["source"];
}

export function usePatientState(patient: Patient): PatientStateApi {
  const [inputs, setInputs] = useState<ClinicianInputs>(() => ({}));
  const [draft, setDraft] = useState<ClinicianInputs>(() => ({}));

  // local fallback so the UI is never empty while the API call is in flight
  const localFallback = useMemo(() => evaluate(patient), [patient]);

  const [cdss, setCdss] = useState<CdssResult>(localFallback);
  const [draftCdss, setDraftCdss] = useState<CdssResult>(localFallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [source, setSource] = useState<CdssRunResult["source"]>("auto");

  // hydrate from localStorage on patient change
  useEffect(() => {
    const stored = load(patient.patient_id);
    setInputs(stored);
    setDraft(stored);
    const cached = loadResponse(patient.patient_id);
    if (cached) {
      const r = toResult(cached, localFallback);
      setCdss(r);
      setDraftCdss(r);
      setSource(cached.source);
    } else {
      setCdss(localFallback);
      setDraftCdss(localFallback);
    }
  }, [patient.patient_id, localFallback]);

  const setField = useCallback(
    <K extends keyof ClinicianInputs>(k: K, v: ClinicianInputs[K]) => {
      setDraft((d) => ({ ...d, [k]: v }));
    },
    [],
  );

  const reset = useCallback(() => setDraft(inputs), [inputs]);

  // Debounced live re-fetch when the draft changes
  const draftReqId = useRef(0);
  useEffect(() => {
    const myId = ++draftReqId.current;
    setLoading(true);
    setError(undefined);
    const handle = setTimeout(async () => {
      const r = await runCDSS({ patient_id: patient.patient_id }, draft);
      if (myId !== draftReqId.current) return; // stale
      setDraftCdss(toResult(r, localFallback));
      setSource(r.source);
      setError(r.error);
      setLoading(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [draft, patient.patient_id, localFallback]);

  const saveAndRecalculate = useCallback(() => {
    const next: ClinicianInputs = {
      ...draft,
      _lastSavedAt: new Date().toISOString(),
    };
    save(patient.patient_id, next);
    setInputs(next);
    setDraft(next);
    // Hard-commit: re-fetch and persist the response
    setLoading(true);
    runCDSS({ patient_id: patient.patient_id }, next).then((r) => {
      const result = toResult(r, localFallback);
      setCdss(result);
      setDraftCdss(result);
      setSource(r.source);
      setError(r.error);
      setLoading(false);
      saveResponse(patient.patient_id, r);
    });
    return next;
  }, [draft, patient.patient_id, localFallback]);

  const mergedPatient = useMemo(() => mergePatient(patient, inputs), [patient, inputs]);
  const draftPatient = useMemo(() => mergePatient(patient, draft), [patient, draft]);

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
    loading,
    error,
    source,
  };
}
