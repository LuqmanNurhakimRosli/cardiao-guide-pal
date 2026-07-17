import type { Patient } from "./types";

/**
 * Multi-source AF identification.
 * Scans ICD-10/ICD-11 codes, ECG interpretations, anticoagulant indications,
 * and past medical history free text for evidence of atrial fibrillation.
 *
 * Returns structured evidence so the UI can display the AF confirmation
 * nudge described in Stage 2 of the AF-CDSS workflow.
 */
export interface AfEvidenceItem {
  source: "ICD-10" | "ICD-11" | "ECG" | "Medication" | "PMH";
  value: string;
}

export function detectAfEvidence(p: Patient): AfEvidenceItem[] {
  const evidence: AfEvidenceItem[] = [];

  for (const d of p.diagnoses ?? []) {
    const up = d.toUpperCase();
    if (/\bI48(\.\d+)?\b/.test(up)) {
      evidence.push({ source: "ICD-10", value: d });
    } else if (/\bBC81(\.\d+)?\b/.test(up) || up.includes("BC81")) {
      // ICD-11 AF stem code
      evidence.push({ source: "ICD-11", value: d });
    }
  }

  for (const e of p.ecg_results ?? []) {
    if (/\b(AF|ATRIAL FIB)/i.test(e)) {
      evidence.push({ source: "ECG", value: e });
    }
  }

  for (const m of p.medications ?? []) {
    if ((m.indication ?? "").toUpperCase().includes("AF")) {
      evidence.push({
        source: "Medication",
        value: `${m.name} (indication: ${m.indication})`,
      });
    }
  }

  // PMH free text lives on diagnoses too in this prototype
  for (const d of p.diagnoses ?? []) {
    if (/atrial\s*fibrill/i.test(d)) {
      evidence.push({ source: "PMH", value: d });
    }
  }

  return evidence;
}
