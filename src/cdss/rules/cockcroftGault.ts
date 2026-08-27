import type { Patient } from "../types";

export function creatinineClearance(p: Patient): {
  clcr?: number;
  missing: string[];
  sourceDates?: { creatinine_date?: string; weight_date?: string };
} {
  const missing: string[] = [];
  const age = p.age_at_encounter ?? p.age;
  if (age == null) missing.push("age");
  if (!p.sex) missing.push("sex");

  const weight = p.vitals?.weight_record?.value ?? p.vitals?.weight;
  const weightDate = p.vitals?.weight_record?.date;
  if (!weight) missing.push("weight");

  const scr = p.labs?.creatinine_record?.value ?? p.labs?.creatinine;
  const scrUnit = p.labs?.creatinine_record?.unit ?? p.labs?.creatinine_unit ?? "umol/L";
  const scrDate = p.labs?.creatinine_record?.date;
  if (!scr) missing.push("serum creatinine");

  if (missing.length) return { missing };

  // Convert umol/L to mg/dL: divide by 88.4
  const scrMgDl = scrUnit === "mg/dL" ? scr! : scr! / 88.4;
  let clcr = ((140 - age!) * weight!) / (72 * scrMgDl);
  if (p.sex === "female") clcr *= 0.85;

  return {
    clcr: Math.round(clcr * 10) / 10,
    missing: [],
    sourceDates: {
      creatinine_date: scrDate,
      weight_date: weightDate,
    },
  };
}
