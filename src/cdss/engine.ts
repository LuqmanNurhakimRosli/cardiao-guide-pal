import type {
  Patient,
  CdssAlert,
  CdssResult,
  AfEvidence,
} from "./types";
import { detectAfEvidence } from "./afDetection";
import { pinrr as computePinrr } from "./pinrr";

// ---------- config ----------
export const ALLOWED_CLINICS = [
  "Cardiology Clinic",
  "Family Medicine Clinic",
];

// ---------- helpers ----------
const parseBP = (s?: string): { sys: number; dia: number } | null => {
  if (!s) return null;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(s.trim());
  if (!m) return null;
  return { sys: Number(m[1]), dia: Number(m[2]) };
};

const a = (
  id: string,
  severity: CdssAlert["severity"],
  category: CdssAlert["category"],
  title: string,
  detail: string,
  rationale: string[],
): CdssAlert => ({ id, severity, category, title, detail, rationale });

// ---------- AF detection (legacy shape kept for callers) ----------
export function detectAF(p: Patient): {
  hasAF: boolean;
  reasons: string[];
  evidence: AfEvidence[];
} {
  const evidence = detectAfEvidence(p);
  return {
    hasAF: evidence.length > 0,
    reasons: evidence.map((e) => `${e.source}: ${e.value}`),
    evidence,
  };
}

// ---------- CHA2DS2-VASc ----------
export function cha2ds2vasc(p: Patient) {
  const c = p.comorbidities ?? {};
  const breakdown: Record<string, number> = {};
  breakdown["CHF"] = c.chf ? 1 : 0;
  breakdown["Hypertension"] = c.hypertension ? 1 : 0;
  breakdown["Age ≥75"] = p.age >= 75 ? 2 : 0;
  breakdown["Age 65–74"] = p.age >= 65 && p.age < 75 ? 1 : 0;
  breakdown["Diabetes"] = c.diabetes ? 1 : 0;
  breakdown["Stroke/TIA"] = c.stroke ? 2 : 0;
  breakdown["Vascular disease"] = c.vascular ? 1 : 0;
  breakdown["Female"] = p.sex === "female" ? 1 : 0;
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { total, breakdown };
}

// ---------- Cockcroft–Gault ----------
export function creatinineClearance(p: Patient): {
  clcr?: number;
  missing: string[];
} {
  const missing: string[] = [];
  if (p.age == null) missing.push("age");
  if (!p.sex) missing.push("sex");
  if (!p.vitals?.weight) missing.push("weight");
  if (!p.labs?.creatinine) missing.push("serum creatinine");
  if (missing.length) return { missing };

  const unit = p.labs.creatinine_unit ?? "umol/L";
  const scrMgDl =
    unit === "mg/dL" ? p.labs.creatinine! : p.labs.creatinine! / 88.4;
  let clcr = ((140 - p.age) * p.vitals.weight!) / (72 * scrMgDl);
  if (p.sex === "female") clcr *= 0.85;
  return { clcr: Math.round(clcr * 10) / 10, missing: [] };
}

// ---------- main evaluator ----------
export interface EvaluateOptions {
  /** null = awaiting clinician confirmation (default), true = confirmed, false = rejected */
  afConfirmed?: boolean | null;
}

export function evaluate(
  p: Patient,
  opts: EvaluateOptions = {},
): CdssResult {
  const afConfirmed = opts.afConfirmed ?? null;

  const result: CdssResult = {
    executed: false,
    hasAF: false,
    clinicEligible: false,
    afEvidence: [],
    afConfirmed,
    scores: {},
    alerts: [],
    reminders: [],
  };

  // 1. Clinic gating (Stage 2 in workflow: location-based gating)
  const clinicEligible = ALLOWED_CLINICS.includes(p.clinic_location);
  result.clinicEligible = clinicEligible;
  if (!clinicEligible) {
    result.reason = `AF-CDSS inactive for ${p.clinic_location}. Enabled only in: ${ALLOWED_CLINICS.join(", ")}.`;
    return result;
  }

  // 2. Multi-source AF detection
  const af = detectAF(p);
  result.afEvidence = af.evidence;
  result.hasAF = af.hasAF;
  if (!af.hasAF) {
    result.executed = true;
    result.reason = "No AF evidence in ICD, ECG, medications, or PMH.";
    return result;
  }

  // 3. Clinician confirmation gate
  if (afConfirmed === null) {
    result.reason =
      "AF evidence detected — awaiting clinician confirmation before running full CDSS.";
    return result;
  }
  if (afConfirmed === false) {
    result.reason = "AF diagnosis rejected by clinician. Workflow terminated.";
    return result;
  }
  result.executed = true;

  // 4. CHA2DS2-VASc
  const chads = cha2ds2vasc(p);
  result.scores.cha2ds2vasc = chads;
  const triggerScore =
    (p.sex === "male" && chads.total >= 2) ||
    (p.sex === "female" && chads.total >= 3);
  if (triggerScore) {
    result.alerts.push(
      a(
        "stroke-prevention",
        "alert",
        "stroke-risk",
        "Anticoagulation indicated for stroke prevention",
        `CHA₂DS₂-VASc = ${chads.total} (threshold ${p.sex === "female" ? "≥3" : "≥2"}).`,
        Object.entries(chads.breakdown)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}: +${v}`),
      ),
    );
  }

  // 5. ClCr
  const cl = creatinineClearance(p);
  if (cl.clcr != null) result.scores.clcr = cl.clcr;
  else
    result.reminders.push(
      a(
        "clcr-missing",
        "reminder",
        "data",
        "Unable to calculate creatinine clearance",
        `Missing data: ${cl.missing.join(", ")}.`,
        ["Cockcroft–Gault requires age, sex, weight, serum creatinine."],
      ),
    );

  // 6. Blood pressure — use two latest readings, do NOT average
  const bp1 = parseBP(p.vitals?.bp_latest);
  const bp2 = parseBP(p.vitals?.bp_second);
  if (!bp1 || !bp2) {
    result.reminders.push(
      a(
        "bp-missing",
        "reminder",
        "data",
        "Insufficient BP data for review",
        "Two BP readings are required to assess control.",
        ["Need bp_latest and bp_second."],
      ),
    );
  } else if (bp1.sys > 140 && bp1.dia > 90 && bp2.sys > 140 && bp2.dia > 90) {
    result.alerts.push(
      a(
        "bp-uncontrolled",
        "alert",
        "bp",
        "Blood pressure uncontrolled — review therapy",
        `Both readings >140/90 (${p.vitals.bp_latest}, ${p.vitals.bp_second}).`,
        [
          `Latest: ${p.vitals.bp_latest}`,
          `Previous: ${p.vitals.bp_second}`,
          "Threshold: >140/90 on both consecutive readings.",
        ],
      ),
    );
  }

  // 7. HbA1c
  if (p.labs?.hba1c == null) {
    result.reminders.push(
      a(
        "hba1c-missing",
        "reminder",
        "data",
        "No recent HbA1c available",
        "Consider ordering HbA1c if diabetic or at risk.",
        [],
      ),
    );
  } else if (p.labs.hba1c > 7) {
    result.alerts.push(
      a(
        "hba1c-high",
        "alert",
        "glycaemic",
        "HbA1c above target — review therapy and adherence",
        `HbA1c = ${p.labs.hba1c}% (target ≤7%).`,
        [`Measured HbA1c: ${p.labs.hba1c}%`, "Threshold: >7%."],
      ),
    );
  }

  // 8. Weight missing reminder (needed for ClCr / dose adjustments)
  if (p.vitals?.weight == null) {
    result.reminders.push(
      a(
        "weight-missing",
        "reminder",
        "data",
        "No weight recorded",
        "Weight required for Cockcroft–Gault and DOAC dose criteria.",
        [],
      ),
    );
  }

  // 9. Anticoagulant review
  const meds = p.medications ?? [];
  const onMed = (name: string) =>
    meds.find((m) => m.name.toLowerCase().includes(name.toLowerCase()));

  // Warfarin — INR + PINRR
  const warf = onMed("warfarin");
  if (warf) {
    const inr = p.labs?.inr_history ?? [];
    if (inr.length === 0) {
      result.reminders.push(
        a(
          "warfarin-no-inr",
          "reminder",
          "data",
          "No INR available in last 12 months",
          "Recent INR required to assess therapeutic range and PINRR.",
          [],
        ),
      );
    } else {
      const latest = inr[inr.length - 1];
      if (latest < 2 || latest > 3) {
        result.alerts.push(
          a(
            "warfarin-inr-out",
            "alert",
            "anticoagulant",
            "INR outside therapeutic range (2.0–3.0)",
            `Latest INR = ${latest}.`,
            [`INR history: ${inr.join(", ")}`, "Target: 2.0–3.0."],
          ),
        );
      }
      const pct = computePinrr(inr);
      if (pct != null) {
        result.scores.pinrr = pct;
        if (pct < 55) {
          result.alerts.push(
            a(
              "warfarin-pinrr-low",
              "alert",
              "pinrr",
              "Suboptimal INR control (PINRR <55%)",
              `PINRR = ${pct}% over last ${inr.length} INR readings.`,
              [
                `INR history: ${inr.join(", ")}`,
                "Review adherence, drug interactions, diet.",
              ],
            ),
          );
        }
      }
    }
  }

  // Apixaban — 2 of 3 criteria
  if (onMed("apixaban")) {
    const crit: string[] = [];
    if (p.age >= 80) crit.push(`Age ${p.age} ≥80`);
    if ((p.vitals?.weight ?? Infinity) <= 60)
      crit.push(`Weight ${p.vitals?.weight} kg ≤60`);
    if ((p.labs?.creatinine ?? 0) >= 133)
      crit.push(`Creatinine ${p.labs?.creatinine} µmol/L ≥133`);
    if (crit.length >= 2) {
      result.alerts.push(
        a(
          "apixaban-reduce",
          "alert",
          "drug-dose",
          "Reduce Apixaban to 2.5 mg BD",
          `${crit.length} of 3 dose-reduction criteria met.`,
          crit,
        ),
      );
    }
  }

  // Rivaroxaban — renal
  if (onMed("rivaroxaban") && cl.clcr != null) {
    if (cl.clcr < 15)
      result.alerts.push(
        a(
          "rivaroxaban-avoid",
          "alert",
          "drug-dose",
          "Avoid Rivaroxaban (ClCr <15)",
          `ClCr = ${cl.clcr} mL/min.`,
          ["Threshold: ClCr <15 → contraindicated."],
        ),
      );
    else if (cl.clcr < 50)
      result.alerts.push(
        a(
          "rivaroxaban-reduce",
          "alert",
          "drug-dose",
          "Reduce Rivaroxaban to 15 mg OD",
          `ClCr = ${cl.clcr} mL/min (15–49).`,
          ["Threshold: ClCr 15–49 → reduce."],
        ),
      );
  }

  // Dabigatran — renal + age + verapamil
  if (onMed("dabigatran")) {
    if (cl.clcr != null) {
      if (cl.clcr < 30)
        result.alerts.push(
          a(
            "dabigatran-avoid",
            "alert",
            "drug-dose",
            "Avoid Dabigatran (ClCr <30)",
            `ClCr = ${cl.clcr} mL/min.`,
            ["Threshold: ClCr <30 → contraindicated."],
          ),
        );
      else if (cl.clcr <= 50)
        result.alerts.push(
          a(
            "dabigatran-reduce-renal",
            "alert",
            "drug-dose",
            "Reduce Dabigatran to 110 mg BD",
            `ClCr = ${cl.clcr} mL/min (30–50).`,
            ["Threshold: ClCr 30–50 → reduce."],
          ),
        );
    }
    if (p.age >= 60) {
      result.reminders.push(
        a(
          "dabigatran-age",
          "reminder",
          "drug-dose",
          "Review Dabigatran dose (age ≥60)",
          `Age = ${p.age}. Consider 110 mg BD if bleeding risk elevated.`,
          ["Age ≥60 is a dose-reduction consideration."],
        ),
      );
    }
    if (onMed("verapamil")) {
      result.alerts.push(
        a(
          "dabigatran-verapamil",
          "alert",
          "drug-dose",
          "Dabigatran + Verapamil interaction — reduce to 110 mg BD",
          "Verapamil increases dabigatran exposure.",
          ["Concomitant verapamil use."],
        ),
      );
    }
  }

  // Edoxaban — weight / renal
  if (onMed("edoxaban")) {
    const reasons: string[] = [];
    if (cl.clcr != null && cl.clcr >= 15 && cl.clcr <= 50)
      reasons.push(`ClCr ${cl.clcr} (15–50)`);
    if ((p.vitals?.weight ?? Infinity) <= 60)
      reasons.push(`Weight ${p.vitals?.weight} kg ≤60`);
    if (reasons.length) {
      result.alerts.push(
        a(
          "edoxaban-reduce",
          "alert",
          "drug-dose",
          "Reduce Edoxaban to 30 mg OD",
          reasons.join("; "),
          reasons,
        ),
      );
    }
  }

  return result;
}

// ---------- HAS-BLED (manual) ----------
export interface HasBledInputs {
  hypertension: boolean;
  abnormalRenal: boolean;
  abnormalLiver: boolean;
  stroke: boolean;
  bleedingHistory: boolean;
  labileINR: boolean;
  elderly: boolean;
  drugs: boolean;
  alcohol: boolean;
}
export function hasBled(i: HasBledInputs) {
  const breakdown: Record<string, number> = {};
  breakdown["Hypertension"] = i.hypertension ? 1 : 0;
  breakdown["Abnormal renal"] = i.abnormalRenal ? 1 : 0;
  breakdown["Abnormal liver"] = i.abnormalLiver ? 1 : 0;
  breakdown["Stroke"] = i.stroke ? 1 : 0;
  breakdown["Bleeding history"] = i.bleedingHistory ? 1 : 0;
  breakdown["Labile INR"] = i.labileINR ? 1 : 0;
  breakdown["Elderly >65"] = i.elderly ? 1 : 0;
  breakdown["Drugs"] = i.drugs ? 1 : 0;
  breakdown["Alcohol"] = i.alcohol ? 1 : 0;
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { total, breakdown, highRisk: total >= 3 };
}
