import type { Patient, CdssAlert, CdssResult } from "./types";

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

// ---------- AF detection ----------
export function detectAF(p: Patient): { hasAF: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (p.diagnoses?.some((d) => d.toUpperCase().includes("I48")))
    reasons.push(`ICD-10 diagnosis includes I48 (${p.diagnoses.join(", ")})`);
  if (p.ecg_results?.some((e) => e.toUpperCase().includes("AF")))
    reasons.push(`ECG result indicates AF (${p.ecg_results.join(", ")})`);
  if (p.medications?.some((m) => (m.indication ?? "").toUpperCase() === "AF"))
    reasons.push(
      `On anticoagulant for AF (${p.medications
        .filter((m) => (m.indication ?? "").toUpperCase() === "AF")
        .map((m) => m.name)
        .join(", ")})`,
    );
  return { hasAF: reasons.length > 0, reasons };
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
export function evaluate(p: Patient): CdssResult {
  const result: CdssResult = {
    executed: false,
    hasAF: false,
    scores: {},
    alerts: [],
    reminders: [],
  };

  // 1. Trigger
  if (p.clinic_location !== "Cardiology Clinic") {
    result.reason = "CDSS only executes in Cardiology Clinic.";
    return result;
  }
  result.executed = true;

  // 2. AF detection
  const af = detectAF(p);
  result.hasAF = af.hasAF;
  if (!af.hasAF) {
    result.reason = "No AF indicators found (ICD-10, ECG, or AF anticoagulant).";
    return result;
  }

  // 3. CHA2DS2-VASc
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

  // 4. ClCr
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

  // 5. Blood pressure
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

  // 6. HbA1c
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
        "HbA1c above target — review therapy",
        `HbA1c = ${p.labs.hba1c}% (target ≤7%).`,
        [`Measured HbA1c: ${p.labs.hba1c}%`, "Threshold: >7%."],
      ),
    );
  }

  // 7. Anticoagulant review
  const meds = p.medications ?? [];
  const onMed = (name: string) =>
    meds.find((m) => m.name.toLowerCase().includes(name.toLowerCase()));

  // Warfarin
  const warf = onMed("warfarin");
  if (warf) {
    const inr = p.labs?.inr_history ?? [];
    if (inr.length === 0) {
      result.reminders.push(
        a(
          "warfarin-no-inr",
          "reminder",
          "data",
          "No INR data available for warfarin patient",
          "Recent INR is required to assess therapeutic range.",
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
      if (inr.length >= 3) {
        const inRange = inr.filter((v) => v >= 2 && v <= 3).length;
        const ttr = (inRange / inr.length) * 100;
        if (ttr < 65) {
          result.alerts.push(
            a(
              "warfarin-ttr-low",
              "alert",
              "anticoagulant",
              "Warfarin control suboptimal (TTR <65%)",
              `Estimated TTR = ${ttr.toFixed(0)}%.`,
              [`INR history: ${inr.join(", ")}`, `${inRange}/${inr.length} in range`],
            ),
          );
        }
      }
    }
  }

  // Apixaban
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
          "anticoagulant",
          "Consider reducing Apixaban dose to 2.5 mg BD",
          `${crit.length} of 3 dose-reduction criteria met.`,
          crit,
        ),
      );
    }
  }

  // Rivaroxaban
  if (onMed("rivaroxaban") && cl.clcr != null) {
    if (cl.clcr < 15)
      result.alerts.push(
        a(
          "rivaroxaban-avoid",
          "alert",
          "anticoagulant",
          "Rivaroxaban not recommended (ClCr <15)",
          `ClCr = ${cl.clcr} mL/min.`,
          ["Threshold: ClCr <15 → avoid."],
        ),
      );
    else if (cl.clcr < 50)
      result.alerts.push(
        a(
          "rivaroxaban-reduce",
          "alert",
          "anticoagulant",
          "Reduce Rivaroxaban dose (15 mg OD)",
          `ClCr = ${cl.clcr} mL/min (15–49).`,
          ["Threshold: ClCr 15–49 → reduce."],
        ),
      );
  }

  // Dabigatran
  if (onMed("dabigatran")) {
    if (cl.clcr != null) {
      if (cl.clcr < 30)
        result.alerts.push(
          a(
            "dabigatran-avoid",
            "alert",
            "anticoagulant",
            "Dabigatran contraindicated (ClCr <30)",
            `ClCr = ${cl.clcr} mL/min.`,
            ["Threshold: ClCr <30 → avoid."],
          ),
        );
      else if (cl.clcr <= 50)
        result.alerts.push(
          a(
            "dabigatran-reduce-renal",
            "alert",
            "anticoagulant",
            "Consider reducing Dabigatran to 110 mg BD",
            `ClCr = ${cl.clcr} mL/min (30–50).`,
            ["Threshold: ClCr 30–50 → reduce."],
          ),
        );
    }
    if (p.age > 80)
      result.alerts.push(
        a(
          "dabigatran-reduce-age",
          "alert",
          "anticoagulant",
          "Reduce Dabigatran to 110 mg BD (age >80)",
          `Age = ${p.age}.`,
          ["Threshold: age >80 → reduce."],
        ),
      );
  }

  // Edoxaban
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
          "anticoagulant",
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
  hypertension: boolean; // uncontrolled, sys >160
  abnormalRenal: boolean;
  abnormalLiver: boolean;
  stroke: boolean;
  bleedingHistory: boolean;
  labileINR: boolean;
  elderly: boolean; // >65
  drugs: boolean; // antiplatelet/NSAID
  alcohol: boolean;
}
export function hasBled(i: HasBledInputs) {
  let total = 0;
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
  total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { total, breakdown, highRisk: total > 3 };
}
